/** Introduce the browser-local writing demo and its newest saved previews. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, LockKeyhole, Zap } from 'lucide-react';
import { PublicNavbar, sessionPropType } from '../components/PublicNavbar';
import { BlogCard } from '../components/BlogCard';
import { getPosts, getUsers } from '../utils/storage';
import { getLatestPosts } from '../utils/posts';

const features = [
  { title: 'Write Freely', text: 'Plain-text writing, no distractions.', Icon: BookOpen },
  { title: 'Private & Local', text: 'Your data lives in your browser, not on a server.', Icon: LockKeyhole },
  { title: 'Instant & Fast', text: 'No server, no lag. A simple space for your words.', Icon: Zap },
];
const action = 'inline-flex min-h-11 items-center justify-center rounded-lg px-6 py-3 font-medium focus-visible:ring-2 focus-visible:ring-indigo-500';

/** Render discovery from mounted posts and guarded account snapshots.
 * Args:
 *   session: Validated identity for entry links, or null for a guest.
 * Returns:
 *   Responsive landing, feature regions, latest previews and footer.
 * Notes:
 *   Fixed Admin authors retain their role; missing accounts use the User mark.
 *   Reading previews never repairs or writes browser storage.
 */
export default function LandingPage({ session = null }) {
  const [posts] = useState(() => getLatestPosts(getPosts()));
  const [users] = useState(() => getUsers());
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-30 focus:bg-white focus:p-4">Skip to content</a>
      <PublicNavbar session={session} />
      <main id="main" className="mx-auto max-w-6xl px-6">
        <section aria-labelledby="hero-title" className="grid gap-12 py-20 lg:grid-cols-[2fr_1fr] lg:items-center lg:py-28">
          <div>
            <p className="mb-6 text-sm font-medium uppercase tracking-widest text-slate-500">A browser-local writing demo</p>
            <h1 id="hero-title" className="font-[Georgia,serif] text-5xl leading-tight tracking-tight sm:text-7xl">WriteSpace</h1>
            <p className="mt-6 max-w-xl font-[Georgia,serif] text-2xl leading-relaxed sm:text-3xl">
              Your thoughts. Your space. Beautifully simple.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link to={session ? '/blogs' : '/login'} className={`${action} bg-indigo-600 text-white hover:bg-indigo-700`}>
                Start Reading
              </Link>
              <Link to="/register" className={`${action} border border-slate-300 bg-white hover:bg-slate-100`}>
                Get Started Free
              </Link>
            </div>
          </div>
          <aside aria-label="Writing sample" className="rounded-lg border border-slate-200 bg-white p-8 motion-safe:animate-pulse">
            <BookOpen size={24} strokeWidth={1.5} className="mb-6 text-indigo-600" aria-hidden="true" />
            <p className="text-sm text-slate-500">A little room to think</p>
            <p className="mt-3 font-[Georgia,serif] text-2xl">Every story starts with a single thought.</p>
            <p className="mt-4 leading-relaxed text-slate-600">A plain-text page. A quiet moment. Your words.</p>
          </aside>
        </section>
        <section aria-labelledby="features-title" className="py-12">
          <h2 id="features-title" className="mb-8 font-[Georgia,serif] text-3xl">Room for what matters</h2>
          <div className="grid gap-8 lg:grid-cols-3">
            {features.map(({ title, text, Icon }) => (
              <article key={title} className="border-t border-slate-200 py-6">
                <Icon size={24} strokeWidth={1.5} aria-hidden="true" className="mb-5 text-slate-500" />
                <h3 className="text-xl font-medium">{title}</h3>
                <p className="mt-3 leading-relaxed text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section aria-labelledby="latest-title" className="py-16">
          <h2 id="latest-title" className="mb-8 font-[Georgia,serif] text-3xl">Latest from the Blog</h2>
          {posts.length ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <BlogCard
                  key={post.id}
                  post={post}
                  index={index}
                  authorRole={post.authorId === 'default-admin' ? 'admin' : users.find((user) => user.id === post.authorId)?.role || 'user'}
                />
              ))}
            </div>
          ) : (
            <p className="border-t border-slate-200 py-8 text-slate-600">No posts yet — check back soon!</p>
          )}
        </section>
      </main>
      <footer className="bg-slate-800 text-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <nav aria-label="Footer" className="flex flex-wrap gap-6">
            {Object.entries({ Home: '/', 'All Blogs': '/blogs', Login: '/login', Register: '/register' }).map(([label, path]) => (
              <Link key={label} to={path} className="rounded py-2 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2">
                {label}
              </Link>
            ))}
          </nav>
          <p className="mt-8 max-w-[70ch] text-sm leading-relaxed text-slate-300">
            Local demo only. Data stays in this browser and does not sync across devices. Passwords are stored in plaintext.
            Client-side guards are bypassable, not trusted security. Never use real passwords or sensitive information.
          </p>
          <p className="mt-6 text-sm text-slate-300">© {new Date().getFullYear()} WriteSpace</p>
        </div>
      </footer>
    </>
  );
}

LandingPage.propTypes = { session: sessionPropType };
