/** Decide ordinary-flow eligibility without reading or changing browser state. */

/** Check complete supported identity fields.
 * Args:
 *   value: Untrusted record.
 *   fields: Required nonblank strings.
 * Returns:
 *   Whether the record has every required field.
 */
function hasFields(value, fields) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && fields.every((field) => typeof value[field] === 'string' && Boolean(value[field].trim()));
}

/** Validate a session without treating an unsupported role as an owner.
 * Args:
 *   session: Untrusted identity.
 * Returns:
 *   Whether the identity is complete and supported.
 */
function validSession(session) {
  return hasFields(session, ['userId', 'username', 'displayName', 'role']) && ['user', 'admin'].includes(session.role);
}

/** Allow a valid Admin or the original author to manage a complete post.
 * Args:
 *   session: Local identity candidate.
 *   post: Post candidate.
 * Returns:
 *   Eligibility, failing closed on invalid records or identities.
 * @param {*} session
 * @param {*} post
 * @returns {boolean}
 */
export function canManagePost(session, post) {
  return validSession(session) && hasFields(post, ['id', 'title', 'content', 'createdAt', 'authorId', 'authorName'])
    && (session.role === 'admin' || session.userId === post.authorId);
}

/** Allow Admin deletion only for complete, nonreserved, inactive accounts.
 * Args:
 *   session: Local identity candidate.
 *   account: Account candidate.
 * Returns:
 *   Eligibility without modifying posts or accounts.
 * @param {*} session
 * @param {*} account
 * @returns {boolean}
 */
export function canDeleteAccount(session, account) {
  return validSession(session) && session.role === 'admin'
    && hasFields(account, ['id', 'username', 'displayName', 'password', 'role', 'createdAt'])
    && ['user', 'admin'].includes(account.role) && account.id !== 'default-admin'
    && account.username.trim().toLowerCase() !== 'admin' && account.id !== session.userId;
}
