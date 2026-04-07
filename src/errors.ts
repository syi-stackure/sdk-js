/**
 * Base error class for all Stackure SDK errors
 */
export class StackureError extends Error {
  /**
   * @param message - Human-readable error message
   * @param code - Error code identifier
   * @param statusCode - Optional HTTP status code
   */
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'StackureError';
    Object.setPrototypeOf(this, StackureError.prototype);
  }
}

/**
 * Error thrown when input validation fails
 * 
 * @example
 * ```typescript
 * throw new ValidationError('Invalid email format');
 * ```
 */
export class ValidationError extends StackureError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown when network request fails
 * 
 * @example
 * ```typescript
 * throw new NetworkError('Connection failed', 500);
 * ```
 */
export class NetworkError extends StackureError {
  constructor(message: string, statusCode?: number) {
    super(message, 'NETWORK_ERROR', statusCode);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Error thrown when authentication fails
 * 
 * @example
 * ```typescript
 * throw new AuthenticationError('Invalid credentials');
 * ```
 */
export class AuthenticationError extends StackureError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Error thrown when access is forbidden
 *
 * @example
 * ```typescript
 * throw new ForbiddenError('Insufficient permissions');
 * ```
 */
export class ForbiddenError extends StackureError {
  constructor(message: string) {
    super(message, 'FORBIDDEN_ERROR', 403);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * Error thrown when request times out
 * 
 * @example
 * ```typescript
 * throw new TimeoutError('Request took too long');
 * ```
 */
export class TimeoutError extends StackureError {
  constructor(message: string = 'Request timed out') {
    super(message, 'TIMEOUT_ERROR', 408);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
