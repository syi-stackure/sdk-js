export { auth, logout, mcp, userFromRequest, verify } from './middleware.js';
export type { StackureRequest } from './middleware.js';
export { sendMagicLink, validateSession } from './stackure.js';
export type { MagicLinkResponse, Session, User, VerifyError, VerifyResult } from './stackure.js';
export { StackureError } from './errors.js';
export type { StackureErrorCode } from './errors.js';
