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

## MCP Tools

This MCP server provides two tools:

### `ask`
- **Purpose**: Send a prompt to Claude Desktop and get a response
- **Parameters**:
  - `prompt`: The text to send to Claude Desktop (required)
  - `conversationId`: Optional ID to continue a specific conversation
  - `timeout`: Response timeout in seconds (optional, default: 30, max: 300)
  - `pollingInterval`: How often to check for response in seconds (optional, default: 1.5, min: 0.5)

### `get_conversations`
- **Purpose**: Get a list of available conversations in Claude Desktop
- **Parameters**: None


## Usage

Once configured, Claude Code can use the MCP in various ways:

### General Purpose Usage

When Claude uses these tools, it will call them with parameters like:

**Basic usage:**
- Tool: `ask`
- Parameters: `{ "prompt": "What is dependency injection?" }`

**With custom timeout:**
- Tool: `ask`
- Parameters: `{ "prompt": "Explain quantum computing", "timeout": 120 }`

**With both timeout and polling interval:**
- Tool: `ask`
- Parameters: `{ "prompt": "Quick question", "timeout": 10, "pollingInterval": 0.5 }`

**Get conversations:**
- Tool: `get_conversations`
- Parameters: `{}`

### How to Use in Claude

Once the MCP server is configured and running, you can use these tools directly in Claude:

**Basic usage:**
- "Use the ask tool to ask Claude Desktop: What are the best practices for error handling in Python?"
- "Use get_conversations to list all my Claude Desktop conversations"

**With custom timeout:**
- "Use the ask tool with timeout 60 to ask Claude Desktop: Explain B+ tree implementation"
- "Use ask with timeout 10 and pollingInterval 0.5 to ask Claude Desktop: What is 2+2?"

**Important:** The MCP server configuration (shown above) only tells Claude how to start the server. The timeout and pollingInterval parameters are specified when you use the tool in Claude, not in the server configuration file.

## Claude Commands Integration

Claude Commands allow you to create reusable workflows that combine MCP tools. This project works seamlessly with Claude Commands to enable powerful automation.

### Example: Code Peer Review Command

We've included an example Claude Command that demonstrates how to use MCP Claude Desktop for automated code reviews. The command uses git to analyze recent changes and sends them to Claude Desktop for peer review feedback.

#### Setup

1. Copy the example command to your Claude Commands directory:
   ```bash
   cp examples/claude-peer-review.md ~/.claude/commands/
   ```

2. The command will be available in Claude Code as `/claude-peer-review`

#### Usage

The peer review command accepts up to 3 arguments:
- **description**: What changes to review (e.g., "authentication fix")  
- **polling_interval**: How often to check for response (default: 1.5s)
- **timeout**: Maximum wait time for response (default: 30s)

Examples:
```bash
# Review most recent commit with defaults
/claude-peer-review

# Review with description
/claude-peer-review "bug fix for user login"

# Custom polling interval (2 seconds)
/claude-peer-review "API update" 2

# Custom timeout for complex reviews (2 minutes)
/claude-peer-review "major refactor" 1.5 120
```

#### How It Works

1. **Git Integration**: The command automatically fetches:
   - Current git status
   - Recent commit statistics
   - Full diff of changes
   - Current branch name

2. **Claude Desktop Review**: Sends the changes to Claude Desktop with specific review questions:
   - Code appropriateness and implementation quality
   - Security concerns or potential bugs
   - Code quality and best practices
   - Suggestions for improvements

3. **Response Handling**: Uses the MCP server's polling mechanism to wait for Claude's response

4. **Summary Generation**: Provides a structured summary of:
   - Changes reviewed
   - Claude's feedback
   - Actions taken based on feedback
   - Final review status

### Creating Your Own Commands

You can create custom Claude Commands that leverage MCP Claude Desktop. Commands should:

1. Include the tools in the frontmatter:
   ```yaml
   ---
   allowed-tools: mcp__claude-desktop__ask, mcp__claude-desktop__get_conversations
   ---
   ```

2. Use the MCP tools with appropriate parameters:
   ```
   mcp__claude-desktop__ask
   prompt: "Your prompt here"
   timeout: 60
   pollingInterval: 2
   ```

3. Handle timeouts gracefully and suggest longer timeouts for complex queries

See the [example command](examples/claude-peer-review.md) for a complete implementation.

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

#### `ask`

Send a prompt to Claude Desktop and get a response.

**Parameters:**

- `prompt` (string, required): The prompt to send
- `conversationId` (string, optional): Continue a specific conversation
- `timeout` (number, optional): Response timeout in seconds
  - Default: 30 seconds
  - Minimum: 1 second
  - Maximum: 300 seconds (5 minutes)
- `pollingInterval` (number, optional): How often to check for response in seconds
  - Default: 1.5 seconds
  - Minimum: 0.5 seconds
  - Maximum: 10 seconds

**Response:**
```
String containing Claude's response
```

#### `get_conversations`

Get a list of available conversations in Claude Desktop.

**Parameters:** None

**Response:**
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
   - Increase the timeout parameter: `timeout: 60` (60 seconds)
   - For complex queries, use longer timeouts: `timeout: 120` (2 minutes)
   - Reduce polling interval for faster detection: `pollingInterval: 0.5`
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
