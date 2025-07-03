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
  logger.debug(`Prompt: ${prompt}`);
  logger.debug(`Timeout: ${timeout}ms, Interval: ${interval}ms`);
  
  const escapedPrompt = escapeAppleScriptString(prompt);
  
  // Save original clipboard content
  const saveClipboardScript = `
    set savedClipboard to the clipboard
    return savedClipboard
  `;
  
  logger.debug('Saving original clipboard content');
  const originalClipboard = await runAppleScript(saveClipboardScript);
  const escapedOriginalClipboard = escapeAppleScriptString(originalClipboard);
  
  const script = `
    tell application "Claude"
      activate
      delay 1
      
      tell application "System Events"
        tell process "Claude"
          set frontmost to true
          delay 0.5
          
          ${conversationId ? `
          -- Try to select specific conversation
          try
            click button "${conversationId}" of group 1 of group 1 of window 1
            delay 1
          end try
          ` : `
          -- Create new conversation
          keystroke "n" using command down
          delay 1.5
          `}
          
          -- Find the text input area and click it
          try
            -- Look for the main text input field
            set textAreas to text areas of window 1
            if (count of textAreas) > 0 then
              click last text area of window 1
              delay 0.5
            end if
          end try
          
          -- Clear any existing text
          keystroke "a" using {command down}
          delay 0.2
          key code 51 -- delete key
          delay 0.5
          
          -- Set clipboard to prompt text
          set the clipboard to "${escapedPrompt}"
          delay 0.2
          
          -- Paste the prompt
          keystroke "v" using {command down}
          delay 0.5
          
          -- Send the message
          key code 36 -- return key
          delay 1
        end tell
      end tell
    end tell
  `;
  
  try {
    logger.debug('Executing AppleScript to send prompt');
    await runAppleScript(script);
    logger.debug('AppleScript executed successfully');
    
    // Give Claude a moment to start processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Poll for response
    logger.debug('Starting to poll for response');
    const response = await pollForClaudeResponse(requestId, prompt, { timeout, interval });
    
    // Restore original clipboard
    logger.debug('Restoring original clipboard');
    await runAppleScript(`set the clipboard to "${escapedOriginalClipboard}"`);
    
    return response;
  } catch (error) {
    logger.error('Error in askClaude:', error);
    // Restore original clipboard on error
    try {
      await runAppleScript(`set the clipboard to "${escapedOriginalClipboard}"`);
    } catch (clipboardError) {
      logger.error('Failed to restore clipboard:', clipboardError);
    }
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
              
              -- Get all text from the window with better filtering
              set allElements to entire contents of frontWin
              repeat with elem in allElements
                try
                  if class of elem is static text then
                    set txtValue to value of elem
                    if txtValue is not missing value then
                      set txtLength to length of txtValue
                      -- Filter out short UI elements and empty strings
                      if txtLength > 10 then
                        -- Skip common UI elements
                        if txtValue does not start with "Today" and ¬
                           txtValue does not start with "Yesterday" and ¬
                           txtValue does not contain "New chat" and ¬
                           txtValue does not contain "Connect apps" and ¬
                           txtValue does not contain "Projects" and ¬
                           txtValue does not contain "Artifacts" and ¬
                           txtValue does not contain "Copy" and ¬
                           txtValue does not contain "Share" and ¬
                           txtValue does not contain "Edit" and ¬
                           txtValue does not contain "More" and ¬
                           txtValue does not contain "How can I help" then
                          set end of messageTexts to txtValue
                        end if
                      end if
                    end if
                  end if
                end try
              end repeat
              
              -- Join all texts with newlines
              set AppleScript's text item delimiters to linefeed & linefeed
              set allText to messageTexts as text
            on error errMsg
              return "Error reading window: " & errMsg
            end try
            return allText
          end tell
        end tell
      end tell
    `;
    
    try {
      const currentText = await runAppleScript(script);
      logger.debug(`Polling attempt, got text length: ${currentText.length}`);
      
      // Look for Claude's response more intelligently
      const response = extractClaudeResponse(currentText, originalPrompt);
      
      if (response && response !== lastResponseText) {
        // New response text detected
        logger.debug(`New response detected: ${response.substring(0, 50)}...`);
        lastResponseText = response;
        stableCount = 0;
      } else if (response && response === lastResponseText) {
        // Response text hasn't changed
        stableCount++;
        logger.debug(`Response stable for ${stableCount} checks`);
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
        logger.debug('Typing indicators detected, resetting stable count');
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
    logger.debug('No text to extract from');
    return null;
  }
  
  logger.debug(`Extracting response from text: ${fullText.substring(0, 200)}...`);
  
  // Clean the text first
  const cleanedText = fullText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  
  // Split into meaningful chunks (double newline separated)
  const chunks = cleanedText.split(/\n\n+/).map(chunk => chunk.trim()).filter(chunk => chunk.length > 0);
  logger.debug(`Found ${chunks.length} text chunks`);
  
  // Find the prompt in the chunks
  let promptChunkIndex = -1;
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].includes(prompt)) {
      promptChunkIndex = i;
      logger.debug(`Found prompt at chunk index ${i}`);
      break;
    }
  }
  
  // If we found the prompt, look for the response after it
  if (promptChunkIndex !== -1 && promptChunkIndex < chunks.length - 1) {
    // Get all chunks after the prompt
    const responseChunks = chunks.slice(promptChunkIndex + 1);
    
    // Filter out UI elements and join
    const filteredChunks = responseChunks.filter(chunk => {
      // Skip if it's a known UI element or too short
      if (chunk.length < 10) return false;
      if (chunk.match(/^(Copy|Share|More|Edit|New chat|Today|Yesterday|Claude|You|DP|User)$/i)) return false;
      if (chunk.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i)) return false;
      if (chunk.includes('▍') || chunk.includes('Claude is typing') || chunk === 'Thinking') return false;
      
      return true;
    });
    
    if (filteredChunks.length > 0) {
      const response = filteredChunks.join('\n\n').trim();
      logger.debug(`Extracted response: ${response.substring(0, 100)}...`);
      return response;
    }
  }
  
  // Fallback: Look for any substantial text that's not UI elements
  const allLines = cleanedText.split('\n').map(l => l.trim()).filter(l => l.length > 20);
  for (const line of allLines) {
    if (!line.match(/^(Copy|Share|More|Edit|New chat|Today|Yesterday|How can I help|Connect apps|Projects|Artifacts)$/i) &&
        !line.includes(prompt)) {
      logger.debug(`Fallback response: ${line.substring(0, 100)}...`);
      return line;
    }
  }
  
  logger.debug('No response found in text');
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