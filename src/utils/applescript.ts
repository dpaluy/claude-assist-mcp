import { runAppleScript as runAppleScriptLib } from 'run-applescript';
import { logger } from './logger.js';
import { AppleScriptError as AppleScriptErrorClass, ErrorCode } from './errors.js';

export interface AppleScriptOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

// Re-export for backward compatibility
export const AppleScriptError = AppleScriptErrorClass;

export async function runAppleScript(
  script: string,
  options: AppleScriptOptions = {}
): Promise<string> {
  const { timeout = 30000, retries = 3, retryDelay = 1000 } = options;

  logger.debug('Running AppleScript:', script);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Validate script
      if (!script.trim()) {
        throw new AppleScriptErrorClass(
          'Script cannot be empty',
          ErrorCode.INVALID_INPUT
        );
      }

      if (script.length > 50000) {
        throw new AppleScriptErrorClass(
          'Script too long',
          ErrorCode.INVALID_INPUT
        );
      }

      // Use run-applescript package which handles escaping and execution properly
      // Add timeout wrapper to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AppleScript execution timeout')), timeout);
      });
      
      const result = await Promise.race([
        runAppleScriptLib(script),
        timeoutPromise
      ]);
      
      return result.trim();
    } catch (error: any) {
      logger.error(`AppleScript attempt ${attempt} failed:`, error);

      if (attempt === retries) {
        // Parse error number from AppleScript error message if present
        let appleScriptErrorNumber: number | undefined;
        const errorMatch = error.message?.match(/\((\d+)\)$/);
        if (errorMatch) {
          appleScriptErrorNumber = parseInt(errorMatch[1]);
        }

        // Determine appropriate error code based on error type
        let errorCode = ErrorCode.APPLESCRIPT_EXECUTION_FAILED;
        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
          errorCode = ErrorCode.APPLESCRIPT_TIMEOUT;
        } else if (error.message?.includes('is not allowed to send keystrokes')) {
          // More specific check for actual permission errors
          errorCode = ErrorCode.APPLESCRIPT_PERMISSION_DENIED;
        }

        const scriptError = new AppleScriptErrorClass(
          `AppleScript execution failed after ${retries} attempts: ${error.message}`,
          errorCode,
          error.message,
          error.code
        );
        
        // Add the parsed error number to the error object
        if (appleScriptErrorNumber) {
          (scriptError as any).appleScriptErrorNumber = appleScriptErrorNumber;
        }
        
        throw scriptError;
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw new AppleScriptErrorClass(
    'AppleScript execution failed',
    ErrorCode.APPLESCRIPT_EXECUTION_FAILED
  );
}

export function escapeAppleScriptString(str: string): string {
  // Validate input
  if (typeof str !== 'string') {
    throw new AppleScriptErrorClass(
      'Input must be a string',
      ErrorCode.INVALID_INPUT
    );
  }

  // Security check for script injection attempts
  const maxLength = 10000;
  if (str.length > maxLength) {
    throw new AppleScriptErrorClass(
      `String too long (${str.length} chars, max ${maxLength})`,
      ErrorCode.INVALID_INPUT
    );
  }

  // With run-applescript, we only need to escape double quotes and backslashes
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}
