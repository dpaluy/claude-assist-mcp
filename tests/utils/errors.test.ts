import {
  ValidationError,
  AppleScriptError,
  ClaudeDesktopError,
  ErrorCode,
  isKnownError,
  getErrorMessage,
  getErrorCode
} from '../../src/utils/errors';

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create a validation error with field', () => {
      const error = new ValidationError('Invalid input', 'username');

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.field).toBe('username');
      expect(error.name).toBe('ValidationError');
    });

    it('should serialize to JSON correctly', () => {
      const error = new ValidationError('Invalid input', 'email');
      const json = error.toJSON();

      expect(json.name).toBe('ValidationError');
      expect(json.message).toBe('Invalid input');
      expect(json.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(json.context?.field).toBe('email');
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('AppleScriptError', () => {
    it('should create an AppleScript error', () => {
      const error = new AppleScriptError(
        'Script failed',
        ErrorCode.APPLESCRIPT_TIMEOUT,
        'Timeout error',
        124
      );

      expect(error.message).toBe('Script failed');
      expect(error.code).toBe(ErrorCode.APPLESCRIPT_TIMEOUT);
      expect(error.scriptError).toBe('Timeout error');
      expect(error.exitCode).toBe(124);
    });
  });

  describe('ClaudeDesktopError', () => {
    it('should create a Claude Desktop error', () => {
      const error = new ClaudeDesktopError(
        'Claude not running',
        ErrorCode.CLAUDE_NOT_RUNNING,
        'askClaude'
      );

      expect(error.message).toBe('Claude not running');
      expect(error.code).toBe(ErrorCode.CLAUDE_NOT_RUNNING);
      expect(error.operation).toBe('askClaude');
    });
  });

  describe('Error Utilities', () => {
    it('should identify known errors', () => {
      const validationError = new ValidationError('Test');
      const regularError = new Error('Test');

      expect(isKnownError(validationError)).toBe(true);
      expect(isKnownError(regularError)).toBe(false);
    });

    it('should extract error messages', () => {
      expect(getErrorMessage(new Error('Test error'))).toBe('Test error');
      expect(getErrorMessage('String error')).toBe('String error');
      expect(getErrorMessage({ message: 'Object error' })).toBe('Object error');
      expect(getErrorMessage(null)).toBe('Unknown error occurred');
      expect(getErrorMessage(undefined)).toBe('Unknown error occurred');
    });

    it('should get error codes', () => {
      const knownError = new ValidationError('Test');
      const unknownError = new Error('Test');

      expect(getErrorCode(knownError)).toBe(ErrorCode.VALIDATION_FAILED);
      expect(getErrorCode(unknownError)).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });
});
