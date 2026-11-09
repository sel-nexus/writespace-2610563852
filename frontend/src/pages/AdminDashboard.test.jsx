/** Verify local dashboard snapshots, navigation and shared mutation failures. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { getPosts, getUsers, savePosts, saveUsers } from '../utils/storage';
import { setSession } from '../utils/auth';

const admin = { userId: 'default-admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const account = { id: 'author', username: 'mira', displayName: 'Mira', password: 'demo', role: 'user', createdAt: '2026-05-01' };
const future = { v7_startTransition: true, v7_relativeSplatPath: true };

/** Build a complete post owned by another author.
 * Args:
 *   day: Creation day and fixture identifier.
 * Returns:
 *   Persistable post.
 */
function post(day) {
  return {
    id: `p${day}`, title: `Story ${day}`, content: 'Plain text',
    createdAt: `2026-05-0${day}T12:00:00Z`, authorId: 'author', authorName: 'Mira',
  };
}

/** Mount real routes at the requested initial entry. */
function mount(path = '/admin') {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <App />
    </MemoryRouter>,
  );
}

/** Read the four visible numeric definitions in card order. */
function counts() {
  return [...screen.getByLabelText('Local statistics').querySelectorAll('dd')].slice(0, 4).map((item) => item.textContent);
}

describe('AdminDashboard', () => {
  it('derives four stored-array counts and retains unresolved duplicate without render mutations', () => {
    setSession(admin);
    savePosts([post(2), post(1)]);
    saveUsers([account, { ...account, id: 'managed-admin', username: 'ari', role: 'admin' }]);
    const beforePosts = localStorage.getItem('writespace_posts');
    const beforeUsers = localStorage.getItem('writespace_users');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const view = mount();
    const stats = screen.getByLabelText('Local statistics');
    expect([...stats.querySelectorAll('dt')].map((item) => item.textContent)).toEqual([
      'Total Posts', 'Total Users', 'Total Admins', 'Total Users',
    ]);
    expect(counts()).toEqual(['2', '2', '1', '2']);
    expect(within(stats).getByText(/Unresolved: repeated metric/)).toBeInTheDocument();
    expect(screen.getByText(/fixed demo Admin is not included/)).toBeInTheDocument();
    view.unmount();
    mount();
    expect(localStorage.getItem('writespace_posts')).toBe(beforePosts);
    expect(localStorage.getItem('writespace_users')).toBe(beforeUsers);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('shows only five newest posts with author role, literal title, date and override controls', () => {
    setSession(admin);
    const posts = [post(2), post(6), post(1), post(4), post(3), { ...post(5), title: '<script>literal</script>' }];
    savePosts(posts);
    saveUsers([{ ...account, role: 'admin' }]);
    mount();
    const recent = screen.getByRole('region', { name: 'Recent Posts' });
    expect(within(recent).getAllByRole('heading', { level: 3 }).map((item) => item.textContent)).toEqual([
      'Story 6', '<script>literal</script>', 'Story 4', 'Story 3', 'Story 2',
    ]);
    expect(within(recent).getAllByRole('img', { name: 'Admin' })).toHaveLength(5);
    expect(within(recent).getAllByText('By Mira')).toHaveLength(5);
    expect(within(recent).getByText('May 06, 2026')).toBeInTheDocument();
    expect(within(recent).getAllByRole('button', { name: /^Delete / })).toHaveLength(5);
    expect(within(recent).getByRole('link', { name: 'Edit Story 6' })).toHaveAttribute('href', '/edit/p6');
    expect(recent.querySelector('script')).toBeNull();
    expect(getPosts()).toEqual(posts);
  });

  it.each([null, '[]', '{broken', '{}', '[null]'])('does not repair empty or corrupt stores %s', (raw) => {
    setSession(admin);
    if (raw !== null) {
      localStorage.setItem('writespace_posts', raw);
      localStorage.setItem('writespace_users', raw);
    }
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    expect(screen.getByText('No posts yet. Be the first to write!')).toBeInTheDocument();
    expect(counts()).toEqual(['0', '0', '0', '0']);
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    expect(localStorage.getItem('writespace_users')).toBe(raw);
    expect(write).not.toHaveBeenCalled();
  });

  it('uses empty fallback for unavailable collections without writing', () => {
    setSession(admin);
    savePosts([post(1)]);
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(key) {
      if (key !== 'writespace_session') throw new Error('blocked');
      return read.call(this, key);
    });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('No posts yet. Be the first to write!')).toBeInTheDocument();
    expect(counts()).toEqual(['0', '0', '0', '0']);
    expect(write).not.toHaveBeenCalled();
  });

  it('cancels without writes then deletes another author from a fresh snapshot and refreshes counts', async () => {
    setSession(admin);
    savePosts([post(1)]);
    saveUsers([account]);
    mount();
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(screen.getByRole('button', { name: 'Delete Story 1' }));
    expect(confirm).toHaveBeenCalledWith('Delete this post? This cannot be undone.');
    expect(getPosts()).toEqual([post(1)]);
    expect(write).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    savePosts([post(1), post(2)]);
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete Story 1' }));
    expect(getPosts()).toEqual([post(2)]);
    expect(getUsers()).toEqual([account]);
    expect(screen.queryByRole('link', { name: 'Story 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Story 2' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Post deleted locally.');
    expect(counts()[0]).toBe('1');
  });

  it('reports failed persistence honestly, keeps row and permits explicit retry', async () => {
    setSession(admin);
    savePosts([post(1)]);
    mount();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete Story 1' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be deleted locally.*Nothing was deleted/);
    expect(screen.getByRole('link', { name: 'Story 1' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(getPosts()).toEqual([post(1)]);
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Delete Story 1' }));
    expect(getPosts()).toEqual([]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('No posts yet. Be the first to write!')).toBeInTheDocument();
  });

  it('rejects stale target without overwriting posts added during confirmation', async () => {
    setSession(admin);
    savePosts([post(1)]);
    mount();
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      savePosts([post(2)]);
      return true;
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Story 1' }));
    expect(getPosts()).toEqual([post(2)]);
    expect(screen.getByRole('alert')).toHaveTextContent(/no longer exists.*Nothing was deleted/);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it.each([null, { ...admin, userId: 'other', role: 'user' }])('rechecks runtime identity after confirmation %s', async (identity) => {
    setSession(admin);
    savePosts([post(1)]);
    mount();
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (identity) setSession(identity);
      else localStorage.removeItem('writespace_session');
      return true;
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Story 1' }));
    expect(getPosts()).toEqual([post(1)]);
    expect(screen.getByRole('alert')).toHaveTextContent(/no longer have permission.*Nothing was deleted/);
    expect(screen.queryByRole('button', { name: 'Delete Story 1' })).not.toBeInTheDocument();
  });

  it('edits another author through real editor and preserves metadata then returns via navbar', async () => {
    setSession(admin);
    savePosts([post(1)]);
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Edit Story 1' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Story 1');
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Admin revision');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(getPosts()).toEqual([{ ...post(1), title: 'Admin revision' }]);
    expect(screen.getByRole('heading', { name: 'Admin revision' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Dashboard', exact: true }));
    expect(screen.getByRole('link', { name: 'Admin revision' })).toBeInTheDocument();
  });

  it('enters from landing and follows shortcuts leaving users honestly unavailable', async () => {
    setSession(admin);
    mount('/');
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Go to Dashboard' }));
    expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Write a Post' }));
    expect(screen.getByRole('heading', { name: 'Write a Post' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Dashboard', exact: true }));
    await user.click(screen.getByRole('link', { name: 'Manage Users' }));
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(getPosts()).toEqual([]);
    expect(getUsers()).toEqual([]);
  });

  it.each([null, 'user'])('guards dashboard entry for %s without exposing counts', (role) => {
    if (role) setSession({ ...admin, role });
    mount();
    expect(screen.getByRole('heading', { name: role ? 'All Blogs' : 'Login' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Local statistics')).not.toBeInTheDocument();
  });
});
