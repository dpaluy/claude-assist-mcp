import { askClaude, getConversations } from '../tools/claude-desktop.js';
import { AskToolArgs, GetConversationsArgs } from '../tools/registry.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../utils/errors.js';

export interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export class ToolHandler {
  async handleAsk(args: AskToolArgs): Promise<ToolResponse> {
    try {
      logger.info('Handling ask request', { 
        hasConversationId: !!args.conversationId,
        timeout: args.timeout,
        pollingInterval: args.pollingInterval
      });

      // Validate prompt
      if (!args.prompt || args.prompt.trim().length === 0) {
        throw new ValidationError('Prompt cannot be empty', 'prompt');
      }

      // Convert seconds to milliseconds for internal use
      const pollingOptions = {
        timeout: (args.timeout || 30) * 1000,
        interval: (args.pollingInterval || 1.5) * 1000,
      };

      const result = await askClaude(
        args.prompt,
        args.conversationId,
        pollingOptions
      );

      return {
        content: [{
          type: 'text',
          text: result,
        }],
      };
    } catch (error) {
      return ErrorHandler.handle(error, 'ask');
    }
  }

  async handleGetConversations(_args: GetConversationsArgs): Promise<ToolResponse> {
    try {
      logger.info('Handling get conversations request');
      
      const result = await getConversations();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (error) {
      return ErrorHandler.handle(error, 'get_conversations');
    }
  }

  async handle(toolName: string, args: any): Promise<ToolResponse> {
    switch (toolName) {
      case 'ask':
        return this.handleAsk(args);
      
      case 'get_conversations':
        return this.handleGetConversations(args);
      
      default:
        throw new ValidationError(`Unknown tool: ${toolName}`, 'toolName');
    }
  }
}