export async function retry<T>(
  fn: () => Promise<T>,
  opts: { tries?: number; min?: number } = {}
): Promise<T> {
  const tries = opts.tries ?? 5;
  const min = opts.min ?? 200;
  let lastError: unknown;

  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      
      // Don't retry on final attempt
      if (i === tries - 1) break;
      
      // Exponential backoff with jitter
      const delay = Math.min(5000, min * 2 ** i);
      const jitter = Math.random() * 0.3 * delay; // 0-30% jitter
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  throw lastError;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: unknown
  ) {
    super(message);
    this.name = "RetryError";
  }
}
