/** Exercise real App routes and persisted post state through semantic user interactions. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { getPosts, savePosts } from '../utils/storage';
import { setSession } from '../utils/auth';

const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const post = { id: 'p1', title: 'Garden', content: '  First line\nSecond line  ', createdAt: '2026-05-01', authorId: 'u1', authorName: 'Mira' };

/** Expose routing without substituting a feature page. */
function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}

/** Mount actual pages with local persisted fixtures.
 * Args:
 *   path: Initial route.
 *   identity: Session fixture, or null for guest.
 */
function mount(path = '/blogs', identity = session) {
  if (identity) setSession(identity);
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}

describe('post list and reader', () => {
  it.each([null, '{broken', '{}', '[null]'])('shows exact empty state without repairing storage %s', (raw) => {
    if (raw !== null) localStorage.setItem('writespace_posts', raw);
    mount();
    expect(screen.getByText('No posts yet. Be the first to write!')).toBeInTheDocument();
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
  });
  it('lists all newest-first with 120-character excerpts, dates, authors and owner links without a render write', () => {
    const records = [1, 4, 2, 3].map((day) => ({
      ...post, id: `p${day}`, title: `Post ${day}`, content: 'x'.repeat(130), createdAt: `2026-05-0${day}`,
      authorId: day === 1 ? 'u1' : 'other',
    }));
    savePosts(records);
    setSession(session);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount('/blogs', null);
    expect(screen.getAllByRole('article').map((article) => within(article).getByRole('heading').textContent))
      .toEqual(['Post 4', 'Post 3', 'Post 2', 'Post 1']);
    expect(screen.getAllByText('x'.repeat(120))).toHaveLength(4);
    expect(screen.getByText('May 04, 2026')).toBeInTheDocument();
    for (const article of screen.getAllByRole('article')) {
      expect(within(article).getByText('Mira')).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Edit Post 1' })).toHaveAttribute('href', '/edit/p1');
    expect(screen.queryByRole('link', { name: 'Edit Post 4' })).not.toBeInTheDocument();
    expect(getPosts()).toEqual(records);
    expect(write).not.toHaveBeenCalled();
  });
  it('reads full hostile text and whitespace literally by clicking the list', async () => {
    const hostile = { ...post, title: '<img src=x onerror=alert(1)>', content: '<script>alert(1)</script>\n' + 'x'.repeat(200) };
    savePosts([hostile]);
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('link', { name: hostile.title, exact: true }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(hostile.title);
    const body = screen.getByText(hostile.content, { normalizer: (value) => value });
    expect(body).toHaveClass('whitespace-pre-wrap');
    expect(body.textContent).toBe(hostile.content);
    expect(document.querySelector('article script, article img')).toBeNull();
    await user.click(screen.getByRole('link', { name: 'Back to Blogs' }));
    expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeInTheDocument();
    expect(getPosts()).toEqual([hostile]);
  });
  it.each(['/blog/missing', '/edit/missing'])('shows Post not found and a working return for %s', async (path) => {
    mount(path);
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to Blogs' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(getPosts()).toEqual([]);
  });
  it.each(['/blogs', '/blog/p1', '/write', '/edit/p1'])('guards guest %s before displaying protected data', (path) => {
    savePosts([post]);
    mount(path, null);
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(screen.queryByText(post.content)).not.toBeInTheDocument();
    expect(getPosts()).toEqual([post]);
  });
  it('hides other-author controls and rejects direct editing without writes', () => {
    savePosts([{ ...post, authorId: 'other' }]);
    const view = mount('/blog/p1');
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    view.unmount();
    mount('/edit/p1');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(getPosts()).toEqual([{ ...post, authorId: 'other' }]);
  });
});

describe('publishing and editing', () => {
  it('publishes through the list entry and reads persisted metadata and full body after remount', async () => {
    const user = userEvent.setup();
    const view = mount();
    await user.click(screen.getByRole('link', { name: 'Write a Post' }));
    await user.type(screen.getByLabelText('Title'), ' New garden ');
    await user.type(screen.getByLabelText('Content'), post.content);
    expect(screen.getByText(`${post.content.length} characters`)).toBeInTheDocument();
    expect(screen.getByLabelText('Content')).toHaveClass('min-h-64');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    const saved = getPosts()[0];
    expect(saved).toMatchObject({ title: 'New garden', content: post.content, authorId: 'u1', authorName: 'Mira' });
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
    expect(screen.getByLabelText('Current route')).toHaveTextContent(`/blog/${saved.id}`);
    view.unmount();
    mount(`/blog/${saved.id}`);
    expect(screen.getByRole('heading', { name: 'New garden' })).toBeInTheDocument();
    expect(screen.getByText(post.content, { normalizer: (value) => value }).textContent).toBe(post.content);
  });
  it.each(['user', 'admin'])('prefills and saves %s edit preserving every original metadata field', async (role) => {
    savePosts([post]);
    const user = userEvent.setup();
    mount('/blog/p1', { ...session, role, userId: role === 'admin' ? 'admin-id' : 'u1' });
    await user.click(screen.getByRole('link', { name: 'Edit', exact: true }));
    expect(screen.getByLabelText('Title')).toHaveValue(post.title);
    expect(screen.getByLabelText('Content')).toHaveValue(post.content);
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Updated');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(getPosts()).toEqual([{ ...post, title: 'Updated' }]);
    expect(screen.getByRole('heading', { name: 'Updated' })).toBeInTheDocument();
  });
  it.each(['/write', '/edit/p1'])('Cancel on %s leaves persistence unchanged', async (path) => {
    savePosts([post]);
    mount(path);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Title'), 'unsaved');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(getPosts()).toEqual([post]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  });
  it.each(['Title', 'Content'])('shows associated required %s error and no write', async (field) => {
    mount('/write');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(field === 'Title' ? 'Content' : 'Title'), 'Present');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByRole('alert')).toHaveTextContent(`${field} is required.`);
    expect(screen.getByLabelText(field)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(field)).toHaveAccessibleDescription(new RegExp(`${field} is required`));
    expect(getPosts()).toEqual([]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/write');
  });
  it.each(['/write', '/edit/p1'])('retains draft on quota failure at %s and retries against fresh posts', async (path) => {
    savePosts([post]);
    mount(path);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Retained');
    if (path === '/write') await user.type(screen.getByLabelText('Content'), 'Body');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await user.click(screen.getByRole('button', { name: path === '/write' ? 'Publish' : 'Save Changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be saved locally.*draft is still here/);
    expect(screen.getByLabelText('Title')).toHaveValue('Retained');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
    expect(getPosts()).toEqual([post]);
    write.mockRestore();
    savePosts([post, { ...post, id: 'p2' }]);
    await user.click(screen.getByRole('button', { name: path === '/write' ? 'Publish' : 'Save Changes' }));
    expect(getPosts()).toHaveLength(path === '/write' ? 3 : 2);
    expect(getPosts().find((item) => item.title === 'Retained')).toBeDefined();
  });
  it('shows generation failure without navigating or discarding draft', async () => {
    mount('/write');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Title'), 'Draft');
    await user.type(screen.getByLabelText('Content'), 'Body');
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable'); });
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be prepared.*Nothing was saved/);
    expect(screen.getByLabelText('Title')).toHaveValue('Draft');
    expect(getPosts()).toEqual([]);
  });
  it.each(['missing', 'ownership', 'session'])('rejects stale edit %s at save time', async (change) => {
    savePosts([post]);
    mount('/edit/p1');
    if (change === 'missing') savePosts([]);
    if (change === 'ownership') savePosts([{ ...post, authorId: 'other' }]);
    if (change === 'session') localStorage.setItem('writespace_session', '{broken');
    const raw = localStorage.getItem('writespace_posts');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    if (change === 'missing') expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
    else expect(screen.getByLabelText('Current route')).toHaveTextContent(change === 'session' ? '/login' : '/blogs');
  });
  it('accepts pasted large content without truncating and has no render mutations', async () => {
    mount('/write');
    const user = userEvent.setup();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await user.type(screen.getByLabelText('Title'), 'Large');
    await user.click(screen.getByLabelText('Content'));
    await user.paste('x'.repeat(100000));
    expect(screen.getByText('100000 characters')).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(getPosts()[0].content).toHaveLength(100000);
  });
});

describe('confirmed deletion', () => {
  it.each(['user', 'admin'])('cancels and then deletes as %s through real controls', async (role) => {
    savePosts([post]);
    mount('/blog/p1', { ...session, role, userId: role === 'admin' ? 'other' : 'u1' });
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(getPosts()).toEqual([post]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blog/p1');
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(getPosts()).toEqual([]);
    expect(screen.getByText('No posts yet. Be the first to write!')).toBeInTheDocument();
  });
  it.each(['missing', 'ownership', 'session', 'quota'])('rechecks %s after confirmation and does not delete', async (change) => {
    savePosts([post]);
    mount('/blog/p1');
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (change === 'missing') savePosts([]);
      if (change === 'ownership') savePosts([{ ...post, authorId: 'other' }]);
      if (change === 'session') localStorage.setItem('writespace_session', '{broken');
      return true;
    });
    if (change === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(getPosts()).toEqual(change === 'missing' ? [] : [{ ...post, authorId: change === 'ownership' ? 'other' : 'u1' }]);
    if (change === 'missing') expect(screen.getByRole('heading', { name: 'Post not found' })).toBeInTheDocument();
    if (change === 'quota') {
      expect(screen.getByRole('alert')).toHaveTextContent(/Nothing was deleted/);
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/blog/p1');
    }
    if (change === 'ownership' || change === 'session') {
      expect(screen.getByLabelText('Current route')).toHaveTextContent(change === 'session' ? '/login' : '/blogs');
    }
  });
});
