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

/**
 * Throw a "validation"-coded StackureError if `value` is not a valid UUID v4.
 */
export function validateUUID(value: string, fieldName = 'UUID'): void {
  if (!value || typeof value !== 'string') {
    throw new StackureError('validation', `${fieldName} is required`);
  }
  if (!UUID_REGEX.test(value)) {
    throw new StackureError('validation', `invalid ${fieldName} format (must be a valid UUID)`);
  }
}

/**
 * Throw a "validation"-coded StackureError if `url` is not a parseable URL.
 */
export function validateURL(url: string, fieldName = 'URL'): void {
  if (!url || typeof url !== 'string') {
    throw new StackureError('validation', `${fieldName} is required`);
  }
  try {
    new URL(url);
  } catch {
    throw new StackureError('validation', `invalid ${fieldName} format`);
  }
}
