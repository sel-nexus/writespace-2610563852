/** Display stored plain text and confirm eligible destructive actions. */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getPosts, getUsers } from '../utils/storage';
import { Avatar } from '../components/Avatar';
import { getSession } from '../utils/auth';
import { canManagePost } from '../utils/permissions';
import { formatPostDate } from '../utils/posts';
import { deletePost } from '../utils/postMutations';

/** Resolve a reader URL and never interpret title or body as markup.
 * Returns:
 *   Full reader or missing-target content with a safe return link.
 */
export default function ReadBlog() {
  const { id } = useParams();
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const post = getPosts().find((item) => item.id === id);
  const eligible = canManagePost(getSession(), post);
  const authorRole = post?.authorId === 'default-admin' ? 'admin'
    : getUsers().find((user) => user.id === post?.authorId)?.role || 'user';
  const navigate = useNavigate();

  /** Recheck runtime identity and ownership after browser confirmation. */
  function remove() {
    const result = deletePost(id, window.confirm('Delete this post? This cannot be undone.'));
    if (result.ok) navigate('/blogs');
    else if (result.error === 'not_found') setMissing(true);
    else if (result.error === 'forbidden') navigate('/blogs', { replace: true });
    else if (result.error !== 'canceled') setError('Your post could not be deleted locally. Nothing was deleted. Please try again.');
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      {!post || missing ? (
        <h1 className="font-[Georgia,serif] text-4xl">Post not found</h1>
      ) : (
        <article>
          <h1 className="break-words font-[Georgia,serif] text-4xl leading-tight tracking-tight">{post.title}</h1>
          <p className="mt-6 flex items-center gap-2 text-sm text-slate-600">
            <Avatar role={authorRole} />
            By {post.authorName} · {formatPostDate(post.createdAt)}
          </p>
          <p className="mt-12 whitespace-pre-wrap break-words text-lg leading-relaxed">{post.content}</p>
          {eligible && (
            <div className="mt-12 flex flex-wrap gap-6">
              <Link to={`/edit/${encodeURIComponent(id)}`} className="rounded-lg px-4 py-3 text-indigo-700 underline focus-visible:outline">
                Edit
              </Link>
              <button type="button" onClick={remove} className="rounded-lg border border-slate-300 px-4 py-3 text-red-700 focus-visible:outline">
                Delete
              </button>
            </div>
          )}
        </article>
      )}
      {error && (
        <p role="alert" className="mt-6 text-red-700">{error}</p>
      )}
      <Link to="/blogs" className="mt-12 inline-flex rounded-lg py-3 text-indigo-700 underline focus-visible:outline">
        Back to Blogs
      </Link>
    </main>
  );
}
