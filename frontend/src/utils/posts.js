/** Derive deterministic, text-only views without changing stored post order. */

/** Convert usable date metadata to an ordering value.
 * Args:
 *   value: Stored date metadata.
 * Returns:
 *   Timestamp, or zero for absent or invalid metadata.
 */
function timestamp(value) {
  const parsed = typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Sort a copy newest-first, keeping equal dates in original order.
 * Args:
 *   posts: Post snapshot.
 * Returns:
 *   A sorted copy, or empty for non-array input.
 */
export function sortPosts(posts) {
  return Array.isArray(posts) ? [...posts].sort((a, b) => timestamp(b?.createdAt) - timestamp(a?.createdAt)) : [];
}

/** Select at most the requested count of newest posts.
 * Args:
 *   posts: Post snapshot.
 *   limit: Nonnegative count, defaulting to three.
 * Returns:
 *   Newest preview records; invalid limits produce an empty preview.
 */
export function getLatestPosts(posts, limit = 3) {
  if (!Number.isInteger(limit) || limit < 0) return [];
  return sortPosts(posts).slice(0, limit);
}

/** Take the first 120 characters without interpreting markup.
 * Args:
 *   content: Plain-text body.
 * Returns:
 *   A bounded excerpt or empty for non-string input.
 */
export function getExcerpt(content) {
  return typeof content === 'string' ? content.slice(0, 120) : '';
}

/** Format creation metadata consistently across browser time zones.
 * Args:
 *   value: Stored creation date.
 * Returns:
 *   English month, padded day and year, or an honest unavailable label.
 */
export function formatPostDate(value) {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
}
