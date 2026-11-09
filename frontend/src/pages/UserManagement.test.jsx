/** Exercise real users routes and services through accessible user interactions. */
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { getSession, setSession } from '../utils/auth';
import { getUsers, saveUsers, STORAGE_KEYS } from '../utils/storage';

const admin = { userId: 'default-admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const account = { id: 'ari', displayName: 'Ari', username: 'ari', password: 'demo-only', role: 'admin', createdAt: '2026-05-01' };

/** Mount the actual route shell, including guards, in strict mode.
 * Args:
 *   path: Initial route under test.
 * Returns:
 *   Mounted view for remount and persistence checks.
 */
function mount(path = '/users') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
}

/** Enter a valid demo draft using labeled fields.
 * Args:
 *   user: Interaction instance.
 *   role: Role selected for the new account.
 */
async function fill(user, role = 'user') {
  await user.type(screen.getByLabelText('Display name'), 'Mira');
  await user.type(screen.getByLabelText('Username'), 'mira');
  await user.type(screen.getByLabelText('Password'), 'new-demo-only');
  await user.selectOptions(screen.getByLabelText('Role'), role);
}

describe('UserManagement', () => {
  it('renders semantic desktop rows/mobile cards and protected default without credential leaks or mount mutations', async () => {
    setSession(admin);
    saveUsers([account]);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const view = mount();
    const table = screen.getByRole('table', { name: 'Local accounts' });
    expect(table).toHaveClass('block', 'sm:table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(4);
    expect(within(table).getAllByRole('columnheader')[0]).toHaveAttribute('scope', 'col');
    expect(within(table).getAllByRole('row')[1]).toHaveClass('block', 'sm:table-row');
    const fixed = screen.getByRole('button', { name: 'Delete admin' });
    expect(fixed).toBeDisabled();
    expect(fixed.parentElement).toHaveAttribute('title', 'Default admin cannot be deleted.');
    expect(fixed).toHaveAccessibleDescription('Default admin cannot be deleted.');
    expect(screen.getByRole('button', { name: 'Delete ari' })).toBeEnabled();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(table).not.toHaveTextContent(account.password);
    view.unmount();
    mount();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(getUsers()).toEqual([account]);
  });
  it.each([null, '[]', '{broken', '{}', '[null]'])('shows fixed Admin and empty fallback without repairing %s', (raw) => {
    setSession(admin);
    if (raw !== null) localStorage.setItem(STORAGE_KEYS.users, raw);
    mount();
    expect(screen.getByText('No managed accounts yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(raw);
  });
  it('uses inaccessible collection fallback without rewriting storage', () => {
    setSession(admin);
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function readKey(key) {
      if (key === STORAGE_KEYS.users) throw Error('blocked');
      return read.call(this, key);
    });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    expect(screen.getByText('No managed accounts yet.')).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
  });
  it.each(['user', 'admin'])('creates %s without switching identity, refreshes rows and persists across remount', async (role) => {
    setSession(admin);
    mount('/admin');
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Manage Users' }));
    await fill(user, role);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(getUsers()[0]).toMatchObject({ username: 'mira', displayName: 'Mira', role, password: 'new-demo-only' });
    expect(getSession()).toEqual(admin);
    expect(screen.getByRole('status')).toHaveTextContent('Account created locally. Your sign-in is unchanged.');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Delete mira' })).toBeEnabled();
    await user.click(screen.getByRole('link', { name: 'Dashboard', exact: true }));
    await user.click(screen.getByRole('link', { name: 'Users', exact: true }));
    expect(screen.getByRole('button', { name: 'Delete mira' })).toBeInTheDocument();
  });
  it('associates required errors then rejects reserved and freshly duplicated usernames while retaining draft', async () => {
    setSession(admin);
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    for (const label of ['Display name', 'Username', 'Password']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(label + ' is required.');
    }
    await fill(user);
    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), ' AdMiN ');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('This username is reserved.');
    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'mira');
    saveUsers([{ ...account, username: ' MIRA ' }]);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('This username is already taken.');
    expect(screen.getByLabelText('Password')).toHaveValue('new-demo-only');
    expect(getUsers()).toHaveLength(1);
  });
  it.each(['storage', 'generation', 'serialization'])('retains failed creation draft on %s failure with no false success', async (failure) => {
    setSession(admin);
    mount();
    const user = userEvent.setup();
    await fill(user, 'admin');
    const stringify = JSON.stringify;
    const fault = failure === 'storage' ? vi.spyOn(Storage.prototype, 'setItem')
      : failure === 'generation' ? vi.spyOn(crypto, 'randomUUID') : vi.spyOn(JSON, 'stringify');
    fault.mockImplementation((value) => {
      if (failure !== 'serialization' || (Array.isArray(value) && value.some((item) => item?.username === 'mira'))) {
        throw Error('failure');
      }
      return stringify(value);
    });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Nothing was saved/);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByLabelText('Display name')).toHaveValue('Mira');
    expect(screen.getByLabelText('Password')).toHaveValue('new-demo-only');
    expect(screen.getByLabelText('Role')).toHaveValue('admin');
    expect(getUsers()).toEqual([]);
    fault.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(getUsers()).toHaveLength(1);
  });
  it('cancels then removes an eligible account from fresh records without changing posts', async () => {
    setSession(admin);
    saveUsers([account]);
    localStorage.setItem(STORAGE_KEYS.posts, 'retained post bytes');
    mount();
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'Delete ari' }));
    expect(getUsers()).toEqual([account]);
    expect(screen.getByRole('status')).toHaveTextContent('Deletion canceled. Nothing was deleted.');
    saveUsers([account, { ...account, id: 'newer', username: 'newer' }]);
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete ari' }));
    expect(getUsers().map((item) => item.id)).toEqual(['newer']);
    expect(screen.queryByRole('button', { name: 'Delete ari' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete newer' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Account deleted locally. Its posts remain unchanged.');
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe('retained post bytes');
  });
  it('protects active identity and never opens confirmation for disabled actions', async () => {
    setSession({ ...admin, userId: account.id, username: account.username });
    saveUsers([account]);
    mount();
    const confirm = vi.spyOn(window, 'confirm');
    const active = screen.getByRole('button', { name: 'Delete ari' });
    expect(active).toBeDisabled();
    expect(active).toHaveAccessibleDescription('Your active account cannot be deleted.');
    await userEvent.setup().click(active);
    expect(confirm).not.toHaveBeenCalled();
    expect(getUsers()).toEqual([account]);
  });
  it('retains failed deletion row and retries explicitly', async () => {
    setSession(admin);
    saveUsers([account]);
    mount();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete ari' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be saved locally/);
    expect(getUsers()).toEqual([account]);
    expect(screen.getByRole('button', { name: 'Delete ari' })).toBeInTheDocument();
    write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Delete ari' }));
    expect(getUsers()).toEqual([]);
  });
  it.each(['missing', 'self', 'user', 'guest', 'reserved'])('rechecks %s change during confirmation and does not delete', async (change) => {
    setSession(admin);
    saveUsers([account]);
    mount();
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (change === 'missing') saveUsers([]);
      if (change === 'self') setSession({ ...admin, userId: account.id });
      if (change === 'user') setSession({ ...admin, role: 'user' });
      if (change === 'guest') localStorage.removeItem(STORAGE_KEYS.session);
      if (change === 'reserved') saveUsers([{ ...account, username: 'ADMIN' }]);
      return true;
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete ari' }));
    expect(screen.getByRole('alert')).toHaveTextContent(change === 'missing' ? /no longer exists/ : /no longer have permission/);
    expect(getUsers()).toHaveLength(change === 'missing' ? 0 : 1);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
  it('rejects creation after the mounted Admin session changes', async () => {
    setSession(admin);
    mount();
    const user = userEvent.setup();
    await fill(user);
    setSession({ ...admin, role: 'user' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(getUsers()).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent(/no longer have permission/);
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });
  it.each([null, 'user'])('guards users route for %s before mounting management controls', (role) => {
    if (role) setSession({ ...admin, role });
    mount();
    expect(screen.getByRole('heading', { name: role ? 'All Blogs' : 'Login' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
  });
});
