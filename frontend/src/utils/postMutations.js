/** Persist user-requested post changes with fresh identity and collection checks. */
import { getSession } from './auth';
import { getPosts, savePosts } from './storage';
import { canManagePost } from './permissions';
import { validatePost } from './validation';

/** Create metadata from fresh identity, ignoring form-supplied authorship.
 * Args:
 *   input: Submitted title and plain-text content.
 * Returns:
 *   Saved post or an honest validation, permission, generation or storage failure.
 * @param {*} input
 * @returns {Object}
 */
export function createPost(input) {
  const session = getSession();
  const posts = getPosts();
  if (!session) return { ok: false, error: 'forbidden' };
  const validation = validatePost(input);
  if (!validation.ok) return { ...validation, error: 'validation_failed' };
  let post;
  try {
    post = {
      id: crypto.randomUUID(), title: input.title.trim(), content: input.content,
      createdAt: new Date().toISOString(), authorId: session.userId, authorName: session.displayName,
    };
  } catch {
    return { ok: false, error: 'generation_failed' };
  }
  const saved = savePosts([...posts, post]);
  return saved.ok ? { ok: true, post } : saved;
}

/** Update only editable fields after resolving the fresh target and permission.
 * Args:
 *   id: Target identifier.
 *   input: Submitted title and content; metadata is ignored.
 * Returns:
 *   Saved post or a no-write failure result.
 * @param {*} id
 * @param {*} input
 * @returns {Object}
 */
export function updatePost(id, input) {
  const session = getSession();
  const posts = getPosts();
  const target = posts.find((post) => post.id === id);
  if (!target) return { ok: false, error: 'not_found' };
  if (!canManagePost(session, target)) return { ok: false, error: 'forbidden' };
  const validation = validatePost(input);
  if (!validation.ok) return { ...validation, error: 'validation_failed' };
  const post = { ...target, title: input.title.trim(), content: input.content };
  const saved = savePosts(posts.map((item) => item.id === id ? post : item));
  return saved.ok ? { ok: true, post } : saved;
}

/** Delete only after affirmative confirmation and fresh eligibility checks.
 * Args:
 *   id: Target identifier.
 *   confirmed: Literal true from the UI confirmation.
 * Returns:
 *   Removed identifier or a canceled, missing, forbidden or storage failure.
 * @param {*} id
 * @param {*} confirmed
 * @returns {Object}
 */
export function deletePost(id, confirmed) {
  const session = getSession();
  const posts = getPosts();
  if (confirmed !== true) return { ok: false, error: 'canceled' };
  const target = posts.find((post) => post.id === id);
  if (!target) return { ok: false, error: 'not_found' };
  if (!canManagePost(session, target)) return { ok: false, error: 'forbidden' };
  const saved = savePosts(posts.filter((post) => post.id !== id));
  return saved.ok ? { ok: true, removedId: id } : saved;
}
