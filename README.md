# MCP Claude Desktop

A Model Context Protocol (MCP) server that enables Claude Code to communicate with Claude Desktop. This server allows Claude Code to send prompts to Claude Desktop and poll for responses.

Inspired by [claude-chatgpt-mcp](https://github.com/syedazharmbnr1/claude-chatgpt-mcp), this project adapts the concept for Apple's ecosystem using native macOS automation.

## Features

- Send prompts from Claude Code to Claude Desktop
- Automatic polling for responses with configurable timeout
- List available conversations in Claude Desktop
- Error handling and retry logic
- Comprehensive logging

## Installation

You can install and use this MCP server in two ways:

### Option 1: Using npx (Recommended)

The simplest way to use this server is directly with npx, without any installation:

```json
{
  "mcpServers": {
    "claude-desktop": {
      "command": "npx",
      "args": ["mcp-claude-desktop"]
    }
  }
}
```

### Option 2: Local Installation

1. Clone this repository:
```bash
git clone https://github.com/dpaluy/mcp-claude-desktop
cd mcp-claude-desktop
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Configure MCP:

```json
{
  "mcpServers": {
    "claude-desktop": {
      "command": "node",
      "args": ["/path/to/mcp-claude-desktop/dist/index.js"]
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
  - `timeout`: Response timeout in milliseconds (optional, default: 30000, max: 300000)
  - `pollingInterval`: How often to check for response in milliseconds (optional, default: 1500, min: 500)
  - `pollingOptions`: Advanced polling configuration (optional, overrides timeout/pollingInterval)

#### `get_conversations` operation
- **Purpose**: Retrieve a list of available Claude Desktop conversations
- **Parameters**:
  - `operation`: "get_conversations" (required)


## Usage

Once configured, Claude Code can use the MCP in various ways:

### General Purpose Usage

```typescript
// Ask Claude Desktop a question with default timeout (30s)
const response = await mcp.callTool('claude_desktop', {
  operation: 'ask',
  prompt: 'Explain the concept of dependency injection in software engineering'
});

// Ask with a shorter timeout for quick responses (10s)
const quickResponse = await mcp.callTool('claude_desktop', {
  operation: 'ask',
  prompt: 'What is 2+2?',
  timeout: 10000,
  pollingInterval: 500  // Check every 500ms
});

// Ask with a longer timeout for complex questions (2 minutes)
const complexResponse = await mcp.callTool('claude_desktop', {
  operation: 'ask',
  prompt: 'Write a detailed analysis of quantum computing applications',
  timeout: 120000  // 2 minutes
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
- `timeout` (number, optional): Response timeout in milliseconds
  - Default: 30000 (30 seconds)
  - Minimum: 1000 (1 second)
  - Maximum: 300000 (5 minutes)
- `pollingInterval` (number, optional): How often to check for response
  - Default: 1500 (1.5 seconds)
  - Minimum: 500 (0.5 seconds)
  - Maximum: 10000 (10 seconds)
- `pollingOptions` (optional): Advanced configuration (overrides timeout/pollingInterval)
  - `timeout` (number): Max wait time in ms
  - `interval` (number): Poll interval in ms

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
   - Increase the timeout parameter: `timeout: 60000` (60 seconds)
   - For complex queries, use longer timeouts: `timeout: 120000` (2 minutes)
   - Reduce polling interval for faster detection: `pollingInterval: 500`
   - Check if Claude Desktop is responding normally
   - Ensure the system isn't under heavy load

3. **"Permission denied"**
   - Grant accessibility permissions to your terminal
   - Run the build command with proper permissions

## Contributing

We welcome contributions to MCP Claude Desktop! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-claude-desktop
   cd mcp-claude-desktop
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Workflow

1. Make your changes
2. Run tests to ensure everything works:
   ```bash
   npm test
   ```
3. Run linting to maintain code quality:
   ```bash
   npm run lint
   ```
4. Run type checking:
   ```bash
   npm run typecheck
   ```
5. Build the project:
   ```bash
   npm run build
   ```

### Code Style Guidelines

- Use TypeScript for all source code
- Follow the existing code style (enforced by ESLint)
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

### Submitting Changes

1. Commit your changes with a descriptive message:
   ```bash
   git commit -m "feat: add support for conversation history"
   ```
2. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
3. Create a Pull Request on GitHub

### Pull Request Guidelines

- Provide a clear description of the changes
- Reference any related issues
- Ensure all tests pass
- Update README if adding new features
- Be responsive to code review feedback

### Reporting Issues

- Use GitHub Issues to report bugs
- Include macOS version and Node.js version
- Provide steps to reproduce the issue
- Include relevant error messages or logs

### Feature Requests

- Open an issue to discuss new features
- Explain the use case and benefits
- Be open to feedback and alternative approaches

## License

MIT
