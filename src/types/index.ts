export interface CodeReviewRequest {
  code: string;
  language?: string;
  context?: string;
  reviewType?: 'general' | 'security' | 'performance' | 'style';
}

export interface CodeReviewResponse {
  reviewId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  review?: string;
  suggestions?: string[];
  timestamp: string;
}

export interface PollingOptions {
  interval: number;
  timeout: number;
  maxAttempts?: number;
}