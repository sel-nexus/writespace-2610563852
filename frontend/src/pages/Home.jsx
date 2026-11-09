/** Present every browser-local post in newest-first reading order. */
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard';
import { getPosts, getUsers } from '../utils/storage';
import { getSession } from '../utils/auth';
import { sortPosts } from '../utils/posts';

/** Render a fresh list without writing or normalizing stored records.
 * Returns:
 *   Responsive post cards or the exact empty message.
 */
export default function Home() {
  const posts = sortPosts(getPosts());
  const users = getUsers();
  const session = getSession();
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <h1 className="font-[Georgia,serif] text-4xl tracking-tight">All Blogs</h1>
        <Link to="/write" className="rounded-lg bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700 focus-visible:outline">
          Write a Post
        </Link>
      </div>
      {posts.length === 0 ? (
        <p className="mt-12 text-slate-600">No posts yet. Be the first to write!</p>
      ) : (
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <BlogCard
              key={post.id}
              post={post}
              index={index}
              session={session}
              authorRole={post.authorId === 'default-admin' ? 'admin' : users.find((user) => user.id === post.authorId)?.role || 'user'}
            />
          ))}
        </div>
      )}
    </main>
  );
}
