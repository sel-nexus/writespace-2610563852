/** Exercise discovery composition, entry links and honest unknown-route behavior. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LandingPage from './LandingPage';
import App from '../App';
import { BlogCard } from '../components/BlogCard';
import { Avatar, getAvatar } from '../components/Avatar';

const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const post = { id: 'p1', title: 'Garden notes', content: 'x'.repeat(130), createdAt: '2026-05-02T12:00:00Z', authorId: 'u1', authorName: 'Mira' };

/** Mount real discovery components with explicit test-only future route targets.
 * Args:
 *   identity: Optional local session used by discovery links.
 * Returns:
 *   Testing Library render result.
 */
function renderLanding(identity = null) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<LandingPage session={identity} />} />
        {['/login', '/register', '/blogs', '/admin', '/blog/:id'].map((path) => (
          <Route key={path} path={path} element={<h1>Test target {path}</h1>} />
        ))}
      </Routes>
    </MemoryRouter>,
  );
}

describe('landing discovery', () => {
  it('shows exact tagline, three feature regions, footer and empty state without a mount write', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    renderLanding();
    expect(screen.getByRole('heading', { name: 'WriteSpace', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeInTheDocument();
    for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast', 'Latest from the Blog']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
    expect(screen.getByText(/©.*WriteSpace/)).toHaveTextContent(String(new Date().getFullYear()));
    expect(screen.getByText(/Passwords are stored in plaintext/)).toHaveTextContent(/Never use real passwords/);
    expect(write).not.toHaveBeenCalled();
  });
  it.each(['{broken', '{}', '[null]', '[{"id":"bad","title":{}}]'])('degrades corrupt posts to exact empty copy without rewriting: %s', (raw) => {
    localStorage.setItem('writespace_posts', raw);
    renderLanding();
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
  });
  it('degrades denied reads to the empty state', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    renderLanding();
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  });
  it('renders only newest three plain-text previews, dates and authors without changing persisted order', () => {
    const records = [1, 4, 2, 3].map((day) => ({ ...post, id: `p${day}`, title: `Post ${day}`, createdAt: `2026-05-0${day}T12:00:00Z` }));
    const raw = JSON.stringify(records);
    localStorage.setItem('writespace_posts', raw);
    renderLanding();
    const latest = screen.getByRole('region', { name: 'Latest from the Blog' });
    expect(within(latest).getAllByRole('heading', { level: 3 }).map((item) => item.textContent)).toEqual(['Post 4', 'Post 3', 'Post 2']);
    expect(within(latest).getAllByText('x'.repeat(120))).toHaveLength(3);
    expect(within(latest).getByText('May 04, 2026')).toBeInTheDocument();
    expect(within(latest).getAllByText('Mira')).toHaveLength(3);
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    expect(screen.queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
  });
  it.each([
    ['Start Reading', '/login'], ['Get Started Free', '/register'], ['Get Started', '/register'],
  ])('guest activation of %s reaches %s', async (name, path) => {
    const user = userEvent.setup();
    renderLanding();
    await user.click(screen.getByRole('link', { name, exact: true }));
    expect(screen.getByRole('heading', { name: `Test target ${path}` })).toBeInTheDocument();
  });
  it.each(['Home', 'All Blogs', 'Login', 'Register'])('footer %s has its contracted destination', (name) => {
    renderLanding();
    const footer = screen.getByRole('navigation', { name: 'Footer' });
    const paths = { Home: '/', 'All Blogs': '/blogs', Login: '/login', Register: '/register' };
    expect(within(footer).getByRole('link', { name })).toHaveAttribute('href', paths[name]);
  });
  it('clicks the public login entry', async () => {
    const user = userEvent.setup();
    renderLanding();
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Login' }));
    expect(screen.getByRole('heading', { name: 'Test target /login' })).toBeInTheDocument();
  });
  it('clicks a saved preview reader destination', async () => {
    localStorage.setItem('writespace_posts', JSON.stringify([post]));
    const user = userEvent.setup();
    renderLanding();
    await user.click(screen.getByRole('link', { name: post.title }));
    expect(screen.getByRole('heading', { name: 'Test target /blog/:id' })).toBeInTheDocument();
  });
  it.each(['user', 'admin'])('shows %s identity and activates the role dashboard', async (role) => {
    const user = userEvent.setup();
    renderLanding({ ...session, role });
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByText('Mira')).toBeInTheDocument();
    expect(within(nav).getByRole('img', { name: role === 'admin' ? 'Admin' : 'User' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    await user.click(within(nav).getByRole('link', { name: 'Go to Dashboard' }));
    expect(screen.getByRole('heading', { name: `Test target ${role === 'admin' ? '/admin' : '/blogs'}` })).toBeInTheDocument();
  });
  it.each(['user', 'admin'])('Start Reading sends an existing %s session to the blog list', async (role) => {
    const user = userEvent.setup();
    renderLanding({ ...session, role });
    await user.click(screen.getByRole('link', { name: 'Start Reading' }));
    expect(screen.getByRole('heading', { name: 'Test target /blogs' })).toBeInTheDocument();
  });
  it('toggles the disclosure with keyboard, closes on Escape and closes after link activation', async () => {
    const user = userEvent.setup();
    renderLanding();
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    await user.click(screen.getByRole('link', { name: 'WriteSpace' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('shared preview and avatars', () => {
  it.each([null, { ...session, userId: 'other' }, session, { ...session, role: 'admin' }])('shows only owner or Admin edit links: %s', (identity) => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <BlogCard post={post} session={identity} />
      </MemoryRouter>,
    );
    const edit = screen.queryByRole('link', { name: `Edit ${post.title}` });
    if (identity && (identity.role === 'admin' || identity.userId === post.authorId)) {
      expect(edit).toHaveAttribute('href', '/edit/p1');
    } else {
      expect(edit).not.toBeInTheDocument();
    }
  });
  it('renders hostile text literally and URL-encodes identifiers', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <BlogCard post={{ ...post, id: 'slash/id', title: '<img src=x onerror=alert(1)>', content: '<script>alert(1)</script>' }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '<img src=x onerror=alert(1)>' })).toHaveAttribute('href', '/blog/slash%2Fid');
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script, article img')).toBeNull();
  });
  it('uses crown/violet and book/indigo marks with ordinary-role fallback', () => {
    const { rerender } = render(getAvatar('admin'));
    expect(screen.getByRole('img', { name: 'Admin' })).toHaveClass('bg-violet-600');
    rerender(getAvatar('user'));
    expect(screen.getByRole('img', { name: 'User' })).toHaveClass('bg-indigo-500');
    rerender(<Avatar role="unknown" />);
    expect(screen.getByRole('img', { name: 'User' })).toBeInTheDocument();
  });
});

describe('actual route shell', () => {
  it('reads existing identity for discovery and fails closed when identity becomes malformed', () => {
    localStorage.setItem('writespace_session', JSON.stringify({ ...session, role: 'admin' }));
    const { rerender } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/admin');
    localStorage.setItem('writespace_session', '{bad');
    rerender(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: 'Go to Dashboard' })).not.toBeInTheDocument();
  });
  it.each(['/unknown', '/login', '/register', '/blogs', '/admin', '/write'])(
    'honestly rejects unimplemented path %s and returns home by clicking', async (path) => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to Home' }));
    expect(screen.getByRole('heading', { name: 'WriteSpace', level: 1 })).toBeInTheDocument();
  });
});
