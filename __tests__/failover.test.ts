import { parseFriendlyErrorMessage } from '@/lib/gemini';

describe('Error Handling and Multi-Key Failover Formatting', () => {
  it('formats 503 high demand spike errors into user-friendly message', () => {
    const raw503 = 'Error: 503 Service Unavailable: The model is overloaded. Please try again.';
    const formatted = parseFriendlyErrorMessage(raw503);
    expect(formatted).toContain('temporary demand spike');
  });

  it('formats 429 rate limit errors into user-friendly message', () => {
    const raw429 = 'Error: 429 RESOURCE_EXHAUSTED: Rate limit exceeded.';
    const formatted = parseFriendlyErrorMessage(raw429);
    expect(formatted).toContain('Rate limit reached');
  });

  it('parses structured JSON error payloads correctly', () => {
    const jsonError = JSON.stringify({
      error: {
        code: 429,
        message: 'Quota exceeded for quota metric...'
      }
    });
    const formatted = parseFriendlyErrorMessage(jsonError);
    expect(formatted).toContain('Rate limit reached');
  });

  it('passes through standard operational messages without mangling', () => {
    const customMsg = 'Database connection closed unexpectedly';
    const formatted = parseFriendlyErrorMessage(customMsg);
    expect(formatted).toBe(customMsg);
  });

  it('handles null/undefined error objects safely', () => {
    expect(parseFriendlyErrorMessage(null)).toBe('An unexpected error occurred.');
    expect(parseFriendlyErrorMessage(undefined)).toBe('An unexpected error occurred.');
  });
});
