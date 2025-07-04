#!/usr/bin/env node

import { runAppleScript } from 'run-applescript';

console.log('🔍 Testing Claude Desktop UI element reading...\n');

const script = `
tell application "Claude"
  activate
  delay 2
  
  tell application "System Events"
    tell process "Claude"
      set allInfo to {}
      
      -- First, let's see what windows we have
      set windowCount to count of windows
      set end of allInfo to "Window count: " & windowCount
      
      if windowCount > 0 then
        set frontWin to front window
        
        -- Try different ways to get text
        set end of allInfo to "\\n--- Method 1: Static texts by role ---"
        set textCount to 0
        set allElements to entire contents of frontWin
        repeat with elem in allElements
          try
            if (role of elem) is "AXStaticText" then
              set textCount to textCount + 1
              set txtValue to description of elem
              if txtValue is not missing value and txtValue is not "" then
                set end of allInfo to "Text " & textCount & " (description): " & txtValue
              end if
            end if
          end try
        end repeat
        
        set end of allInfo to "\\n--- Method 2: Try value instead of description ---"
        set valueCount to 0
        repeat with elem in allElements
          try
            if (role of elem) is "AXStaticText" then
              set valueCount to valueCount + 1
              set txtValue to value of elem
              if txtValue is not missing value and txtValue is not "" then
                set end of allInfo to "Text " & valueCount & " (value): " & txtValue
              end if
            end if
          end try
        end repeat
        
        set end of allInfo to "\\n--- Method 3: All UI element types ---"
        set typeList to {}
        repeat with elem in allElements
          try
            set elemRole to role of elem
            if elemRole is not in typeList then
              set end of typeList to elemRole
            end if
          end try
        end repeat
        set end of allInfo to "UI Element types found: " & (typeList as string)
        
        -- Try to get text from specific UI elements
        set end of allInfo to "\\n--- Method 4: Text from text areas ---"
        try
          set textAreas to text areas of frontWin
          set end of allInfo to "Text area count: " & (count of textAreas)
          repeat with ta in textAreas
            try
              set taValue to value of ta
              if taValue is not missing value and taValue is not "" then
                set end of allInfo to "Text area content: " & taValue
              end if
            end try
          end repeat
        end try
        
      end if
      
      -- Join all info
      set AppleScript's text item delimiters to linefeed
      return allInfo as text
    end tell
  end tell
end tell
`;

async function testUIElements() {
  try {
    console.log('Running AppleScript to inspect Claude Desktop UI...\n');
    const result = await runAppleScript(script);
    console.log('Results:\n');
    console.log(result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testUIElements();