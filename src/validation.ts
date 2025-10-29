import { ValidationError } from './errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate email address format
 * 
 * @param email - Email address to validate
 * @throws {ValidationError} If email is invalid
 */
export function validateEmail(email: string): void {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required and must be a string');
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new ValidationError('Invalid email format');
  }
}

/**
 * Validate UUID v4 format
 * 
 * @param value - UUID string to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If UUID is invalid
 */
export function validateUUID(value: string, fieldName: string = 'UUID'): void {
  if (!value || typeof value !== 'string') {
    throw new ValidationError(`${fieldName} is required and must be a string`);
  }

  if (!UUID_REGEX.test(value)) {
    throw new ValidationError(`Invalid ${fieldName} format (must be a valid UUID)`);
  }
}

/**
 * Validate URL format
 * 
 * @param url - URL string to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If URL is invalid
 */
export function validateURL(url: string, fieldName: string = 'URL'): void {
  if (!url || typeof url !== 'string') {
    throw new ValidationError(`${fieldName} is required and must be a string`);
  }

  try {
    new URL(url);
  } catch {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
}
