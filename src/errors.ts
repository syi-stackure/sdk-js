/**
 * StackureError is the single error type thrown by every SDK function.
 *
 * Catch once and inspect `.code` to branch on category:
 *
 * @example
 * ```typescript
 * try {
 *   await sendMagicLink(email);
 * } catch (err) {
 *   if (err instanceof StackureError) {
 *     switch (err.code) {
 *       case 'validation': // bad input
 *       case 'auth':       // 401 from the API
 *       case 'forbidden':  // 403 from the API
 *       case 'timeout':    // request exceeded the 2s timeout
 *       case 'network':    // everything else
 *     }
 *   }
 * }
 * ```
 */
export class StackureError extends Error {
  /** One of "validation" | "auth" | "forbidden" | "timeout" | "network" */
  readonly code: StackureErrorCode;
  /** HTTP status from the API, or undefined if the error predates a response */
  readonly statusCode?: number | undefined;

  constructor(code: StackureErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'StackureError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** Categories of errors the SDK can produce. */
export type StackureErrorCode = 'validation' | 'auth' | 'forbidden' | 'timeout' | 'network';
