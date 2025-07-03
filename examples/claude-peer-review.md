---
allowed-tools: Bash(git *), mcp__claude-desktop__ask, mcp__claude-desktop__get_conversations
description: Get peer review feedback using Claude Desktop for code changes
---

## Context
- Current git status: !`git status`
- Recent commit diff: !`git show HEAD --stat`
- Detailed changes: !`git diff HEAD~1 HEAD`
- Current branch: !`git branch --show-current`

## Your task
Get peer review feedback on recent code changes using Claude Desktop. Follow these steps:

1. **Parse arguments**:
   - Extract description, polling_interval, and timeout from `$ARGUMENTS`
   - Default values: polling_interval=1.5s, timeout=30s
   - If only one argument provided, treat it as description
   - If two arguments, second is polling_interval
   - If three arguments, third is timeout

2. **Analyze the changes**:
   - Review the git diff output from the context above
   - Identify the scope and nature of the changes
   - Prepare a clear description of what was changed and why

3. **Submit to Claude Desktop for review**:
   First, submit the review request using the MCP Claude Desktop tool:
   ```
   mcp__claude-desktop__ask
   prompt: Please review this git diff for [brief description of change]:

   <diff>
   [Include the full git diff output from context]
   </diff>

   Description: [Detailed explanation of what the change does and why it was made]

   Questions for review:
   - Are these changes appropriate and well-implemented?
   - Any security concerns or potential bugs?
   - Code quality and best practices feedback?
   - Suggestions for improvements?
   pollingInterval: [polling_interval value]
   timeout: [timeout value]
   ```

   **Polling Protocol**:
   - The tool will automatically poll at the specified interval
   - Maximum total wait time: [timeout] seconds
   - If timeout occurs, notify user: "Claude Desktop response timed out after [timeout] seconds. Try with longer timeout: /claude-peer-review \"description\" [polling_interval] [longer_timeout]"

4. **Process the feedback**:
   - Once response is received, review Claude's feedback carefully
   - Address any critical issues or suggestions
   - Make additional commits if changes are needed
   - Document any decisions to skip certain feedback

5. **Complete the review**:
   - Summarize the peer review process
   - Note any changes made based on feedback
   - Mark the peer review as complete

## Arguments
The `$ARGUMENTS` variable can contain up to 3 space-separated values:
1. **description** (optional): What changes to review (e.g., "authentication fix" or "R2 storage issue")
2. **polling_interval** (optional, default 1.5s): Polling interval in seconds (min 0.5, max 10)
3. **timeout** (optional, default 30s): Maximum wait time in seconds for Claude response (max 300)

### Usage Examples:
- `/claude-peer-review` → Reviews most recent commit with default timing
- `/claude-peer-review "R2 storage fix"` → Reviews changes with description
- `/claude-peer-review "authentication update" 2` → 2s polling interval, 30s timeout
- `/claude-peer-review "bug fix" 1.5 60` → 1.5s polling, 1-minute timeout

## Expected Output
Provide a summary in this format:

```markdown
## Peer Review Summary

### Changes Reviewed
- [Description of what was reviewed]

### Claude Desktop Feedback
- [Key points from the review]

### Actions Taken
- [Any changes made based on feedback]
- [Any feedback deliberately not addressed with reasons]

### Review Status
✅ Peer review completed
```

## Example Usage
```bash
# Review with default timing (1.5s polling, 30s timeout)
/claude-peer-review "R2 storage bug fix"

# Review with 2-second polling interval
/claude-peer-review "authentication update" 2

# Review with 1s polling and 2-minute timeout for complex changes
/claude-peer-review "major refactoring" 1 120

# Simple review of most recent commit
/claude-peer-review

# Check available conversations before starting
mcp__claude-desktop__get_conversations
```

## Notes
- Claude Desktop must be running and accessible via MCP
- The mcp-claude-desktop server must be configured in your .mcp.json
- This creates a new conversation in Claude Desktop for each review
- You can continue existing conversations by providing a conversationId