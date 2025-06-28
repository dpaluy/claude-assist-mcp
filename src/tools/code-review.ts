import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { runAppleScript, escapeAppleScriptString } from '../utils/applescript.js';
import {
  CodeReviewRequest,
  CodeReviewResponse,
  PollingOptions,
} from '../types/index.js';

const pendingReviews = new Map<string, CodeReviewResponse>();

export async function handleCodeReviewRequest(
  request: CodeReviewRequest,
  pollingOptions?: PollingOptions
): Promise<CodeReviewResponse> {
  const reviewId = uuidv4();
  const { timeout = 30000, interval = 2000, maxAttempts = 15 } = pollingOptions || {};

  logger.info(`Creating code review request: ${reviewId}`);

  const initialResponse: CodeReviewResponse = {
    reviewId,
    status: 'pending',
    timestamp: new Date().toISOString(),
  };

  pendingReviews.set(reviewId, initialResponse);

  try {
    await sendToClaudeDesktop(reviewId, request);

    const response = await pollForResponse(reviewId, {
      timeout,
      interval,
      maxAttempts,
    });

    return response;
  } catch (error) {
    logger.error(`Code review ${reviewId} failed:`, error);
    
    const errorResponse: CodeReviewResponse = {
      reviewId,
      status: 'failed',
      review: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString(),
    };
    
    pendingReviews.set(reviewId, errorResponse);
    return errorResponse;
  } finally {
    setTimeout(() => {
      pendingReviews.delete(reviewId);
    }, 60000);
  }
}

async function sendToClaudeDesktop(
  reviewId: string,
  request: CodeReviewRequest
): Promise<void> {
  logger.info(`Sending code review ${reviewId} to Claude Desktop`);

  const reviewPrompt = formatReviewPrompt(request);
  const escapedPrompt = escapeAppleScriptString(reviewPrompt);

  const script = `
    tell application "Claude"
      activate
      delay 0.5
      
      tell application "System Events"
        tell process "Claude"
          set frontmost to true
          
          -- Create new conversation
          keystroke "n" using command down
          delay 1
          
          -- Type the review request
          keystroke "[Code Review ID: ${reviewId}]\\n\\n${escapedPrompt}"
          delay 0.5
          
          -- Submit the request
          key code 36
        end tell
      end tell
    end tell
  `;

  try {
    await runAppleScript(script);
    logger.info(`Successfully sent review ${reviewId} to Claude Desktop`);
  } catch (error) {
    logger.error(`Failed to send review ${reviewId} to Claude Desktop:`, error);
    throw error;
  }
}

async function pollForResponse(
  reviewId: string,
  options: PollingOptions
): Promise<CodeReviewResponse> {
  const { timeout, interval, maxAttempts = 15 } = options;
  const startTime = Date.now();
  let attempts = 0;

  logger.info(`Polling for review ${reviewId} response (timeout: ${timeout}ms)`);

  while (attempts < maxAttempts && Date.now() - startTime < timeout) {
    attempts++;
    
    try {
      const response = await checkClaudeDesktopResponse(reviewId);
      
      if (response && response.status === 'completed') {
        logger.info(`Review ${reviewId} completed successfully`);
        pendingReviews.set(reviewId, response);
        return response;
      }
      
      const currentReview = pendingReviews.get(reviewId);
      if (currentReview) {
        currentReview.status = 'in_progress';
        pendingReviews.set(reviewId, currentReview);
      }
    } catch (error) {
      logger.warn(`Poll attempt ${attempts} failed for review ${reviewId}:`, error);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  logger.warn(`Review ${reviewId} timed out after ${attempts} attempts`);
  
  const timeoutResponse: CodeReviewResponse = {
    reviewId,
    status: 'failed',
    review: 'Code review timed out',
    timestamp: new Date().toISOString(),
  };
  
  pendingReviews.set(reviewId, timeoutResponse);
  return timeoutResponse;
}

async function checkClaudeDesktopResponse(reviewId: string): Promise<CodeReviewResponse | null> {
  const script = `
    tell application "Claude"
      tell application "System Events"
        tell process "Claude"
          set allText to ""
          try
            set allElements to every UI element of window 1
            repeat with elem in allElements
              try
                set elemValue to value of elem as string
                if elemValue contains "[Code Review ID: ${reviewId}]" then
                  set allText to elemValue
                  exit repeat
                end if
              end try
            end repeat
          end try
          return allText
        end tell
      end tell
    end tell
  `;

  try {
    const result = await runAppleScript(script);
    
    if (result && result.includes(reviewId)) {
      const reviewContent = extractReviewContent(result, reviewId);
      
      if (reviewContent) {
        return {
          reviewId,
          status: 'completed',
          review: reviewContent,
          timestamp: new Date().toISOString(),
        };
      }
    }
    
    return null;
  } catch (error) {
    logger.error(`Failed to check Claude Desktop response for ${reviewId}:`, error);
    return null;
  }
}

function formatReviewPrompt(request: CodeReviewRequest): string {
  let prompt = `[CODE REVIEW REQUEST]\n\n`;
  prompt += `You are a senior software engineer conducting a thorough code review. `;
  prompt += `Please analyze the following code with attention to detail.\n\n`;
  
  if (request.language) {
    prompt += `**Language:** ${request.language}\n`;
  }
  
  if (request.reviewType) {
    const reviewTypeDescriptions = {
      general: 'General code quality and best practices',
      security: 'Security vulnerabilities and safe coding practices',
      performance: 'Performance optimization and efficiency',
      style: 'Code style, readability, and maintainability'
    };
    prompt += `**Review Focus:** ${reviewTypeDescriptions[request.reviewType]}\n`;
  }
  
  if (request.context) {
    prompt += `**Context:** ${request.context}\n`;
  }
  
  prompt += `\n**Code to Review:**\n`;
  prompt += `\`\`\`${request.language || ''}\n${request.code}\n\`\`\`\n\n`;
  
  prompt += `**Please provide a detailed review covering:**\n`;
  prompt += `1. **Overview** - Brief summary of what the code does\n`;
  prompt += `2. **Strengths** - What's done well in the code\n`;
  prompt += `3. **Issues & Concerns** - Bugs, potential problems, or violations\n`;
  
  if (request.reviewType === 'security') {
    prompt += `4. **Security Analysis** - Vulnerabilities, injection risks, data exposure\n`;
  } else if (request.reviewType === 'performance') {
    prompt += `4. **Performance Analysis** - Bottlenecks, optimization opportunities\n`;
  } else if (request.reviewType === 'style') {
    prompt += `4. **Style & Readability** - Naming, structure, documentation needs\n`;
  } else {
    prompt += `4. **Code Quality** - Best practices, design patterns, maintainability\n`;
  }
  
  prompt += `5. **Recommendations** - Specific suggestions for improvement with code examples\n`;
  prompt += `6. **Priority** - Rate issues as High/Medium/Low priority\n\n`;
  
  prompt += `Format your response clearly with sections and use code blocks for any suggested improvements.`;
  
  return prompt;
}

function extractReviewContent(fullText: string, reviewId: string): string | null {
  const startMarker = `[Code Review ID: ${reviewId}]`;
  const startIndex = fullText.indexOf(startMarker);
  
  if (startIndex === -1) {
    return null;
  }
  
  const contentAfterMarker = fullText.substring(startIndex + startMarker.length);
  
  const assistantResponseIndex = contentAfterMarker.search(/Assistant:|Claude:/i);
  if (assistantResponseIndex !== -1) {
    const reviewContent = contentAfterMarker.substring(assistantResponseIndex);
    
    const cleanedContent = reviewContent
      .replace(/^(Assistant:|Claude:)\s*/i, '')
      .trim();
    
    if (cleanedContent.length > 50) {
      return cleanedContent;
    }
  }
  
  return null;
}