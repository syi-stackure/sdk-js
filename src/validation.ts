import { StackureError } from './errors.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Throw a "validation"-coded StackureError if `email` is not a well-formed
 * address.
 */
export function validateEmail(email: string): void {
  if (!email || typeof email !== 'string') {
    throw new StackureError('validation', 'email is required');
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new StackureError('validation', 'invalid email format');
  }
}

export function isUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}
