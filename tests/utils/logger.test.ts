import { Logger, LogLevel } from '../../src/utils/logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('with INFO level', () => {
    beforeEach(() => {
      logger = new Logger(LogLevel.INFO);
    });

    test('should log errors', () => {
      logger.error('Test error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Test error');
    });

    test('should log warnings', () => {
      logger.warn('Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] Test warning');
    });

    test('should log info', () => {
      logger.info('Test info');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[INFO] Test info');
    });

    test('should not log debug', () => {
      logger.debug('Test debug');
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
    });
  });

  describe('with ERROR level', () => {
    beforeEach(() => {
      logger = new Logger(LogLevel.ERROR);
    });

    test('should log errors', () => {
      logger.error('Test error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Test error');
    });

    test('should not log warnings', () => {
      logger.warn('Test warning');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test('should not log info', () => {
      logger.info('Test info');
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
    });
  });
});
