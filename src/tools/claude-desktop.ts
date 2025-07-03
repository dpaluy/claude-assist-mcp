import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { runAppleScript, escapeAppleScriptString } from '../utils/applescript.js';
import { PollingOptions } from '../types/index.js';
import { ClaudeDesktopError, ErrorCode, ValidationError } from '../utils/errors.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { config } from '../config/index.js';

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
  // Validate inputs
  if (!prompt || prompt.trim().length === 0) {
    throw new ValidationError('Prompt cannot be empty', 'prompt');
  }
  
  if (prompt.length > config.limits.maxPromptLength) {
    throw new ValidationError(
      `Prompt too long (${prompt.length} chars, max ${config.limits.maxPromptLength})`,
      'prompt'
    );
  }
  
  if (conversationId && conversationId.length > config.limits.maxConversationIdLength) {
    throw new ValidationError(
      `Conversation ID too long (max ${config.limits.maxConversationIdLength} chars)`,
      'conversationId'
    );
  }
  
  const requestId = uuidv4();
  const { 
    timeout = config.polling.defaultTimeout, 
    interval = config.polling.defaultInterval 
  } = pollingOptions || {};
  
  logger.info(`Sending prompt to Claude Desktop: ${requestId}`);
  logger.debug(`Prompt: ${prompt}`);
  logger.debug(`Timeout: ${timeout}ms, Interval: ${interval}ms`);
  
  const escapedPrompt = escapeAppleScriptString(prompt);
  
  // Save original clipboard content
  const saveClipboardScript = `
    try
      set savedClipboard to the clipboard as string
      return savedClipboard
    on error
      -- If clipboard contains non-text data, return empty string
      return ""
    end try
  `;
  
  logger.debug('Saving original clipboard content');
  let originalClipboard = '';
  try {
    originalClipboard = await runAppleScript(saveClipboardScript);
  } catch (clipErr) {
    logger.warn('Failed to save clipboard content, continuing without restore:', clipErr);
    originalClipboard = '';
  }
  const escapedOriginalClipboard = originalClipboard ? escapeAppleScriptString(originalClipboard) : '';
  
  const script = `
    tell application "Claude"
      activate
      delay 1
      
      tell application "System Events"
        tell process "Claude"
          -- Now access window 1
          try
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
            
            return "Success"
          on error errMsg number errNum
            error "Failed to interact with Claude: " & errMsg number errNum
          end try
        end tell
      end tell
    end tell
  `;
  
  try {
    logger.debug('Executing AppleScript to send prompt');
    const result = await ErrorHandler.withRetry(
      () => runAppleScript(script, {
        timeout: config.applescript.timeout,
        retries: 1, // Don't retry the main script
      }),
      {
        maxAttempts: 1,
        shouldRetry: () => false,
      }
    );
    
    logger.debug('AppleScript result:', result);
    
    // Give Claude more time to start processing and show response
    await new Promise(resolve => setTimeout(resolve, config.claude.responseStartDelay));
    
    // Poll for response
    logger.debug('Starting to poll for response');
    const response = await pollForClaudeResponse(requestId, prompt, { timeout, interval });
    
    // Restore original clipboard if we saved it
    if (originalClipboard) {
      logger.debug('Restoring original clipboard');
      try {
        await runAppleScript(`set the clipboard to "${escapedOriginalClipboard}"`);
      } catch (restoreErr) {
        logger.warn('Failed to restore clipboard:', restoreErr);
      }
    }
    
    return response;
  } catch (error: any) {
    logger.error('Error in askClaude:', error);
    logger.debug('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // Restore original clipboard on error if we saved it
    if (originalClipboard) {
      try {
        await runAppleScript(`set the clipboard to "${escapedOriginalClipboard}"`);
      } catch (clipboardError) {
        logger.error('Failed to restore clipboard:', clipboardError);
      }
    }
    
    // Convert to appropriate error type based on error code
    const errorNumber = (error as any).appleScriptErrorNumber;
    
    if (errorNumber === 1001 || error.message?.includes('Claude Desktop is not running')) {
      throw new ClaudeDesktopError(
        'Claude Desktop is not running',
        ErrorCode.CLAUDE_NOT_RUNNING,
        'askClaude'
      );
    }
    
    if (errorNumber === 1002 || error.message?.includes('No Claude window available')) {
      throw new ClaudeDesktopError(
        'No Claude window found',
        ErrorCode.CLAUDE_WINDOW_NOT_FOUND,
        'askClaude'
      );
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
  let stableCount = 0;
  const requiredStableChecks = config.polling.requiredStableChecks;
  let lastResponseText = '';
  
  logger.info(`Polling for Claude response: ${requestId}`);
  
  // Add option to skip polling via environment variable
  if (process.env.SKIP_CLAUDE_POLLING === 'true') {
    logger.info('Skipping response polling as per environment variable');
    return `Message sent to Claude Desktop successfully. Response polling is disabled.`;
  }
  
  while (Date.now() - startTime < options.timeout) {
    try {
      const script = `
        tell application "System Events"
          if not (exists process "Claude") then
            return "Error: Claude process not found"
          end if
        end tell
        
        tell application "Claude"
          tell application "System Events"
            tell process "Claude"
              set allText to ""
              set messageTexts to {}
              try
                -- Check if window exists
                if (count of windows) = 0 then
                  return "Error: No Claude window"
                end if
                
                set frontWin to front window
                
                -- Get all text from the window
                set allElements to entire contents of frontWin
                repeat with elem in allElements
                  try
                    if (role of elem) is "AXStaticText" then
                      set txtValue to value of elem
                      if txtValue is not missing value and txtValue is not "" then
                        set end of messageTexts to txtValue
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
      
      const currentText = await runAppleScript(script);
      logger.debug(`Polling attempt, got text length: ${currentText.length}`);
      
      // Log the first 500 characters of what we got
      if (currentText.length > 0) {
        logger.debug(`Raw text content: ${currentText.substring(0, 500)}${currentText.length > 500 ? '...' : ''}`);
      } else {
        logger.debug('No text content received from AppleScript');
      }
      
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
      
    } catch (error: any) {
      logger.warn(`Poll attempt failed: ${error.message || error}`);
      // If we're getting consistent errors, break early
      if (error.message?.includes('Claude process not found')) {
        logger.error('Claude Desktop appears to have closed');
        break;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, options.interval));
  }
  
  // If we have a last response, return it even if timeout
  if (lastResponseText) {
    logger.info(`Returning last captured response: ${requestId}`);
    return lastResponseText;
  }
  
  logger.warn(`Unable to read Claude response: ${requestId}`);
  return `Message sent to Claude Desktop successfully. 

Note: Due to Claude Desktop's architecture, responses cannot be read programmatically through this MCP integration. 

The prompt "${originalPrompt}" has been sent and Claude should be responding in the desktop app. Please check the Claude Desktop window directly for the response.

This is a known limitation of automating Electron-based applications.`;
}

function extractClaudeResponse(fullText: string, prompt: string): string | null {
  if (!fullText || fullText.length === 0) {
    logger.debug('No text to extract from');
    return null;
  }
  
  // Check for error messages from our AppleScript
  if (fullText.startsWith('Error:')) {
    logger.debug('Received error from AppleScript');
    return null;
  }
  
  logger.debug(`Extracting response from text: ${fullText.substring(0, 200)}...`);
  
  // Clean the text first
  const cleanedText = fullText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  
  // Try to find the prompt in the text and extract everything after it
  const promptIndex = cleanedText.indexOf(prompt);
  if (promptIndex !== -1) {
    // Get text after the prompt
    const afterPrompt = cleanedText.substring(promptIndex + prompt.length).trim();
    
    // Filter out common UI elements that might appear after the response
    const uiElements = [
      'Claude can make mistakes',
      'Please double-check responses',
      'Reply to Claude...',
      'Chat controls',
      'Smart, efficient model',
      'No content added yet',
      'Copy',
      'Share',
      'Edit',
      'More',
      'Regenerate',
      'Continue generating'
    ];
    
    let responseText = afterPrompt;
    
    // Find the first UI element and cut the text there
    let firstUIElementIndex = responseText.length;
    for (const uiElement of uiElements) {
      const index = responseText.indexOf(uiElement);
      if (index !== -1 && index < firstUIElementIndex) {
        firstUIElementIndex = index;
      }
    }
    
    if (firstUIElementIndex < responseText.length) {
      responseText = responseText.substring(0, firstUIElementIndex).trim();
    }
    
    // If we found a response, return it
    if (responseText.length > 0) {
      logger.debug('Successfully extracted Claude response');
      return responseText;
    }
  }
  
  // If we couldn't extract a response, check if we at least have some text
  if (cleanedText.length > 50 && !cleanedText.includes('No content added yet')) {
    logger.debug('Returning full text as response');
    return cleanedText;
  }
  
  logger.warn('Unable to extract Claude response from UI');
  return null;
}

export async function getConversations(): Promise<ConversationList> {
  logger.info('Getting Claude Desktop conversations');
  
  const script = `
    tell application "Claude"
      activate
      delay 1
      
      tell application "System Events"
        tell process "Claude"
          if not (exists window 1) then
            error "No Claude window found" number 1002
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
          on error errMsg number errNum
            error "Failed to get conversations: " & errMsg number errNum
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
    const result = await runAppleScript(script, {
      timeout: config.applescript.timeout,
    });
    
    if (result === 'No conversations found') {
      return {
        conversations: [],
        timestamp: new Date().toISOString(),
      };
    }
    
    const conversations = result.split(', ').filter(c => c.trim().length > 0);
    
    return {
      conversations,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error('Failed to get conversations:', error);
    logger.debug('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // Convert to appropriate error type based on error code
    const errorNumber = (error as any).appleScriptErrorNumber;
    
    if (errorNumber === 1001 || error.message?.includes('Claude Desktop is not running')) {
      throw new ClaudeDesktopError(
        'Claude Desktop is not running',
        ErrorCode.CLAUDE_NOT_RUNNING,
        'getConversations'
      );
    }
    
    if (errorNumber === 1002 || error.message?.includes('No Claude window available')) {
      throw new ClaudeDesktopError(
        'No Claude window found',
        ErrorCode.CLAUDE_WINDOW_NOT_FOUND,
        'getConversations'
      );
    }
    
    throw error;
  }
}