import { ErrorHandler } from '../../src/utils/error-handler';
import { ValidationError, ClaudeDesktopError, ErrorCode } from '../../src/utils/errors';
import { logger } from '../../src/utils/logger';

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }
}));

describe('ErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handle', () => {
    it('should handle validation errors', () => {
      const error = new ValidationError('Invalid email', 'email');
      const result = ErrorHandler.handle(error, 'test-context');

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Invalid input for email: Invalid email'
        }],
        isError: true
      });

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle Claude Desktop errors', () => {
      const error = new ClaudeDesktopError(
        'Claude is not running',
        ErrorCode.CLAUDE_NOT_RUNNING,
        'askClaude'
      );
      const result = ErrorHandler.handle(error, 'test-context');

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Claude Desktop is not running. Please start Claude Desktop and try again.'
        }],
        isError: true
      });

      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle unknown errors', () => {
      const error = new Error('Something went wrong');
      const result = ErrorHandler.handle(error, 'test-context');

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Error in test-context: Something went wrong'
        }],
        isError: true
      });

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('withRetry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'Success';
      });

      const result = await ErrorHandler.withRetry(operation, {
        maxAttempts: 3,
        retryDelay: 10,
      });

      expect(result).toBe('Success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry validation errors', async () => {
      const operation = jest.fn(async () => {
        throw new ValidationError('Invalid input');
      });

      await expect(ErrorHandler.withRetry(operation, {
        maxAttempts: 3,
        retryDelay: 10,
      })).rejects.toThrow(ValidationError);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      let attempts = 0;
      const operation = jest.fn(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return 'Success';
      });

      const onRetry = jest.fn();

      await ErrorHandler.withRetry(operation, {
        maxAttempts: 3,
        retryDelay: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Error),
        1
      );
    });
  });
});
