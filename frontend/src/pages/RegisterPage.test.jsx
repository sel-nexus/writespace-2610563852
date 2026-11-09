/** Verify registration UI, local persistence, redirects, and nonduplicate recovery. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { getUsers } from '../utils/storage';
import { getSession, setSession } from '../utils/auth';

const draft = { 'Display name': ' Mira Chen ', Username: 'mira', Password: ' demo-only ', 'Confirm password': ' demo-only ' };
const future = { v7_startTransition: true, v7_relativeSplatPath: true };

/** Expose the current router destination for honest unimplemented-page assertions. */
function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}

/** Mount the real route shell at registration without inventing a blog feature. */
function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/register']} future={future}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}

/** Enter each submitted field through ordinary browser interactions.
 * Args:
 *   user: User-event instance.
 *   values: Label-to-value draft.
 */
async function fill(user, values = draft) {
  for (const [label, value] of Object.entries(values)) {
    if (value) await user.type(screen.getByLabelText(label, { exact: true }), value);
  }
}

describe('RegisterPage', () => {
  it('renders labels, required semantics, warnings, and links without a mount write', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    renderApp();
    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
    for (const label of Object.keys(draft)) expect(screen.getByLabelText(label)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText(/Passwords are stored in plaintext/)).toHaveTextContent(/Never use real passwords/);
    expect(screen.getByText(/Passwords are stored in plaintext/)).toHaveTextContent(/does not sync/);
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(write).not.toHaveBeenCalled();
  });
  it('saves account and credential-free identity before navigating to the current not-found blogs route', async () => {
    const user = userEvent.setup();
    renderApp();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(getUsers()).toHaveLength(1);
    expect(getUsers()[0]).toMatchObject({ displayName: 'Mira Chen', username: 'mira', password: ' demo-only ', role: 'user' });
    expect(getSession()).toEqual({ userId: getUsers()[0].id, displayName: 'Mira Chen', username: 'mira', role: 'user' });
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
  it.each(Object.keys(draft))('associates only the missing %s field with its alert and retains other values', async (label) => {
    const user = userEvent.setup();
    renderApp();
    await fill(user, { ...draft, [label]: '' });
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    const field = screen.getByLabelText(label);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(field.getAttribute('aria-describedby'))).toHaveAttribute('role', 'alert');
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
  });
  it.each([
    ['reserved', { ...draft, Username: 'AdMiN' }, 'This username is reserved.'],
    ['mismatch', { ...draft, 'Confirm password': 'different' }, 'Passwords do not match.'],
  ])('shows %s error without persistence', async (_kind, values, message) => {
    const user = userEvent.setup();
    renderApp();
    await fill(user, values);
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
  it('checks fresh accounts added after form mount and lets the visitor correct a duplicate', async () => {
    const user = userEvent.setup();
    renderApp();
    await fill(user);
    localStorage.setItem('writespace_users', JSON.stringify([
      { id: 'u1', displayName: 'Existing', username: 'MIRA', password: 'demo', role: 'user', createdAt: '2026-05-01' },
    ]));
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('This username is already taken.');
    expect(getUsers()).toHaveLength(1);
    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'new-mira');
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(getUsers()).toHaveLength(2);
    expect(getSession()?.username).toBe('new-mira');
  });
  it('retains draft and allows explicit retry after account persistence failure', async () => {
    const user = userEvent.setup();
    renderApp();
    await fill(user);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent(/account could not be saved locally/);
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue(draft.Password);
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
    expect(screen.getByRole('button', { name: 'Register' })).toBeEnabled();
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(getUsers()).toHaveLength(1);
  });
  it('shows generation failure without account writes or navigation', async () => {
    const user = userEvent.setup();
    renderApp();
    await fill(user);
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable'); });
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Nothing was saved/);
    expect(getUsers()).toEqual([]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
  });
  it('locks registration after session failure and recovers through Login without duplicating the account', async () => {
    const user = userEvent.setup();
    renderApp();
    await fill(user);
    const original = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function writeKey(key, value) {
      if (key === 'writespace_session') throw new Error('session blocked');
      original.call(this, key, value);
    });
    await user.click(screen.getByRole('button', { name: 'Register', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Account created.*Sign in using Login/);
    expect(screen.getByRole('button', { name: 'Account created' })).toBeDisabled();
    expect(screen.getByLabelText('Username')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Account created' }));
    await user.keyboard('{Enter}');
    expect(getUsers()).toHaveLength(1);
    expect(getSession()).toBeNull();
    write.mockRestore();
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Login' }));
    await user.type(screen.getByLabelText('Username'), 'mira');
    await user.type(screen.getByLabelText('Password'), draft.Password);
    await user.click(screen.getByRole('button', { name: 'Login', exact: true }));
    expect(getSession()?.userId).toBe(getUsers()[0].id);
    expect(getUsers()).toHaveLength(1);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  });
  it.each(['user', 'admin'])('redirects an authenticated %s to role home without a registration write', (role) => {
    setSession({ userId: 'u1', displayName: 'Mira', username: 'mira', role });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    renderApp();
    expect(screen.getByLabelText('Current route')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
    expect(screen.queryByRole('heading', { name: 'Register' })).not.toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
  });
  it('returns to discovery through the form home link without creating an account', async () => {
    renderApp();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to Home' }));
    expect(screen.getByRole('heading', { name: 'WriteSpace', level: 1 })).toBeInTheDocument();
    expect(getUsers()).toEqual([]);
  });
});
