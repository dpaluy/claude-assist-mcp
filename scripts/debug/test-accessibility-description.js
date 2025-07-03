#!/usr/bin/env node

/**
 * Debug script to test reading Claude Desktop responses using accessibility description
 * This tests the ChatGPT-style approach of using AXStaticText role and description property
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runAppleScript(script) {
  try {
    const escapedScript = script.replace(/'/g, "'\"'\"'");
    const { stdout, stderr } = await execAsync(`osascript -e '${escapedScript}'`, {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10
    });

    if (stderr) {
      console.error('AppleScript stderr:', stderr);
    }

    return stdout.trim();
  } catch (error) {
    console.error('AppleScript error:', error);
    throw error;
  }
}

async function testAccessibilityDescription() {
  console.log('Testing Claude Desktop accessibility description approach...\n');

  const script = `
    tell application "System Events"
      if not (exists process "Claude") then
        return "Error: Claude Desktop is not running"
      end if
    end tell

    tell application "Claude"
      activate
      delay 1

      tell application "System Events"
        tell process "Claude"
          if (count of windows) = 0 then
            return "Error: No Claude window"
          end if

          set frontWin to front window
          set messageTexts to {}
          set debugInfo to {}

          -- Method 1: Try AXStaticText role with description
          set allElements to entire contents of frontWin
          repeat with elem in allElements
            try
              if (role of elem) is "AXStaticText" then
                try
                  set txtDesc to (description of elem)
                  if txtDesc is not missing value and txtDesc is not "" then
                    set end of messageTexts to "DESC: " & txtDesc
                  end if
                on error
                  set end of debugInfo to "Failed to get description for AXStaticText"
                end try

                -- Also try value for comparison
                try
                  set txtVal to value of elem
                  if txtVal is not missing value and txtVal is not "" then
                    set end of messageTexts to "VAL: " & txtVal
                  end if
                end try
              end if
            end try
          end repeat

          -- Method 2: Try static text class
          repeat with elem in allElements
            try
              if class of elem is static text then
                set txtValue to value of elem
                if txtValue is not missing value and txtValue is not "" then
                  if txtValue is not in messageTexts then
                    set end of messageTexts to "STATIC: " & txtValue
                  end if
                end if
              end if
            end try
          end repeat

          -- Join results
          set AppleScript's text item delimiters to linefeed & "---" & linefeed
          set allText to messageTexts as text

          if (count of debugInfo) > 0 then
            set allText to allText & linefeed & linefeed & "DEBUG: " & (debugInfo as text)
          end if

          return allText
        end tell
      end tell
    end tell
  `;

  try {
    const result = await runAppleScript(script);
    console.log('Results:');
    console.log('========================================');
    console.log(result);
    console.log('========================================\n');

    // Analyze results
    const lines = result.split('\n');
    const descLines = lines.filter(l => l.startsWith('DESC:'));
    const valLines = lines.filter(l => l.startsWith('VAL:'));
    const staticLines = lines.filter(l => l.startsWith('STATIC:'));

    console.log(`\nAnalysis:`);
    console.log(`- Description properties found: ${descLines.length}`);
    console.log(`- Value properties found: ${valLines.length}`);
    console.log(`- Static text elements found: ${staticLines.length}`);

    if (descLines.length > 0) {
      console.log('\nSample descriptions:');
      descLines.slice(0, 3).forEach(line => console.log(`  ${line}`));
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testAccessibilityDescription().catch(console.error);
