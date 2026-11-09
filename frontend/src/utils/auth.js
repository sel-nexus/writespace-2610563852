/** Handle demo identity locally; plaintext credentials and client guards are not security. */
import { STORAGE_KEYS } from './storage';

/** Validate required identity strings and fail closed on unsupported roles.
 * Args:
 *   session: Untrusted identity candidate.
 * Returns:
 *   Whether the candidate is a complete supported identity.
 */
function isSession(session) {
  return session !== null && typeof session === 'object' && !Array.isArray(session)
    && ['userId', 'username', 'displayName', 'role'].every((field) => (
      typeof session[field] === 'string' && session[field].trim() !== ''
    )) && ['admin', 'user'].includes(session.role);
}

/** Read fresh identity without repairing or rewriting invalid storage.
 * Returns:
 *   Valid session or null on missing, malformed, or inaccessible storage.
 */
export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.session));
    return isSession(session) ? session : null;
  } catch {
    return null;
  }
}

/** Validate and persist identity only after serialization succeeds.
 * Args:
 *   session: Identity to persist under the session key only.
 * Returns:
 *   Honest persistence result; never throws through the view boundary.
 */
export function setSession(session) {
  let serialized;
  try {
    serialized = JSON.stringify(session);
  } catch {
    return { ok: false, error: 'serialization_failed' };
  }
  try {
    if (!isSession(session) || !isSession(JSON.parse(serialized))) {
      return { ok: false, error: 'invalid_data' };
    }
  } catch {
    return { ok: false, error: 'invalid_data' };
  }
  try {
    localStorage.setItem(STORAGE_KEYS.session, serialized);
    return { ok: true };
  } catch {
    return { ok: false, error: 'storage_unavailable' };
  }
}

/** Remove only the session, retaining all posts, accounts, and unrelated data.
 * Returns:
 *   Success after removal completes, or an explicit storage failure.
 */
export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.session);
    return { ok: true };
  } catch {
    return { ok: false, error: 'storage_unavailable' };
  }
}

/** Match fixed Admin first, then exact stored plaintext demo credentials.
 * Args:
 *   username: Submitted username, without normalization.
 *   password: Submitted demo password, without normalization.
 *   users: Fresh local account snapshot.
 * Returns:
 *   Credential-free identity or null; never changes persistence.
 */
export function authenticate(username, password, users) {
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password.trim()) return null;
  if (username === 'admin' && password === 'admin') {
    return { userId: 'default-admin', username: 'admin', displayName: 'Admin', role: 'admin' };
  }
  if (!Array.isArray(users)) return null;
  const account = users.find((user) => {
    const identity = user && { userId: user.id, username: user.username, displayName: user.displayName, role: user.role };
    return isSession(identity) && user.username === username && user.password === password;
  });
  return account ? { userId: account.id, username: account.username, displayName: account.displayName, role: account.role } : null;
}

/** Choose a safe entry destination from validated identity.
 * Args:
 *   session: Identity candidate or null.
 * Returns:
 *   Admin dashboard, user blog list, or guest login path.
 */
export function roleHome(session) {
  if (!isSession(session)) return '/login';
  return session.role === 'admin' ? '/admin' : '/blogs';
}
