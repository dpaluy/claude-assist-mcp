import { logger } from './logger.js';
import {
  ValidationError,
  AppleScriptError,
  ClaudeDesktopError,
  ErrorCode,
  getErrorMessage,
  isKnownError
} from './errors.js';

interface ErrorResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError: true;
}

export class ErrorHandler {
  static handle(error: unknown, context: string): ErrorResponse {
    // Log the error with appropriate level
    this.logError(error, context);

    // Get user-friendly error message
    const errorMessage = this.getUserFriendlyMessage(error, context);

    return {
      content: [{
        type: 'text',
        text: errorMessage
      }],
      isError: true
    };
  }

  private static logError(error: unknown, context: string): void {
    if (isKnownError(error)) {
      switch (error.code) {
        case ErrorCode.VALIDATION_FAILED:
        case ErrorCode.INVALID_INPUT:
        case ErrorCode.MISSING_REQUIRED_FIELD:
          logger.warn(`Validation error in ${context}:`, error.toJSON());
          break;

        case ErrorCode.CLAUDE_NOT_RUNNING:
        case ErrorCode.CLAUDE_WINDOW_NOT_FOUND:
          logger.info(`Claude Desktop not available in ${context}:`, error.message);
          break;

        default:
          logger.error(`Error in ${context}:`, error.toJSON());
      }
    } else {
      logger.error(`Unexpected error in ${context}:`, error);
    }
  }

  private static getUserFriendlyMessage(error: unknown, context: string): string {
    if (error instanceof ValidationError) {
      return `Invalid input${error.field ? ` for ${error.field}` : ''}: ${error.message}`;
    }

    if (error instanceof AppleScriptError) {
      switch (error.code) {
        case ErrorCode.APPLESCRIPT_TIMEOUT:
          return `Operation timed out while ${context}. Please try again.`;

        case ErrorCode.APPLESCRIPT_PERMISSION_DENIED:
          return `Permission denied. Please grant accessibility permissions to Claude Desktop in System Preferences > Security & Privacy > Privacy > Accessibility.`;

        default:
          return `AppleScript error: ${error.message}`;
      }
    }

    if (error instanceof ClaudeDesktopError) {
      switch (error.code) {
        case ErrorCode.CLAUDE_NOT_RUNNING:
          return 'Claude Desktop is not running. Please start Claude Desktop and try again.';

        case ErrorCode.CLAUDE_WINDOW_NOT_FOUND:
          return 'No Claude Desktop window found. Please ensure Claude Desktop is open with at least one window.';

        case ErrorCode.CLAUDE_RESPONSE_TIMEOUT:
          return 'Timed out waiting for Claude response. The message was sent but the response could not be captured.';

        case ErrorCode.CLAUDE_CONVERSATION_NOT_FOUND:
          return 'Specified conversation not found. Please check the conversation ID.';

        default:
          return `Claude Desktop error: ${error.message}`;
      }
    }

    // Generic error message
    return `Error in ${context}: ${getErrorMessage(error)}`;
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      retryDelay?: number;
      backoffMultiplier?: number;
      shouldRetry?: (error: unknown, attempt: number) => boolean;
      onRetry?: (error: unknown, attempt: number) => void;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      retryDelay = 1000,
      backoffMultiplier = 2,
      shouldRetry = (error) => !this.isNonRetryableError(error),
      onRetry
    } = options;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
          throw error;
        }

        const delay = retryDelay * Math.pow(backoffMultiplier, attempt - 1);

        if (onRetry) {
          onRetry(error, attempt);
        }

        logger.debug(`Retrying operation (attempt ${attempt + 1}/${maxAttempts}) after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private static isNonRetryableError(error: unknown): boolean {
    if (!isKnownError(error)) {
      return false;
    }

    // Don't retry validation errors
    if (error instanceof ValidationError) {
      return true;
    }

    // Don't retry permission errors
    if (error.code === ErrorCode.APPLESCRIPT_PERMISSION_DENIED) {
      return true;
    }

    // Don't retry if Claude is not running
    if (error.code === ErrorCode.CLAUDE_NOT_RUNNING) {
      return true;
    }

    return false;
  }
}
