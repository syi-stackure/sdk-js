/**
 * CDN bundle for browser usage
 * 
 * Exposes Stackure as a global object when loaded via script tag.
 * 
 * @example
 * ```html
 * <script src="https://cdn.stackure.com/auth.js"></script>
 * <script>
 *   Stackure.signIn('your-app-id');
 * </script>
 * ```
 */

import { StackureClient } from './client';
import type { StackureConfig } from './types';

const defaultClient = new StackureClient();

const Stackure = {
  sendMagicLink: defaultClient.sendMagicLink.bind(defaultClient),
  validateSession: defaultClient.validateSession.bind(defaultClient),
  logout: defaultClient.logout.bind(defaultClient),
  signIn: defaultClient.signIn.bind(defaultClient),
  create: (config: StackureConfig) => new StackureClient(config),
};

if (typeof window !== 'undefined') {
  (window as any).Stackure = Stackure;
}

export default Stackure;
