/**
 * StackureError is the single error type thrown by every SDK function.
 *
 * Catch once and inspect `.code` to branch on category:
 *
 * @example
 * ```typescript
 * try {
 *   await stackure.sendMagicLink({ email });
 * } catch (err) {
 *   if (err instanceof StackureError) {
 *     switch (err.code) {
 *       case 'validation': // bad input
 *       case 'auth':       // 401 from the API
 *       case 'forbidden':  // 403 from the API
 *       case 'timeout':    // request exceeded timeout
 *       case 'network':    // everything else
 *     }
 *   }
 * }
 * ```
 */
export class StackureError extends Error {
  /**
   * @param code - One of "validation" | "auth" | "forbidden" | "timeout" | "network"
   * @param message - Human-readable description
   * @param statusCode - HTTP status from the API, or undefined if the error
   *   happened before a response was received
   */
  constructor(
    public code: StackureErrorCode,
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'StackureError';
    Object.setPrototypeOf(this, StackureError.prototype);
  }
}

/** Categories of errors the SDK can produce. */
export type StackureErrorCode = 'validation' | 'auth' | 'forbidden' | 'timeout' | 'network';
