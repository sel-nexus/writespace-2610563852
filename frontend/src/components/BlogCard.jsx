/** Present plain-text previews and only permitted edit navigation. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Avatar } from './Avatar';
import { sessionPropType } from './PublicNavbar';
import { formatPostDate, getExcerpt } from '../utils/posts';
import { canManagePost } from '../utils/permissions';

const accents = ['border-t-indigo-500', 'border-t-violet-500', 'border-t-pink-500', 'border-t-teal-500'];

/** Render a post excerpt without nesting interactive links.
 * Args:
 *   post: Shape-validated post record.
 *   index: Display position for the deterministic accent cycle.
 *   session: Local identity used solely for edit-link visibility.
 *   authorRole: Known author role, defaulting to ordinary user.
 * Returns:
 *   Semantic preview article with reader and optional edit links.
 */
export function BlogCard({ post, index = 0, session = null, authorRole = 'user' }) {
  const canEdit = canManagePost(session, post);
  return (
    <article className={`flex flex-col gap-5 rounded-lg border border-t-4 border-slate-200 bg-white p-6 ${accents[index % 4]}`}>
      <h3 className="break-words font-[Georgia,serif] text-2xl leading-tight">
        <Link to={`/blog/${encodeURIComponent(post.id)}`} className="rounded hover:text-indigo-600 focus-visible:outline focus-visible:outline-2">
          {post.title}
        </Link>
      </h3>
      <p className="break-words leading-relaxed text-slate-600">{getExcerpt(post.content)}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span className="flex items-center gap-2">
          <Avatar role={authorRole} />
          {post.authorName}
        </span>
        <span>{formatPostDate(post.createdAt)}</span>
      </div>
      {canEdit && (
        <Link
          to={`/edit/${encodeURIComponent(post.id)}`}
          aria-label={`Edit ${post.title}`}
          className="flex min-h-11 items-center gap-2 rounded-lg text-indigo-600 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2"
        >
          <Pencil size={16} strokeWidth={1.5} aria-hidden="true" />
          Edit
        </Link>
      )}
    </article>
  );
}

BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    authorId: PropTypes.string.isRequired,
    authorName: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number,
  session: sessionPropType,
  authorRole: PropTypes.oneOf(['admin', 'user']),
};
