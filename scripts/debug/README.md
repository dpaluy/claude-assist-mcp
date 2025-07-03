# Debug Scripts

This directory contains debugging scripts used to investigate Claude Desktop's UI accessibility limitations.

## Scripts

### test-claude-ui.js
Tests Claude Desktop's UI element accessibility through AppleScript. This script demonstrates that Claude Desktop (being an Electron app) doesn't expose standard text areas or text fields through macOS accessibility APIs.

```bash
node scripts/debug/test-claude-ui.js
```

### test-send-prompt.js
Tests sending prompts to Claude Desktop. Shows that sending prompts works correctly, but reading responses is not possible.

```bash
node scripts/debug/test-send-prompt.js "Your prompt here"
```

## Key Findings

1. **Claude Desktop is an Electron app** that doesn't expose text content through standard accessibility APIs
2. **Sending prompts works** via keyboard automation (Cmd+N for new chat, typing, Enter)
3. **Reading responses fails** because the text content is rendered in a web view not accessible via AppleScript
4. **Window detection works** but only shows basic UI elements (buttons, groups) not text content

## Implications for MCP

Due to these limitations, the MCP integration can:
- ✅ Send prompts to Claude Desktop
- ✅ Create new conversations
- ✅ Detect if Claude is running
- ❌ Read Claude's responses

For bidirectional communication, users should use Claude's API directly instead of desktop automation.