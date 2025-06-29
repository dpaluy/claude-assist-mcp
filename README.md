# Claude Desktop MCP

A Model Context Protocol (MCP) server that enables Claude Code to communicate with Claude Desktop. This server allows Claude Code to send prompts to Claude Desktop and poll for responses.

Inspired by [claude-chatgpt-mcp](https://github.com/syedazharmbnr1/claude-chatgpt-mcp), this project adapts the concept for Apple's ecosystem using native macOS automation.

## Features

- Send prompts from Claude Code to Claude Desktop
- Automatic polling for responses with configurable timeout
- List available conversations in Claude Desktop
- Error handling and retry logic
- Comprehensive logging

## Installation

1. Clone this repository:
```bash
git clone https://github.com/dpaluy/claude-desktop-mcp
cd claude-desktop-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### Claude Desktop Configuration

Add the following to your Claude Desktop configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "claude-desktop": {
      "command": "node",
      "args": ["/path/to/claude-desktop-mcp/dist/index.js"]
    }
  }
}
```

### System Requirements

- macOS 11.0+ (Big Sur or later)
- Node.js 18+
- Claude Desktop app installed
- Accessibility permissions granted for AppleScript

### Granting Accessibility Permissions

1. Open System Preferences > Security & Privacy > Privacy
2. Select "Accessibility" from the left sidebar
3. Click the lock to make changes
4. Add Terminal (or your terminal app) to the allowed apps
5. Restart your terminal

## MCP Commands

This MCP server provides one main command:

### `claude_desktop`
General-purpose interaction with Claude Desktop app. Supports two operations:

#### `ask` operation
- **Purpose**: Send any prompt to Claude Desktop and get a response
- **Parameters**:
  - `operation`: "ask" (required)
  - `prompt`: The text to send to Claude Desktop (required)
  - `conversationId`: Optional ID to continue a specific conversation
  - `pollingOptions`: Optional timeout and interval settings

#### `get_conversations` operation
- **Purpose**: Retrieve a list of available Claude Desktop conversations
- **Parameters**:
  - `operation`: "get_conversations" (required)


## Usage

Once configured, Claude Code can use the MCP in various ways:

### General Purpose Usage

```typescript
// Ask Claude Desktop a question
const response = await mcp.callTool('claude_desktop', {
  operation: 'ask',
  prompt: 'Explain the concept of dependency injection in software engineering',
  pollingOptions: {
    timeout: 30000,
    interval: 2000
  }
});

// Get list of conversations
const conversations = await mcp.callTool('claude_desktop', {
  operation: 'get_conversations'
});
```

### Example in Claude Code

When using Claude Code, you can interact with Claude Desktop:

**General question:**
```
Ask Claude Desktop: What are the best practices for error handling in Python?
```

Claude Code will automatically use the MCP command to send your prompt to Claude Desktop.

## Development

### Running in Development Mode

```bash
npm run dev
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Type Checking

```bash
npm run typecheck
```

## API

### Tools

#### `claude_desktop`

General-purpose interaction with Claude Desktop.

**Parameters:**

- `operation` (required): "ask" or "get_conversations"
- `prompt` (string, required for "ask"): The prompt to send
- `conversationId` (string, optional): Continue a specific conversation
- `pollingOptions` (optional):
  - `timeout` (number): Max wait time in ms (default: 30000)
  - `interval` (number): Poll interval in ms (default: 2000)

**Response for "ask":**
```
String containing Claude's response
```

**Response for "get_conversations":**
```typescript
{
  conversations: string[];
  timestamp: string;
}
```

## Architecture

The MCP server uses AppleScript to communicate with Claude Desktop:

1. Claude Code sends a prompt via MCP
2. AppleScript activates Claude Desktop and creates a new conversation
3. The prompt is typed into Claude Desktop
4. The server polls Claude Desktop for the response
5. Once a response is detected, it's parsed and returned to Claude Code

## Troubleshooting

### Common Issues

1. **"AppleScript execution failed"**
   - Ensure Claude Desktop is installed and running
   - Check accessibility permissions
   - Try running the server with higher log level: `LOG_LEVEL=3`

2. **"Response timed out"**
   - Increase the timeout in polling options
   - Check if Claude Desktop is responding normally
   - Ensure the system isn't under heavy load

3. **"Permission denied"**
   - Grant accessibility permissions to your terminal
   - Run the build command with proper permissions

## License

MIT
