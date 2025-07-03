#!/usr/bin/env node

/**
 * Debug script to test sending prompts to Claude Desktop
 * Demonstrates that sending works but reading responses doesn't
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runAppleScript(script) {
  const escapedScript = script.replace(/'/g, "'\"'\"'");
  const { stdout } = await execAsync(`osascript -e '${escapedScript}'`, {
    timeout: 30000,
  });
  return stdout.trim();
}

async function sendPromptToClaude(prompt) {
  console.log(`Sending to Claude: "${prompt}"\n`);
  
  const escapedPrompt = prompt.replace(/"/g, '\\"');
  
  const script = `
    -- Check Claude is running
    tell application "System Events"
      if not (exists process "Claude") then
        error "Claude Desktop is not running"
      end if
    end tell
    
    -- Activate and send prompt
    tell application "Claude"
      activate
    end tell
    delay 1
    
    tell application "System Events"
      tell process "Claude"
        set frontmost to true
        delay 0.5
        
        -- Create new conversation
        keystroke "n" using command down
        delay 1.5
        
        -- Type and send
        keystroke "${escapedPrompt}"
        delay 0.5
        key code 36 -- return key
        
        return "Prompt sent successfully"
      end tell
    end tell
  `;
  
  try {
    const result = await runAppleScript(script);
    console.log(result);
    console.log('\nNote: Check Claude Desktop window to see the response');
    console.log('Response cannot be read programmatically due to Electron limitations');
  } catch (error) {
    console.error('Failed to send prompt:', error.message);
  }
}

// Test with a sample prompt
const testPrompt = process.argv[2] || "What is 2+2?";
sendPromptToClaude(testPrompt).catch(console.error);