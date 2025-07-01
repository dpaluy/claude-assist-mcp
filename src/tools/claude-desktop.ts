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

export async function askClaude(
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
  const requiredStableChecks = 2; // Reduced for faster detection
  let lastResponseText = '';
  
  logger.info(`Polling for Claude response: ${requestId}`);
  
  while (Date.now() - startTime < options.timeout) {
    const script = `
      tell application "Claude"
        tell application "System Events"
          tell process "Claude"
            set allText to ""
            set messageTexts to {}
            try
              set frontWin to front window
              
              -- Try multiple approaches to find messages
              -- Approach 1: Look for specific message containers
              try
                set messageGroups to groups of frontWin whose role is "AXGroup"
                repeat with msgGroup in messageGroups
                  try
                    set staticTexts to static texts of msgGroup
                    repeat with txt in staticTexts
                      set txtValue to value of txt
                      if txtValue is not missing value and length of txtValue > 0 then
                        set end of messageTexts to txtValue
                      end if
                    end repeat
                  end try
                end repeat
              end try
              
              -- Approach 2: Look for text in scroll areas
              try
                set scrollAreas to scroll areas of frontWin
                repeat with scrollArea in scrollAreas
                  try
                    set staticTexts to static texts of scrollArea
                    repeat with txt in staticTexts
                      set txtValue to value of txt
                      if txtValue is not missing value and length of txtValue > 0 then
                        set end of messageTexts to txtValue
                      end if
                    end repeat
                  end try
                end repeat
              end try
              
              -- Approach 3: Get all static texts (fallback)
              if (count of messageTexts) is 0 then
                set allUIElements to entire contents of frontWin
                repeat with elem in allUIElements
                  try
                    if (role of elem) is "AXStaticText" then
                      set textContent to value of elem as string
                      if textContent is not missing value and length of textContent > 0 then
                        set end of messageTexts to textContent
                      end if
                    end if
                  end try
                end repeat
              end if
              
              -- Join all texts
              set AppleScript's text item delimiters to linefeed
              set allText to messageTexts as text
            end try
            return allText
          end tell
        end tell
      end tell
    `;
    
    try {
      const currentText = await runAppleScript(script);
      
      // Look for Claude's response more intelligently
      const response = extractClaudeResponse(currentText, originalPrompt);
      
      if (response && response !== lastResponseText) {
        // New response text detected
        lastResponseText = response;
        stableCount = 0;
      } else if (response && response === lastResponseText) {
        // Response text hasn't changed
        stableCount++;
        if (stableCount >= requiredStableChecks) {
          // Check if we're not seeing typing indicators
          if (!currentText.includes('▍') && 
              !currentText.includes('Claude is typing') &&
              !currentText.includes('Thinking')) {
            logger.info(`Claude response received: ${requestId}`);
            return response;
          }
        }
      }
      
      // Reset stable count if we see typing indicators
      if (currentText.includes('▍') || 
          currentText.includes('Claude is typing') ||
          currentText.includes('Thinking')) {
        stableCount = 0;
      }
      
      previousText = currentText;
    } catch (error) {
      logger.warn(`Poll attempt failed: ${error}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, options.interval));
  }
  
  // If we have a last response, return it even if timeout
  if (lastResponseText) {
    logger.info(`Returning last captured response: ${requestId}`);
    return lastResponseText;
  }
  
  logger.warn(`Response timed out: ${requestId}`);
  return 'Response timed out. Claude may still be processing.';
}

function extractClaudeResponse(fullText: string, prompt: string): string | null {
  if (!fullText || fullText.length === 0) {
    return null;
  }
  
  // Clean the text first
  const cleanedText = fullText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  
  // Split into lines for better processing
  const lines = cleanedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Find the prompt line
  let promptLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(prompt) || prompt.includes(lines[i])) {
      promptLineIndex = i;
      break;
    }
  }
  
  // Collect all lines after the prompt
  const responseLines: string[] = [];
  const startIndex = promptLineIndex !== -1 ? promptLineIndex + 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip UI elements and metadata
    if (line.match(/^(Copy|Share|More|Edit|New chat|Today|Yesterday|\d+:\d+\s*(AM|PM))$/i)) {
      continue;
    }
    
    // Skip timestamps
    if (line.match(/^\d{1,2}:\d{2}\s*(AM|PM|am|pm)$/)) {
      continue;
    }
    
    // Skip user indicators
    if (line.match(/^(You|User|Me|DP)$/i)) {
      continue;
    }
    
    // Skip typing indicators
    if (line.includes('▍') || line.includes('Claude is typing') || line === 'Thinking') {
      continue;
    }
    
    // Check if this might be the start of Claude's response
    if (line.match(/^(Claude|Assistant|AI)$/i)) {
      // Skip this line but include everything after
      continue;
    }
    
    // Include substantial content
    if (line.length > 3) {
      responseLines.push(line);
    }
  }
  
  // Join the response lines
  let response = responseLines.join('\n').trim();
  
  // Additional cleanup
  response = response
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/([.!?])\s*([A-Z])/g, '$1\n$2') // Add line breaks after sentences
    .trim();
  
  // Return if we have meaningful content
  if (response.length > 10) {
    return response;
  }
  
  // Fallback: Look for any substantial text block in the latter half
  const halfwayPoint = Math.floor(lines.length / 2);
  for (let i = lines.length - 1; i >= halfwayPoint; i--) {
    const line = lines[i];
    if (line.length > 20 && 
        !line.match(/^(Copy|Share|More|Edit|New chat|Today|Yesterday)$/i)) {
      return line;
    }
  }
  
  return null;
}

export async function getConversations(): Promise<ConversationList> {
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