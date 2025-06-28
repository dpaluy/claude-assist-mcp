import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { runAppleScript, escapeAppleScriptString } from '../utils/applescript.js';
import { PollingOptions } from '../types/index.js';

interface ClaudeDesktopArgs {
  operation: 'ask' | 'get_conversations';
  prompt?: string;
  conversationId?: string;
  pollingOptions?: PollingOptions;
}

interface ConversationList {
  conversations: string[];
  timestamp: string;
}

export async function handleClaudeDesktop(args: ClaudeDesktopArgs): Promise<string | ConversationList> {
  switch (args.operation) {
    case 'ask':
      if (!args.prompt) {
        throw new Error('Prompt is required for ask operation');
      }
      return askClaude(args.prompt, args.conversationId, args.pollingOptions);
    
    case 'get_conversations':
      return getConversations();
    
    default:
      throw new Error(`Unknown operation: ${args.operation}`);
  }
}

async function askClaude(
  prompt: string,
  conversationId?: string,
  pollingOptions?: PollingOptions
): Promise<string> {
  const requestId = uuidv4();
  const { timeout = 30000, interval = 2000 } = pollingOptions || {};
  
  logger.info(`Sending prompt to Claude Desktop: ${requestId}`);
  
  const escapedPrompt = escapeAppleScriptString(prompt);
  
  // Save original clipboard content
  const saveClipboardScript = `
    set savedClipboard to the clipboard
    return savedClipboard
  `;
  const originalClipboard = await runAppleScript(saveClipboardScript);
  const escapedOriginalClipboard = escapeAppleScriptString(originalClipboard);
  
  const script = `
    tell application "Claude"
      activate
      delay 0.5
      
      tell application "System Events"
        tell process "Claude"
          set frontmost to true
          
          ${conversationId ? `
          -- Try to select specific conversation
          try
            click button "${conversationId}" of group 1 of group 1 of window 1
            delay 1
          end try
          ` : `
          -- Create new conversation
          keystroke "n" using command down
          delay 1
          `}
          
          -- Clear any existing text
          keystroke "a" using {command down}
          keystroke (ASCII character 8)
          delay 0.5
          
          -- Set clipboard to prompt text
          set the clipboard to "${escapedPrompt}"
          
          -- Paste and send
          keystroke "v" using {command down}
          delay 0.5
          key code 36
        end tell
      end tell
    end tell
  `;
  
  try {
    await runAppleScript(script);
    
    // Poll for response
    const response = await pollForClaudeResponse(requestId, prompt, { timeout, interval });
    
    // Restore original clipboard
    await runAppleScript(`set the clipboard to "${escapedOriginalClipboard}"`);
    
    return response;
  } catch (error) {
    // Restore original clipboard on error
    await runAppleScript(`set the clipboard to "${escapedOriginalClipboard}"`);
    throw error;
  }
}

async function pollForClaudeResponse(
  requestId: string,
  originalPrompt: string,
  options: { timeout: number; interval: number }
): Promise<string> {
  const startTime = Date.now();
  let previousText = '';
  let stableCount = 0;
  const requiredStableChecks = 3;
  
  logger.info(`Polling for Claude response: ${requestId}`);
  
  while (Date.now() - startTime < options.timeout) {
    const script = `
      tell application "Claude"
        tell application "System Events"
          tell process "Claude"
            set allText to ""
            try
              set frontWin to front window
              set allUIElements to entire contents of frontWin
              set conversationText to {}
              
              repeat with elem in allUIElements
                try
                  if (role of elem) is "AXStaticText" then
                    set textContent to value of elem as string
                    if textContent is not missing value then
                      set end of conversationText to textContent
                    end if
                  end if
                end try
              end repeat
              
              set AppleScript's text item delimiters to linefeed
              set allText to conversationText as text
            end try
            return allText
          end tell
        end tell
      end tell
    `;
    
    try {
      const currentText = await runAppleScript(script);
      
      // Check if text has stabilized
      if (currentText === previousText) {
        stableCount++;
        if (stableCount >= requiredStableChecks) {
          // Extract Claude's response
          const response = extractClaudeResponse(currentText, originalPrompt);
          if (response) {
            logger.info(`Claude response received: ${requestId}`);
            return response;
          }
        }
      } else {
        stableCount = 0;
        previousText = currentText;
      }
      
      // Check for typing indicators
      if (currentText.includes('▍') || currentText.includes('Claude is typing')) {
        stableCount = 0;
      }
    } catch (error) {
      logger.warn(`Poll attempt failed: ${error}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, options.interval));
  }
  
  logger.warn(`Response timed out: ${requestId}`);
  return 'Response timed out. Claude may still be processing.';
}

function extractClaudeResponse(fullText: string, prompt: string): string | null {
  if (!fullText || fullText.length === 0) {
    return null;
  }
  
  // Try to find where the prompt ends and response begins
  const promptIndex = fullText.indexOf(prompt);
  if (promptIndex !== -1) {
    const afterPrompt = fullText.substring(promptIndex + prompt.length).trim();
    
    // Look for Claude's response pattern
    const responsePatterns = [
      /^Claude[:\s]+(.+)$/s,
      /^Assistant[:\s]+(.+)$/s,
      /^(.+)$/s // Fallback to any text after prompt
    ];
    
    for (const pattern of responsePatterns) {
      const match = afterPrompt.match(pattern);
      if (match && match[1]) {
        const response = match[1].trim();
        
        // Clean up UI elements
        const cleaned = response
          .replace(/Copy|Share|More|Edit/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (cleaned.length > 0) {
          return cleaned;
        }
      }
    }
  }
  
  // If we can't find the prompt, look for the last substantial text block
  const lines = fullText.split('\n').filter(line => line.trim().length > 0);
  if (lines.length > 0) {
    // Skip UI elements and find actual content
    const contentLines = lines.filter(line => 
      !line.match(/^(Copy|Share|More|Edit|New chat)$/i) &&
      line.length > 10
    );
    
    if (contentLines.length > 0) {
      return contentLines.join('\n');
    }
  }
  
  return null;
}

async function getConversations(): Promise<ConversationList> {
  logger.info('Getting Claude Desktop conversations');
  
  const script = `
    tell application "System Events"
      if not (application process "Claude" exists) then
        return "Claude is not running"
      end if
    end tell
    
    tell application "Claude"
      activate
      delay 1
      
      tell application "System Events"
        tell process "Claude"
          if not (exists window 1) then
            return "No Claude window found"
          end if
          
          set conversationsList to {}
          
          try
            -- Try to find conversation buttons
            if exists group 1 of group 1 of window 1 then
              set chatButtons to buttons of group 1 of group 1 of window 1
              repeat with chatButton in chatButtons
                try
                  set buttonName to name of chatButton
                  if buttonName is not "New chat" and buttonName is not "" then
                    set end of conversationsList to buttonName
                  end if
                end try
              end repeat
            end if
            
            -- Alternative approach using UI elements
            if (count of conversationsList) is 0 then
              set uiElements to UI elements of window 1
              repeat with elem in uiElements
                try
                  if exists (attribute "AXTitle" of elem) then
                    set elemTitle to value of attribute "AXTitle" of elem
                    if elemTitle is not "New chat" and elemTitle is not "" then
                      set end of conversationsList to elemTitle
                    end if
                  end if
                end try
              end repeat
            end if
          on error errMsg
            return "Error: " & errMsg
          end try
          
          if (count of conversationsList) is 0 then
            return "No conversations found"
          end if
          
          return conversationsList
        end tell
      end tell
    end tell
  `;
  
  try {
    const result = await runAppleScript(script);
    
    if (result === 'Claude is not running') {
      throw new Error('Claude Desktop is not running');
    } else if (result === 'No Claude window found') {
      throw new Error('No Claude window found');
    } else if (result === 'No conversations found') {
      return {
        conversations: [],
        timestamp: new Date().toISOString(),
      };
    } else if (result.startsWith('Error:')) {
      throw new Error(result);
    }
    
    const conversations = result.split(', ').filter(c => c.trim().length > 0);
    
    return {
      conversations,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to get conversations:', error);
    throw error;
  }
}