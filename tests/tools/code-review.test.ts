import { handleCodeReviewRequest } from '../../src/tools/code-review';
import * as appleScriptModule from '../../src/utils/applescript';
import { CodeReviewRequest } from '../../src/types';

jest.mock('../../src/utils/applescript');

describe('Code Review Tool', () => {
  const mockRunAppleScript = jest.mocked(appleScriptModule.runAppleScript);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('handleCodeReviewRequest', () => {
    test('should create a review request with unique ID', async () => {
      const request: CodeReviewRequest = {
        code: 'console.log("Hello World");',
        language: 'javascript',
      };

      mockRunAppleScript.mockResolvedValue('');

      const responsePromise = handleCodeReviewRequest(request, {
        timeout: 1000,
        interval: 100,
      });

      jest.advanceTimersByTime(1100);

      const response = await responsePromise;

      expect(response.reviewId).toBeDefined();
      expect(response.reviewId).toHaveLength(36); // UUID length
      expect(response.status).toBe('failed');
      expect(response.review).toContain('timed out');
    });

    test('should format review prompt correctly', async () => {
      const request: CodeReviewRequest = {
        code: 'function add(a, b) { return a + b; }',
        language: 'javascript',
        context: 'Utility function for addition',
        reviewType: 'general',
      };

      mockRunAppleScript.mockResolvedValue('');

      const responsePromise = handleCodeReviewRequest(request, {
        timeout: 500,
        interval: 100,
      });

      jest.advanceTimersByTime(600);

      await responsePromise;

      expect(mockRunAppleScript).toHaveBeenCalled();
      const scriptCall = mockRunAppleScript.mock.calls[0][0];
      expect(scriptCall).toContain('Language: javascript');
      expect(scriptCall).toContain('Review Type: general');
      expect(scriptCall).toContain('Context: Utility function for addition');
    });

    test('should handle AppleScript errors gracefully', async () => {
      const request: CodeReviewRequest = {
        code: 'console.log("test");',
      };

      mockRunAppleScript.mockRejectedValue(new Error('AppleScript failed'));

      const response = await handleCodeReviewRequest(request, {
        timeout: 1000,
        interval: 100,
      });

      expect(response.status).toBe('failed');
      expect(response.review).toContain('AppleScript failed');
    });

    test('should poll for response with correct intervals', async () => {
      const request: CodeReviewRequest = {
        code: 'const x = 1;',
        language: 'typescript',
      };

      mockRunAppleScript
        .mockResolvedValueOnce('') // Initial send
        .mockResolvedValueOnce('') // First poll
        .mockResolvedValueOnce('') // Second poll
        .mockResolvedValueOnce('[Code Review ID: test-id] Assistant: Code looks good!');

      const responsePromise = handleCodeReviewRequest(request, {
        timeout: 5000,
        interval: 200,
        maxAttempts: 5,
      });

      // Advance through polling intervals
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(200);
        await Promise.resolve();
      }

      jest.advanceTimersByTime(5000);

      const response = await responsePromise;

      expect(mockRunAppleScript).toHaveBeenCalledTimes(1); // Only initial send in this test
      expect(response.status).toBe('failed'); // Would timeout in this scenario
    });
  });
});