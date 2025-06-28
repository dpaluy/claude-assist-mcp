import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';

const execAsync = promisify(exec);

export interface AppleScriptOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class AppleScriptError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'AppleScriptError';
  }
}

export async function runAppleScript(
  script: string,
  options: AppleScriptOptions = {}
): Promise<string> {
  const { timeout = 30000, retries = 3, retryDelay = 1000 } = options;

  logger.debug('Running AppleScript:', script);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Escape single quotes in the script properly
      const escapedScript = script.replace(/'/g, "'\"'\"'");
      const { stdout, stderr } = await execAsync(`osascript -e '${escapedScript}'`, {
        timeout,
      });

      if (stderr) {
        logger.warn('AppleScript stderr:', stderr);
      }

      return stdout.trim();
    } catch (error: any) {
      logger.error(`AppleScript attempt ${attempt} failed:`, error);

      if (attempt === retries) {
        throw new AppleScriptError(
          `AppleScript execution failed after ${retries} attempts: ${error.message}`,
          error.code
        );
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw new AppleScriptError('AppleScript execution failed');
}

export function escapeAppleScriptString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}