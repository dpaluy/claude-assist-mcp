#!/usr/bin/env node

/**
 * Debug script to read Claude Desktop response after manual prompt
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runAppleScript(script) {
  const escapedScript = script.replace(/'/g, "'\"'\"'");
  const { stdout } = await execAsync(`osascript -e '${escapedScript}'`, {
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 10
  });
  return stdout.trim();
}

async function readClaudeResponse() {
  console.log('Reading Claude Desktop window content...\n');
  
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
                if class of elem is static text then
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
  
  try {
    const result = await runAppleScript(script);
    console.log('Claude Desktop Window Content:');
    console.log('=====================================');
    console.log(result);
    console.log('=====================================');
    console.log(`\nTotal text length: ${result.length} characters`);
    
    // Check if we found any response-like content
    if (result.includes('2 + 2') || result.includes('4') || result.includes('four')) {
      console.log('\n✅ Found response content!');
    } else {
      console.log('\n❌ No response content found');
    }
  } catch (error) {
    console.error('Failed to read:', error.message);
  }
}

readClaudeResponse().catch(console.error);