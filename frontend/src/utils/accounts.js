/** Create browser-local demo accounts with explicit partial-write recovery. */
import { getUsers, saveUsers } from './storage';
import { getSession, setSession } from './auth';
import { canDeleteAccount } from './permissions';
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

/** Create an Admin-selected account without changing the signed-in identity.
 * Args:
 *   input: Required display name, unique username, demo password and supported role.
 * Returns:
 *   Saved account or honest validation, permission, generation or persistence failure.
 * Notes:
 *   Read fresh identity and accounts per action; never modify posts or retry automatically.
 */
export function createManagedUser(input) {
  const session = getSession();
  const users = getUsers();
  if (session?.role !== 'admin') return { ok: false, error: 'forbidden' };
  const validation = validateRegistration({
    displayName: input?.displayName, username: input?.username,
    password: input?.password, confirmPassword: input?.password,
  }, users);
  const errors = { ...validation.errors };
  if (!['admin', 'user'].includes(input?.role)) errors.role = 'Choose Admin or User.';
  if (Object.keys(errors).length) return { ok: false, error: 'validation_failed', errors };
  let user;
  try {
    user = {
      id: crypto.randomUUID(), displayName: input.displayName.trim(), username: input.username.trim(),
      password: input.password, role: input.role, createdAt: new Date().toISOString(),
    };
  } catch {
    return { ok: false, error: 'generation_failed' };
  }
  const saved = saveUsers([...users, user]);
  return saved.ok ? { ok: true, user } : saved;
}

/** Remove a freshly resolved eligible account only after affirmative confirmation.
 * Args:
 *   userId: Displayed account identifier, not a trusted mounted record.
 *   confirmed: Literal true from the confirmation control.
 * Returns:
 *   Removed identifier or canceled, missing, forbidden or persistence failure.
 * Notes:
 *   Preserve posts and session, including posts authored by the removed account.
 */
export function deleteManagedUser(userId, confirmed) {
  const session = getSession();
  const users = getUsers();
  if (confirmed !== true) return { ok: false, error: 'canceled' };
  if (session?.role !== 'admin') return { ok: false, error: 'forbidden' };
  if (userId === 'default-admin') return { ok: false, error: 'forbidden' };
  const target = users.find((user) => user.id === userId);
  if (!target) return { ok: false, error: 'not_found' };
  if (!canDeleteAccount(session, target)) return { ok: false, error: 'forbidden' };
  const saved = saveUsers(users.filter((user) => user.id !== userId));
  return saved.ok ? { ok: true, removedId: userId } : saved;
}
