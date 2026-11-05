export { auth, logout, mcp, userFromRequest, validateSession, verify } from './middleware.js';
export type { StackureRequest } from './middleware.js';
export { directoryTeams, directoryUsers, onOrgClosed, sendMagicLink } from './stackure.js';
export type {
  DirectoryOptions,
  DirectoryPage,
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
