#!/usr/bin/env node

/**
 * Debug script to test Claude Desktop UI accessibility
 * This demonstrates the limitations of reading Claude Desktop responses
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runAppleScript(script) {
  try {
    const escapedScript = script.replace(/'/g, "'\"'\"'");
    const { stdout, stderr } = await execAsync(`osascript -e '${escapedScript}'`, {
      timeout: 30000,
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

async function testClaudeUI() {
  console.log('Testing Claude Desktop UI accessibility...\n');
  
  // Test 1: Check if Claude is running
  console.log('1. Checking Claude process...');
  const checkScript = `
    tell application "System Events"
      if exists process "Claude" then
        return "Claude is running"
      else
        return "Claude is not running"
      end if
    end tell
  `;
  console.log(await runAppleScript(checkScript));
  
  // Test 2: Check window availability
  console.log('\n2. Checking window availability...');
  const windowScript = `
    tell application "System Events"
      tell process "Claude"
        return "Window count: " & (count of windows)
      end tell
    end tell
  `;
  try {
    console.log(await runAppleScript(windowScript));
  } catch (e) {
    console.log('No windows accessible');
  }
  
  // Test 3: List UI elements
  console.log('\n3. Available UI elements:');
  const uiScript = `
    tell application "System Events"
      tell process "Claude"
        tell front window
          set elementTypes to {}
          try
            set end of elementTypes to "Buttons: " & (count of buttons)
            set end of elementTypes to "Text fields: " & (count of text fields)
            set end of elementTypes to "Text areas: " & (count of text areas)
            set end of elementTypes to "Groups: " & (count of groups)
            set end of elementTypes to "Static texts: " & (count of static texts)
          end try
          return elementTypes as string
        end tell
      end tell
    end tell
  `;
  try {
    console.log(await runAppleScript(uiScript));
  } catch (e) {
    console.log('Cannot access UI elements');
  }
  
  console.log('\nConclusion: Claude Desktop (Electron app) does not expose text areas through accessibility APIs');
}

testClaudeUI().catch(console.error);