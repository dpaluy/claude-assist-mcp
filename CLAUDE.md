# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository implements a Model Context Protocol (MCP) server that enables Claude Desktop to interact with Apple applications on macOS, similar to the claude-chatgpt-mcp project but focused on Apple ecosystem integration.

## Development Commands

### Setup and Dependencies
```bash
# Install dependencies (when package.json is created)
npm install

# Install Bun runtime if not already installed (required for MCP)
curl -fsSL https://bun.sh/install | bash
```

### Build and Development
```bash
# Run the MCP server in development mode
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Lint the codebase
npm run lint

# Type check
npm run typecheck
```

### Testing Individual Components
```bash
# Test AppleScript integration
npm test -- --testPathPattern=applescript

# Test MCP server functionality
npm test -- --testPathPattern=server
```

## Architecture Overview

### Core Components

1. **MCP Server Implementation**
   - Location: `src/index.ts` or `src/server.ts`
   - Handles MCP protocol communication with Claude Desktop
   - Manages tool registration and execution

2. **AppleScript Integration Layer**
   - Location: `src/applescript/` or `src/integrations/apple/`
   - Provides robust AppleScript execution with error handling
   - Implements UI element targeting with fallback strategies
   - Handles dynamic response detection and stability checks

3. **Tool Definitions**
   - Location: `src/tools/`
   - Each Apple app integration is a separate tool
   - Tools follow MCP tool specification format

4. **Configuration Management**
   - Claude Desktop config: `claude_desktop_config.json`
   - MCP server config: `mcp.json` or similar
   - Environment-specific settings handling

### Key Technical Patterns

1. **AppleScript Robustness**
   - Always implement multiple UI element targeting approaches
   - Include intelligent error detection and recovery
   - Add text stability detection for dynamic content
   - Use timeout mechanisms for long-running operations

2. **MCP Protocol Implementation**
   - Follow the Model Context Protocol specification
   - Implement proper tool schemas with validation
   - Handle streaming responses appropriately
   - Ensure proper error propagation to Claude

3. **Cross-Application Communication**
   - Use AppleScript for native macOS app interaction
   - Implement proper activation and focus handling
   - Handle application state verification before operations

## Integration Points

### Claude Desktop Configuration
The project integrates with Claude Desktop through:
- MCP server registration in Claude Desktop config
- Tool definitions exposed via MCP protocol
- Proper error handling and user feedback

## Development Guidelines

1. **AppleScript Best Practices**
   - Always check if target application is running
   - Implement graceful degradation for missing UI elements
   - Use accessibility APIs where possible
   - Test on multiple macOS versions

2. **Error Handling**
   - Provide detailed error messages for debugging
   - Implement retry logic for transient failures
   - Log operations for troubleshooting
   - Fail gracefully with helpful user messages

3. **Security Considerations**
   - Request minimal necessary permissions
   - Validate all inputs before AppleScript execution
   - Avoid storing sensitive data
   - Implement rate limiting for operations

4. **Testing Strategy**
   - Unit tests for individual tool functions
   - Integration tests for AppleScript operations
   - Mock AppleScript responses for CI/CD
   - Manual testing on actual macOS systems

## Common Tasks

### Adding a New Apple App Integration
1. Create new tool file in `src/tools/`
2. Implement AppleScript interaction logic
3. Define MCP tool schema
4. Add tests for the new tool
5. Update tool registry/exports
6. Test with Claude Desktop

### Debugging AppleScript Issues
1. Test scripts directly in Script Editor first
2. Enable verbose logging in development
3. Check System Preferences > Security & Privacy > Accessibility
4. Use `console.log` or equivalent for script output
5. Implement detailed error catching and reporting

### Updating MCP Protocol
1. Check latest MCP specification
2. Update server implementation if needed
3. Test compatibility with Claude Desktop
4. Update tool schemas accordingly

## Performance Considerations

- Cache AppleScript compilation results
- Implement connection pooling for MCP
- Use async operations throughout
- Monitor and limit concurrent operations
- Implement request debouncing where appropriate

## Platform Requirements

- macOS 11.0+ (Big Sur or later)
- Apple Silicon (M1/M2/M3) or Intel Mac
- Node.js 18+ or Bun runtime
- Claude Desktop app installed
- Accessibility permissions granted
