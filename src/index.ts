export { auth, logout, mcp, userFromRequest, verify } from './middleware.js';
export type { StackureRequest } from './middleware.js';
export { directory, sendMagicLink, validateSession } from './stackure.js';
export type {
  Directory,
  DirectoryUser,
  MagicLinkResponse,
  Session,
  Team,
  User,
  VerifyError,
  VerifyResult,
} from './stackure.js';
export { StackureError } from './errors.js';
export type { StackureErrorCode } from './errors.js';
