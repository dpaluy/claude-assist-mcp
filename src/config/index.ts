import { LogLevel } from '../utils/logger.js';

export interface Config {
  server: {
    name: string;
    version: string;
  };

  logging: {
    level: LogLevel;
  };

  polling: {
    defaultTimeout: number;      // in milliseconds
    defaultInterval: number;     // in milliseconds
    maxTimeout: number;          // in milliseconds
    maxInterval: number;         // in milliseconds
    minInterval: number;         // in milliseconds
    requiredStableChecks: number;
  };

  applescript: {
    maxBuffer: number;           // in bytes
    timeout: number;             // in milliseconds
    retries: number;
    retryDelay: number;          // in milliseconds
    maxScriptLength: number;     // in characters
    maxStringLength: number;     // in characters
  };

  claude: {
    activationDelay: number;     // in milliseconds
    windowCheckRetries: number;
    windowCheckDelay: number;    // in milliseconds
    responseStartDelay: number;  // in milliseconds
  };

  limits: {
    maxPromptLength: number;     // in characters
    maxConversationIdLength: number;
  };
}

// Default configuration
const defaultConfig: Config = {
  server: {
    name: 'mcp-claude-desktop',
    version: '1.0.0', // Will be overridden by package.json version
  },

  logging: {
    level: LogLevel.INFO,
  },

  polling: {
    defaultTimeout: 30000,       // 30 seconds
    defaultInterval: 1500,       // 1.5 seconds
    maxTimeout: 300000,          // 5 minutes
    maxInterval: 10000,          // 10 seconds
    minInterval: 500,            // 0.5 seconds
    requiredStableChecks: 2,
  },

  applescript: {
    maxBuffer: 10 * 1024 * 1024, // 10MB
    timeout: 30000,              // 30 seconds
    retries: 3,
    retryDelay: 1000,            // 1 second
    maxScriptLength: 50000,
    maxStringLength: 10000,
  },

  claude: {
    activationDelay: 1000,       // 1 second
    windowCheckRetries: 10,
    windowCheckDelay: 500,       // 0.5 seconds
    responseStartDelay: 3500,    // 3.5 seconds
  },

  limits: {
    maxPromptLength: 10000,
    maxConversationIdLength: 100,
  },
};

// Environment variable configuration overrides
function loadEnvironmentConfig(): Partial<Config> {
  const envConfig: Partial<Config> = {};

  // Logging level
  if (process.env.LOG_LEVEL) {
    const level = parseInt(process.env.LOG_LEVEL);
    if (!isNaN(level) && level >= LogLevel.ERROR && level <= LogLevel.DEBUG) {
      envConfig.logging = { level };
    }
  }

  // Initialize partial config objects
  const pollingOverrides: Partial<Config['polling']> = {};
  const applescriptOverrides: Partial<Config['applescript']> = {};

  // Polling configuration
  if (process.env.CLAUDE_POLLING_TIMEOUT) {
    const timeout = parseInt(process.env.CLAUDE_POLLING_TIMEOUT);
    if (!isNaN(timeout) && timeout > 0) {
      pollingOverrides.defaultTimeout = timeout;
    }
  }

  if (process.env.CLAUDE_POLLING_INTERVAL) {
    const interval = parseInt(process.env.CLAUDE_POLLING_INTERVAL);
    if (!isNaN(interval) && interval > 0) {
      pollingOverrides.defaultInterval = interval;
    }
  }

  // Only add polling config if we have overrides
  if (Object.keys(pollingOverrides).length > 0) {
    envConfig.polling = pollingOverrides as any;
  }

  // AppleScript configuration
  if (process.env.APPLESCRIPT_RETRIES) {
    const retries = parseInt(process.env.APPLESCRIPT_RETRIES);
    if (!isNaN(retries) && retries > 0) {
      applescriptOverrides.retries = retries;
    }
  }

  // Only add applescript config if we have overrides
  if (Object.keys(applescriptOverrides).length > 0) {
    envConfig.applescript = applescriptOverrides as any;
  }

  return envConfig;
}

// Merge configurations
function mergeConfig(base: Config, override: Partial<Config>): Config {
  return {
    server: { ...base.server, ...(override.server || {}) },
    logging: { ...base.logging, ...(override.logging || {}) },
    polling: { ...base.polling, ...(override.polling || {}) },
    applescript: { ...base.applescript, ...(override.applescript || {}) },
    claude: { ...base.claude, ...(override.claude || {}) },
    limits: { ...base.limits, ...(override.limits || {}) },
  };
}

// Create and export the configuration
export const config: Config = mergeConfig(defaultConfig, loadEnvironmentConfig());

// Configuration validation
export function validateConfig(cfg: Config): void {
  // Validate polling configuration
  if (cfg.polling.defaultTimeout <= 0) {
    throw new Error('Polling timeout must be positive');
  }

  if (cfg.polling.defaultInterval <= 0) {
    throw new Error('Polling interval must be positive');
  }

  if (cfg.polling.minInterval > cfg.polling.defaultInterval) {
    throw new Error('Minimum interval cannot be greater than default interval');
  }

  if (cfg.polling.defaultInterval > cfg.polling.maxInterval) {
    throw new Error('Default interval cannot be greater than maximum interval');
  }

  // Validate AppleScript configuration
  if (cfg.applescript.retries < 1) {
    throw new Error('AppleScript retries must be at least 1');
  }

  if (cfg.applescript.maxBuffer <= 0) {
    throw new Error('AppleScript max buffer must be positive');
  }

  // Validate limits
  if (cfg.limits.maxPromptLength <= 0) {
    throw new Error('Max prompt length must be positive');
  }
}

// Export a function to update configuration (useful for testing)
export function updateConfig(updates: Partial<Config>): void {
  Object.assign(config, mergeConfig(config, updates));
  validateConfig(config);
}
