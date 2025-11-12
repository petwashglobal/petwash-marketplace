export function isUnauthorizedError(error: Error): boolean {
  return /^401:/.test(error.message);
}