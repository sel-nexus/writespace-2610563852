/** Contain browser persistence failures without rewriting unreadable records.
 * Notes:
 *   Users contain plaintext demo passwords. Never use real credentials.

 */
export const STORAGE_KEYS = {
  posts: 'writespace_posts',
  users: 'writespace_users',
  session: 'writespace_session',
};

const postFields = ['id', 'title', 'content', 'createdAt', 'authorId', 'authorName'];
const userFields = ['id', 'displayName', 'username', 'password', 'role', 'createdAt'];


/** Check required primitive fields at the untrusted storage boundary.
 * Args:
 *   value: Decoded browser record.
 *   fields: Required string field names.
 * Returns:
 *   Whether every required field is a nonblank string.
 */
function hasFields(value, fields) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && fields.every((field) => typeof value[field] === 'string' && value[field].trim() !== '');
}

/** Check a complete collection without silently filtering corrupt records.
 * Args:
 *   value: Decoded collection.
 *   kind: Posts or users collection selector.
 * Returns:
 *   Whether the entire snapshot conforms to the required record shape.
 */
function isCollection(value, kind) {
  const fields = kind === 'posts' ? postFields : userFields;
  return Array.isArray(value) && value.every((record) => hasFields(record, fields)
    && (kind !== 'users' || ['admin', 'user'].includes(record.role)));
}

/** Read a fresh collection and fall back to empty on access, parse, or shape failure.
 * Args:
 *   kind: App collection selector.
 * Returns:
 *   A fresh parsed snapshot or an empty array; never throws.
 */
function readCollection(kind) {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEYS[kind]));
    return isCollection(value, kind) ? value : [];
  } catch {
    return [];
  }
}

/** Serialize and validate before attempting a browser write.
 * Args:
 *   kind: App collection selector.
 *   records: Complete replacement snapshot.
 * Returns:
 *   An honest success or invalid-data, serialization, or storage failure result.
 */
function writeCollection(kind, records) {
  let serialized;
  try {
    serialized = JSON.stringify(records);
  } catch {
    return { ok: false, error: 'serialization_failed' };
  }
  try {
    if (!isCollection(records, kind) || !isCollection(JSON.parse(serialized), kind)) {
      return { ok: false, error: 'invalid_data' };
    }
  } catch {
    return { ok: false, error: 'invalid_data' };
  }
  try {
    localStorage.setItem(STORAGE_KEYS[kind], serialized);
    return { ok: true };
  } catch {
    return { ok: false, error: 'storage_unavailable' };
  }
}

/** Return a fresh posts snapshot or empty fallback. */
export function getPosts() {
  return readCollection('posts');
}

/** Save a complete posts snapshot.
 * Args:
 *   posts: Replacement post records.
 * Returns:
 *   Persistence result without throwing.
 */
export function savePosts(posts) {
  return writeCollection('posts', posts);
}

/** Return a fresh users snapshot or empty fallback. */
export function getUsers() {
  return readCollection('users');
}

/** Save a complete users snapshot containing only demo credentials.
 * Args:
 *   users: Replacement account records.
 * Returns:
 *   Persistence result without throwing.
 */
export function saveUsers(users) {
  return writeCollection('users', users);
}


