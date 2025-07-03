export enum ErrorCode {
  // Validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // AppleScript errors
  APPLESCRIPT_EXECUTION_FAILED = 'APPLESCRIPT_EXECUTION_FAILED',
  APPLESCRIPT_TIMEOUT = 'APPLESCRIPT_TIMEOUT',
  APPLESCRIPT_PERMISSION_DENIED = 'APPLESCRIPT_PERMISSION_DENIED',

  // Claude Desktop errors
  CLAUDE_NOT_RUNNING = 'CLAUDE_NOT_RUNNING',
  CLAUDE_WINDOW_NOT_FOUND = 'CLAUDE_WINDOW_NOT_FOUND',
  CLAUDE_RESPONSE_TIMEOUT = 'CLAUDE_RESPONSE_TIMEOUT',
  CLAUDE_CONVERSATION_NOT_FOUND = 'CLAUDE_CONVERSATION_NOT_FOUND',

  // System errors
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export abstract class BaseError extends Error {
  public readonly code: ErrorCode;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(message: string, code: ErrorCode, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.context = context;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }
}

export class ValidationError extends BaseError {
  public readonly field?: string;

  constructor(message: string, field?: string, context?: Record<string, any>) {
    super(message, ErrorCode.VALIDATION_FAILED, { ...context, field });
    this.field = field;
  }
}

export class AppleScriptError extends BaseError {
  public readonly scriptError?: string;
  public readonly exitCode?: number;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.APPLESCRIPT_EXECUTION_FAILED,
    scriptError?: string,
    exitCode?: number,
    context?: Record<string, any>
  ) {
    super(message, code, { ...context, scriptError, exitCode });
    this.scriptError = scriptError;
    this.exitCode = exitCode;
  }
}

export class ClaudeDesktopError extends BaseError {
  public readonly operation?: string;

  constructor(
    message: string,
    code: ErrorCode,
    operation?: string,
    context?: Record<string, any>
  ) {
    super(message, code, { ...context, operation });
    this.operation = operation;
  }
}

export class SystemError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorCode.SYSTEM_ERROR, context);
  }
}

export function isKnownError(error: any): error is BaseError {
  return error instanceof BaseError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return 'Unknown error occurred';
}

export function getErrorCode(error: unknown): ErrorCode {
  if (isKnownError(error)) {
    return error.code;
  }

  return ErrorCode.UNKNOWN_ERROR;
}
