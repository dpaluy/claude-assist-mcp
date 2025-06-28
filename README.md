# Claude Assist MCP

A Model Context Protocol (MCP) server that enables Claude Code to communicate with Claude Desktop for code reviews. This server allows Claude Code to send code review requests to Claude Desktop and poll for responses.

Inspired by [claude-chatgpt-mcp](https://github.com/syedazharmbnr1/claude-chatgpt-mcp), this project adapts the concept for Apple's ecosystem using native macOS automation.

## Features

- Send code review requests from Claude Code to Claude Desktop
- Automatic polling for responses with configurable timeout
- Support for different review types (general, security, performance, style)
- Language-specific code formatting
- Error handling and retry logic
- Comprehensive logging

## Installation

1. Clone this repository:
```bash
git clone https://github.com/dpaluy/claude-assist-mcp
cd claude-apple-mcp
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
    "claude-assist": {
      "command": "node",
      "args": ["/path/to/claude-apple-mcp/dist/index.js"],
      "env": {
        "LOG_LEVEL": "2"
      }
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

This MCP server provides the following command:

### `request_code_review`
Send a code review request to Claude Desktop and wait for the response. This command automates the process of:
- Opening Claude Desktop
- Creating a new conversation
- Submitting the code for review
- Polling for and returning the response

## Usage

Once configured, Claude Code can use the MCP to request code reviews:

```typescript
// Example usage in Claude Code
const response = await mcp.callTool('request_code_review', {
  request: {
    code: 'function add(a, b) { return a + b; }',
    language: 'javascript',
    context: 'Utility function for addition',
    reviewType: 'general'
  },
  pollingOptions: {
    timeout: 30000,  // 30 seconds
    interval: 2000   // Poll every 2 seconds
  }
});
```

### Example in Claude Code

When using Claude Code, you can request a code review like this:

```
Please review this TypeScript function using Claude Desktop:

function calculateDiscount(price: number, discountPercent: number): number {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Invalid discount percentage');
  }
  return price * (1 - discountPercent / 100);
}
```

Claude Code will automatically use the MCP server to send this request to Claude Desktop and return the review.

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

#### `request_code_review`

Sends a code review request to Claude Desktop.

**Parameters:**

- `request` (required):
  - `code` (string): The code to review
  - `language` (string, optional): Programming language
  - `context` (string, optional): Additional context
  - `reviewType` (string, optional): Type of review (general, security, performance, style)

- `pollingOptions` (optional):
  - `timeout` (number): Max time to wait for response in ms (default: 30000)
  - `interval` (number): Polling interval in ms (default: 2000)

**Response:**

```typescript
{
  reviewId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  review?: string;
  suggestions?: string[];
  timestamp: string;
}
```

## Architecture

The MCP server uses AppleScript to communicate with Claude Desktop:

1. Claude Code sends a review request via MCP
2. The server generates a unique review ID
3. AppleScript activates Claude Desktop and creates a new conversation
4. The review request is typed into Claude Desktop
5. The server polls Claude Desktop for the response
6. Once a response is detected, it's parsed and returned to Claude Code

## Troubleshooting

### Common Issues

1. **"AppleScript execution failed"**
   - Ensure Claude Desktop is installed and running
   - Check accessibility permissions
   - Try running the server with higher log level: `LOG_LEVEL=3`

2. **"Code review timed out"**
   - Increase the timeout in polling options
   - Check if Claude Desktop is responding normally
   - Ensure the system isn't under heavy load

3. **"Permission denied"**
   - Grant accessibility permissions to your terminal
   - Run the build command with proper permissions

## License

MIT
