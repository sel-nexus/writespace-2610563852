/** Summarize local content and reuse confirmed, fresh-checked Admin post actions. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { StatCard } from '../components/StatCard';
import { getSession } from '../utils/auth';
import { getPosts, getUsers } from '../utils/storage';
import { formatPostDate, getLatestPosts } from '../utils/posts';
import { canManagePost } from '../utils/permissions';
import { deletePost } from '../utils/postMutations';

const control = 'inline-flex min-h-11 items-center rounded-lg px-4 py-3 focus-visible:outline focus-visible:outline-2';

/** Render four stored-array counts and the five newest local posts.
 * Returns:
 *   Admin overview with honest empty, canceled and failed-deletion states.
 * Notes:
 *   The fixed demo Admin is outside the mutable users array and its counts.
 */
export default function AdminDashboard() {
  const [posts, setPosts] = useState(getPosts);
  const [users] = useState(getUsers);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const session = getSession();
  const recent = getLatestPosts(posts, 5);

  /** Confirm deletion and refresh only after the shared mutation succeeds.
   * Args:
   *   id: Displayed target identifier; never trust the mounted snapshot for writes.
   */
  function remove(id) {
    setError('');
    setStatus('');
    const result = deletePost(id, window.confirm('Delete this post? This cannot be undone.'));
    if (result.ok) {
      setPosts(getPosts());
      setStatus('Post deleted locally.');
    } else if (result.error === 'not_found') {
      setError('This post no longer exists. Reload to refresh the dashboard. Nothing was deleted.');
    } else if (result.error === 'forbidden') {
      setError('You no longer have permission to delete this post. Nothing was deleted.');
    } else if (result.error !== 'canceled') {
      setError('The post could not be deleted locally. Nothing was deleted. Please try again.');
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="font-[Georgia,serif] text-4xl tracking-tight">Admin Dashboard</h1>
          <p className="mt-4 max-w-[70ch] leading-relaxed text-slate-600">
            Content in this browser only. Counts use stored arrays; the fixed demo Admin is not included in account counts.
          </p>
        </div>
        <nav aria-label="Dashboard shortcuts" className="flex flex-wrap gap-3">
          <Link to="/write" className={`${control} bg-indigo-600 font-medium text-white hover:bg-indigo-700`}>
            Write a Post
          </Link>
          <Link to="/users" className={`${control} border border-slate-300 bg-white hover:bg-slate-100`}>
            Manage Users
          </Link>
        </nav>
      </header>
      <dl aria-label="Local statistics" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Posts" value={posts.length} />
        <StatCard label="Total Users" value={users.length} />
        <StatCard label="Total Admins" value={users.filter((user) => user.role === 'admin').length} />
        <StatCard label="Total Users" value={users.length} note="Unresolved: repeated metric awaiting product clarification." />
      </dl>
      <section aria-labelledby="recent-posts-title" className="mt-16">
        <h2 id="recent-posts-title" className="font-[Georgia,serif] text-3xl">Recent Posts</h2>
        <p className="mt-3 text-sm text-slate-600">The five newest posts, across all authors.</p>
        {error && (
          <p role="alert" className="mt-6 text-red-700">{error}</p>
        )}
        <p role="status" className="mt-4 text-sm text-slate-600">{status}</p>
        {recent.length ? (
          <ul className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
            {recent.map((post) => {
              const authorRole = post.authorId === 'default-admin' ? 'admin'
                : users.find((user) => user.id === post.authorId)?.role || 'user';
              return (
                <li key={post.id} className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words font-[Georgia,serif] text-xl">
                      <Link to={`/blog/${encodeURIComponent(post.id)}`} className="rounded hover:text-indigo-700 focus-visible:outline">
                        {post.title}
                      </Link>
                    </h3>
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <Avatar role={authorRole} />
                      <span>By {post.authorName}</span>
                      <span>{formatPostDate(post.createdAt)}</span>
                    </p>
                  </div>
                  {canManagePost(session, post) && (
                    <div className="flex shrink-0 gap-3">
                      <Link
                        to={`/edit/${encodeURIComponent(post.id)}`}
                        aria-label={`Edit ${post.title}`}
                        className={`${control} text-indigo-700 underline hover:bg-slate-100`}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete ${post.title}`}
                        onClick={() => remove(post.id)}
                        className={`${control} border border-slate-300 text-red-700 hover:bg-white`}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-6 border-t border-slate-200 py-8 text-slate-600">No posts yet. Be the first to write!</p>
        )}
      </section>
    </main>
  );
}
