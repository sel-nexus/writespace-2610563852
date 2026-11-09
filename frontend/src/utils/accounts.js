/** Create browser-local demo accounts with explicit partial-write recovery. */
import { getUsers, saveUsers } from './storage';
import { setSession } from './auth';
import { validateRegistration } from './validation';

/** Re-read and validate before generating metadata, then save account before identity.
 * Args:
 *   input: Submitted demo credentials; supplied roles and metadata are ignored.
 * Returns:
 *   Saved account and session, validation errors, unsaved failure, or account-created recovery.
 * Notes:
 *   Never retries automatically. A retry checks fresh accounts and rejects duplicates.
 * @param {Object} input
 * @returns {Object}
 */
export function registerUser(input) {
  const users = getUsers();
  const validation = validateRegistration(input, users);
  if (!validation.ok) return { ...validation, error: 'validation_failed' };
  let user;
  try {
    user = {
      id: crypto.randomUUID(),
      displayName: input.displayName.trim(),
      username: input.username.trim(),
      password: input.password,
      role: 'user',
      createdAt: new Date().toISOString(),
    };
  } catch {
    return { ok: false, error: 'generation_failed' };
  }
  const saved = saveUsers([...users, user]);
  if (!saved.ok) return saved;
  const session = { userId: user.id, username: user.username, displayName: user.displayName, role: 'user' };
  const signedIn = setSession(session);
  if (!signedIn.ok) return { ok: false, error: 'account_created', cause: signedIn.error, user };
  return { ok: true, user, session };
}
