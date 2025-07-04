export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  error(message: string, ...args: any[]) {
    if (this.level >= LogLevel.ERROR) {
      process.stderr.write(`[ERROR] ${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.level >= LogLevel.WARN) {
      process.stderr.write(`[WARN] ${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.level >= LogLevel.INFO) {
      process.stderr.write(`[INFO] ${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`);
    }
  }

  debug(message: string, ...args: any[]) {
    if (this.level >= LogLevel.DEBUG) {
      process.stderr.write(`[DEBUG] ${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`);
    }
  }
}

// Create a default logger - will be reconfigured when config loads
export let logger = new Logger(
  process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LogLevel.INFO
);

// Function to reconfigure logger with loaded config
export function configureLogger(level: LogLevel): void {
  logger = new Logger(level);
}
