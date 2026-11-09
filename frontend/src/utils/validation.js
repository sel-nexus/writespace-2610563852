/** Validate local demo drafts without storage access or input mutation. */

/** Check string presence without changing the submitted value.
 * Args:
 *   value: Untrusted field value.
 * Returns:
 *   Whether the value is a nonblank string.
 * @param {*} value
 * @returns {boolean}
 */
function present(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** Validate all registration fields and case-insensitive username availability.
 * Args:
 *   input: Submitted demo account fields.
 *   users: Current local accounts, including any managed accounts.
 * Returns:
 *   Field errors and validity; never changes drafts or accounts.
 * @param {Object} input
 * @param {Array} users
 * @returns {{ok: boolean, errors: Object}}
 */
export function validateRegistration(input, users = []) {
  const errors = {};
  const labels = { displayName: 'Display name', username: 'Username', password: 'Password', confirmPassword: 'Confirm password' };
  for (const [field, label] of Object.entries(labels)) {
    if (!present(input?.[field])) errors[field] = `${label} is required.`;
  }
  if (!errors.username) {
    const normalized = input.username.trim().toLowerCase();
    if (normalized === 'admin') {
      errors.username = 'This username is reserved.';
    } else if (Array.isArray(users) && users.some((user) => (
      typeof user?.username === 'string' && user.username.trim().toLowerCase() === normalized
    ))) {
      errors.username = 'This username is already taken.';
    }
  }
  if (!errors.password && !errors.confirmPassword && input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Validate plain-text post presence while preserving body whitespace and line breaks.
 * Args:
 *   input: Submitted title and content.
 * Returns:
 *   Field errors and validity without transforming the draft.
 * @param {Object} input
 * @returns {{ok: boolean, errors: Object}}
 */
export function validatePost(input) {
  const errors = {};
  if (!present(input?.title)) errors.title = 'Title is required.';
  if (!present(input?.content)) errors.content = 'Content is required.';
  return { ok: Object.keys(errors).length === 0, errors };
}
