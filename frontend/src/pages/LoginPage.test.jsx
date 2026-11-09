/** Exercise local login, the complete route role matrix, and navigation disclosures. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import App from '../App';
import LoginPage from './LoginPage';

import { ProtectedRoute } from '../components/ProtectedRoute';
import { getSession, setSession } from '../utils/auth';

const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const account = { id: 'u1', username: 'mira', displayName: 'Mira', password: 'demo-only', role: 'user', createdAt: '2026-05-01' };
const future = { v7_startTransition: true, v7_relativeSplatPath: true };

/** Expose the current test route without substituting feature pages.
 * Returns:
 *   Accessible route status for redirect assertions.
 */
function Location() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
}

/** Mount the real app in a test router at an explicit entry.
 * Args:
 *   path: Initial test entry path.
 * Returns:
 *   Testing Library render result.
 */
function renderApp(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}

/** Enter credentials using ordinary input interaction.
 * Args:
 *   user: User-event interaction instance.
 *   username: Exact submitted username.
 *   password: Exact submitted password.
 */
async function login(user, username, password) {
  if (username) await user.type(screen.getByLabelText('Username'), username);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Login', exact: true }));
}

describe('Login', () => {
  it('renders disclosure, credential hints and entry links without writing on render', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    renderApp();
    expect(screen.getByText(/Demo Admin credentials/)).toHaveTextContent('username admin, password admin');
    expect(screen.getByText(/Passwords are stored in plaintext/)).toHaveTextContent(/Never use real passwords/);
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
    expect(write).not.toHaveBeenCalled();
  });
  it.each(['user', 'admin'])('persists stored %s identity before role navigation', async (role) => {
    localStorage.setItem('writespace_users', JSON.stringify([{ ...account, role }]));
    const user = userEvent.setup();
    renderApp();
    await login(user, 'mira', 'demo-only');
    expect(getSession()).toEqual({ ...session, role });
    expect(screen.getByLabelText('Current route')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
    expect(screen.getByRole('heading', { name: role === 'admin' ? 'Page not found' : 'All Blogs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mira/ })).toBeInTheDocument();
  });
  it('logs fixed Admin in before a colliding stored account', async () => {
    localStorage.setItem('writespace_users', JSON.stringify([{ ...account, username: 'admin', password: 'admin' }]));
    const user = userEvent.setup();
    renderApp();
    await login(user, 'admin', 'admin');
    expect(getSession()?.userId).toBe('default-admin');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
  });
  it.each([['mira', 'wrong'], ['', ''], ['Admin', 'admin'], ['admin', 'admin ']])(
    'shows exact invalid message without navigation or session write for %s', async (username, password) => {
      const user = userEvent.setup();
      renderApp();
      await login(user, username, password);
      expect(screen.getByRole('alert')).toHaveTextContent(/^Invalid username or password\.$/);
      expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText('Password')).toHaveAttribute('aria-describedby', 'login-error');
      expect(getSession()).toBeNull();
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    },
  );
  it('does not navigate on persistence failure and retains values for an explicit retry', async () => {
    const user = userEvent.setup();
    renderApp();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    await login(user, 'admin', 'admin');
    expect(screen.getByRole('alert')).toHaveTextContent(/session could not be saved locally/);
    expect(screen.getByLabelText('Username')).toHaveValue('admin');
    expect(screen.getByLabelText('Password')).toHaveValue('admin');
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Login', exact: true }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
  });
  it('leaves an existing session unchanged on invalid submission to an isolated form', async () => {
    setSession(session);
    render(
      <MemoryRouter future={future}>
        <LoginPage />
      </MemoryRouter>,
    );
    await login(userEvent.setup(), 'mira', 'wrong');
    expect(getSession()).toEqual(session);
  });
  it('returns home and follows the registration entry without creating accounts', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
    expect(localStorage.getItem('writespace_users')).toBeNull();
    await user.click(screen.getByRole('link', { name: 'Back to Home' }));
    expect(screen.getByRole('heading', { name: 'WriteSpace', level: 1 })).toBeInTheDocument();
  });
});

describe('route matrix', () => {
  for (const role of [null, 'user', 'admin']) {
    it.each(['/blogs', '/blog/p1', '/write', '/edit/p1', '/admin', '/users'])(
      `resolves ${role || 'guest'} access to %s before showing content`, (path) => {
        if (role) setSession({ ...session, role });
        const write = vi.spyOn(Storage.prototype, 'setItem');
        renderApp(path);
        const destination = !role ? '/login' : role === 'user' && ['/admin', '/users'].includes(path) ? '/blogs' : path;
        expect(screen.getByLabelText('Current route')).toHaveTextContent(destination);
        const heading = !role ? 'Login' : destination === '/blogs' ? 'All Blogs'
          : path === '/write' ? 'Write a Post' : path.startsWith('/blog/') || path.startsWith('/edit/') ? 'Post not found' : 'Page not found';
        expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
        expect(write).not.toHaveBeenCalled();
      },
    );
  }
  it.each(['user', 'admin'])('redirects both auth entry routes for an existing %s', (role) => {
    setSession({ ...session, role });
    const view = renderApp('/register');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
    view.unmount();
    renderApp('/login');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
  });
  it.each(['{broken', '{}', '{"userId":"u1","username":"mira","displayName":"Mira","role":"superuser"}'])(
    'fails closed for malformed stored identity %s', (raw) => {
      localStorage.setItem('writespace_session', raw);
      renderApp('/users');
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
      expect(localStorage.getItem('writespace_session')).toBe(raw);
    },
  );
  it('guards without mounting protected children and allows Admin content in a test-only destination', () => {
    setSession({ ...session, role: 'admin' });
    render(
      <MemoryRouter initialEntries={['/users']} future={future}>
        <Routes>
          <Route
            path="/users"
            element={
              <ProtectedRoute adminOnly>
                <h1>Allowed test destination</h1>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Allowed test destination' })).toBeInTheDocument();
  });
  it.each([null, 'user'])('does not render Admin children for %s', (role) => {
    if (role) setSession({ ...session, role });
    render(
      <MemoryRouter initialEntries={['/users']} future={future}>
        <Routes>
          <Route
            path="/users"
            element={
              <ProtectedRoute adminOnly>
                <h1>Private test content</h1>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<h1>Guest destination</h1>} />
          <Route path="/blogs" element={<h1>User destination</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('heading', { name: 'Private test content' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: role ? 'User destination' : 'Guest destination' })).toBeInTheDocument();
  });
  it('defaults to guest when route-time storage reads are denied', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    renderApp('/admin');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
  });
});

describe('authenticated navigation', () => {
  it.each(['user', 'admin'])('shows active and role-correct links for %s with no mount mutation', (role) => {
    setSession({ ...session, role });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    renderApp('/blogs');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'All Blogs' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'All Blogs' })).toHaveClass('font-semibold');
    expect(within(nav).getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/write');
    expect(within(nav).queryByRole('link', { name: 'Users' }) !== null).toBe(role === 'admin');
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it('toggles mobile and account disclosures, closes with Escape and restores account focus', async () => {
    setSession(session);
    const user = userEvent.setup();
    renderApp('/blogs');
    const mobile = screen.getByRole('button', { name: 'Open menu' });
    await user.click(mobile);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    const accountButton = screen.getByRole('button', { name: /Mira/ });
    await user.click(accountButton);
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(accountButton).toHaveFocus();
    expect(accountButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    await user.click(accountButton);
    await user.click(accountButton);
    expect(accountButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(mobile);
    await user.click(screen.getByRole('link', { name: 'Write' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/write');
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  });
  it('follows account dashboard and brand links while closing disclosures', async () => {
    setSession({ ...session, role: 'admin' });
    const user = userEvent.setup();
    renderApp('/blogs');
    await user.click(screen.getByRole('button', { name: /Mira/ }));
    await user.click(screen.getByRole('link', { name: 'Go to Dashboard' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
    expect(screen.getByRole('button', { name: /Mira/ })).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('link', { name: 'WriteSpace', exact: true }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/admin');
  });
  it('retains sign-in after failed logout and removes only session after retry', async () => {
    setSession(session);
    localStorage.setItem('writespace_posts', '[]');
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    const user = userEvent.setup();
    renderApp('/blogs');
    await user.click(screen.getByRole('button', { name: /Mira/ }));
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/still signed in/);
    expect(getSession()).toEqual(session);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    remove.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    expect(localStorage.getItem('writespace_posts')).toBe('[]');
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual([account]);
  });
});
