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

This MCP server provides two main commands:

### 1. `claude_desktop`
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

### 2. `request_code_review`
Specialized command for code review requests with structured prompting. This command:
- Uses a professional code review prompt template
- Supports different review types (security, performance, style, general)
- Formats the review request for comprehensive analysis
- Returns structured feedback with priorities

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

### Code Review Usage

```typescript
// Request a specialized code review
const response = await mcp.callTool('request_code_review', {
  request: {
    code: 'function add(a, b) { return a + b; }',
    language: 'javascript',
    context: 'Utility function for addition',
    reviewType: 'general'
  },
  pollingOptions: {
    timeout: 30000,
    interval: 2000
  }
});
```

### Example in Claude Code

When using Claude Code, you can interact with Claude Desktop in multiple ways:

**General question:**
```
Ask Claude Desktop: What are the best practices for error handling in Python?
```

**Code review request:**
```
Please perform a security review of this Python function:

def get_user_data(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    return db.execute(query)
```

Claude Code will automatically use the appropriate MCP command based on your request.

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

#### 1. `claude_desktop`

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

#### 2. `request_code_review`

Specialized code review with structured prompting.

**Parameters:**

- `request` (required):
  - `code` (string): The code to review
  - `language` (string, optional): Programming language
  - `context` (string, optional): Additional context
  - `reviewType` (string, optional): "general", "security", "performance", or "style"

- `pollingOptions` (optional):
  - `timeout` (number): Max wait time in ms (default: 30000)
  - `interval` (number): Poll interval in ms (default: 2000)

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
