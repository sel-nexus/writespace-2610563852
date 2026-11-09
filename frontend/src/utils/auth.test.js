/** Exercise exact demo authentication, fail-closed sessions, and storage failures. */
import { describe, expect, it, vi } from 'vitest';
import { authenticate, clearSession, getSession, roleHome, setSession } from './auth';

const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const account = { id: 'u1', username: 'mira', displayName: 'Mira', password: 'demo-only', role: 'user' };

describe('authentication', () => {
  it('gives fixed Admin precedence over matching stored accounts without writing', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(authenticate('admin', 'admin', [{ ...account, username: 'admin', password: 'admin' }])).toEqual({
      userId: 'default-admin', username: 'admin', displayName: 'Admin', role: 'admin',
    });
    expect(authenticate('admin', 'admin', null)?.userId).toBe('default-admin');
    expect(write).not.toHaveBeenCalled();
  });
  it.each(['user', 'admin'])('maps a stored %s account without persisting or leaking its password', (role) => {
    const users = [{ ...account, role }];
    expect(authenticate('mira', 'demo-only', users)).toEqual({ ...session, role });
    expect(users).toEqual([{ ...account, role }]);
    expect(getSession()).toBeNull();
  });
  it.each([
    ['Mira', 'demo-only'], [' mira', 'demo-only'], ['mira', 'demo-only '], ['admin', 'Admin'],
    ['', 'demo-only'], [' ', 'demo-only'], ['mira', ''], ['mira', ' '], [null, 'demo-only'],
    [7, 'demo-only'], ['mira', undefined], ['mira', {}], ['missing', 'demo-only'],
  ])('rejects invalid or non-exact credentials %s / %s and retains existing session', (username, password) => {
    setSession(session);
    expect(authenticate(username, password, [account])).toBeNull();
    expect(getSession()).toEqual(session);
  });
  it.each([undefined, null, {}, 'users', [], [null], [{}], [{ ...account, role: 'superuser' }], [{ ...account, id: '' }]])(
    'fails closed on unusable accounts %s', (users) => {
      expect(authenticate('mira', 'demo-only', users)).toBeNull();
    },
  );
});

describe('session persistence', () => {
  it.each(['user', 'admin'])('round-trips %s identity and reads fresh snapshots', (role) => {
    expect(setSession({ ...session, role })).toEqual({ ok: true });
    const first = getSession();
    first.displayName = 'memory only';
    expect(getSession()).toEqual({ ...session, role });
    expect(roleHome({ ...session, role })).toBe(role === 'admin' ? '/admin' : '/blogs');
  });
  it('handles absent identity without render-like writes or removal', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    expect(getSession()).toBeNull();
    expect(roleHome(null)).toBe('/login');
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it.each(['{broken', 'null', '[]', '{}', '42', '"session"'])('preserves malformed raw data %s and fails closed', (raw) => {
    localStorage.setItem('writespace_session', raw);
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('writespace_session')).toBe(raw);
  });
  it.each(Object.keys(session))('rejects each missing, blank, or wrong-type required field %s', (field) => {
    for (const value of [undefined, null, '', '  ', {}, [], 7]) {
      const invalid = { ...session, [field]: value };
      localStorage.setItem('writespace_session', JSON.stringify(invalid));
      expect(getSession()).toBeNull();
      expect(setSession(invalid)).toEqual({ ok: false, error: 'invalid_data' });
      expect(roleHome(invalid)).toBe('/login');
    }
  });
  it.each(['Admin', 'superuser'])('rejects unsupported role %s', (role) => {
    expect(setSession({ ...session, role })).toEqual({ ok: false, error: 'invalid_data' });
    expect(roleHome({ ...session, role })).toBe('/login');
  });
  it.each([undefined, null, [], {}, 7])('rejects invalid identity replacement %s without changing prior data', (value) => {
    setSession(session);
    expect(setSession(value)).toEqual({ ok: false, error: 'invalid_data' });
    expect(getSession()).toEqual(session);
  });
  it('contains denied reads', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getSession()).toBeNull();
  });
  it('contains throwing localStorage property access for every operation', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(getSession()).toBeNull();
    expect(setSession(session)).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(clearSession()).toEqual({ ok: false, error: 'storage_unavailable' });
  });
  it('contains unavailable browser storage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getSession()).toBeNull();
    expect(setSession(session)).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(clearSession()).toEqual({ ok: false, error: 'storage_unavailable' });
  });
  it('preserves identity when a quota-denied write fails', () => {
    setSession(session);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(setSession({ ...session, role: 'admin' })).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(getSession()).toEqual(session);
  });
  it('contains cyclic and throwing serialization without replacing identity', () => {
    setSession(session);
    const cyclic = { ...session };
    cyclic.self = cyclic;
    expect(setSession(cyclic)).toEqual({ ok: false, error: 'serialization_failed' });
    expect(setSession({ ...session, toJSON() { throw new Error('serialize'); } })).toEqual({
      ok: false, error: 'serialization_failed',
    });
    expect(getSession()).toEqual(session);
  });
  it('rejects serialization hooks producing invalid identity', () => {
    expect(setSession({ ...session, toJSON() { return {}; } })).toEqual({ ok: false, error: 'invalid_data' });
    expect(setSession({ ...session, toJSON() { return undefined; } })).toEqual({ ok: false, error: 'invalid_data' });
    expect(getSession()).toBeNull();
  });
  it('writes and removes only session, retaining posts, users and unrelated data', () => {
    for (const key of ['writespace_posts', 'writespace_users', 'unrelated']) localStorage.setItem(key, 'keep');
    expect(setSession(session)).toEqual({ ok: true });
    expect(clearSession()).toEqual({ ok: true });
    expect(clearSession()).toEqual({ ok: true });
    expect(getSession()).toBeNull();
    for (const key of ['writespace_posts', 'writespace_users', 'unrelated']) expect(localStorage.getItem(key)).toBe('keep');
    localStorage.removeItem('unrelated');
  });
  it('retains signed-in identity when removal is denied', () => {
    setSession(session);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(clearSession()).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(getSession()).toEqual(session);
  });
});
