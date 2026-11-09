/** Exercise registration against real local storage and injected boundary failures. */
import { describe, expect, it, vi } from 'vitest';
import { registerUser } from './accounts';
import { getUsers, STORAGE_KEYS } from './storage';
import { authenticate, getSession, setSession } from './auth';

const input = { displayName: ' Mira Chen ', username: ' Mira ', password: ' demo-only ', confirmPassword: ' demo-only ' };
const existing = { id: 'other-id', displayName: 'Other', username: 'other', password: 'demo', role: 'admin', createdAt: '2026-05-01' };
const id = '3f24cf57-59f0-4e06-a68c-74d55814cc11';

describe('registerUser', () => {
  it('generates UUID and ISO timestamp, trims identity only, ignores privileged input, and saves account before session', () => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([existing]));
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-05-02T12:00:00.000Z');
    const original = Storage.prototype.setItem;
    const order = [];
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function write(key, value) {
      if (key === STORAGE_KEYS.session) expect(getUsers()).toHaveLength(2);
      order.push(key);
      original.call(this, key, value);
    });
    const result = registerUser({ ...input, role: 'admin', id: 'forged', createdAt: 'forged' });
    const user = { id, displayName: 'Mira Chen', username: 'Mira', password: ' demo-only ', role: 'user', createdAt: '2026-05-02T12:00:00.000Z' };
    expect(result).toEqual({ ok: true, user, session: { userId: id, displayName: 'Mira Chen', username: 'Mira', role: 'user' } });
    expect(getUsers()).toEqual([existing, user]);
    expect(getSession()).toEqual(result.session);
    expect(order).toEqual([STORAGE_KEYS.users, STORAGE_KEYS.session]);
    expect(input.password).toBe(' demo-only ');
    expect(getSession()).not.toHaveProperty('password');
  });
  it('uses real UUID and parseable timestamp metadata', () => {
    const result = registerUser(input);
    expect(result.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(new Date(result.user.createdAt).toISOString()).toBe(result.user.createdAt);
  });
  it.each([
    { ...input, username: 'ADMIN' }, { ...input, confirmPassword: 'wrong' },
    ...Object.keys(input).map((field) => ({ ...input, [field]: '' })),
    ...Object.keys(input).map((field) => ({ ...input, [field]: 42 })),
  ])('rejects invalid drafts before generation or any write: %j', (draft) => {
    const uuid = vi.spyOn(crypto, 'randomUUID');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(registerUser(draft).error).toBe('validation_failed');
    expect(uuid).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
  it('re-reads accounts on each action and rejects a newly added case-insensitive duplicate before UUID', () => {
    expect(getUsers()).toEqual([]);
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([{ ...existing, username: 'mIRA' }]));
    const uuid = vi.spyOn(crypto, 'randomUUID');
    expect(registerUser(input).errors.username).toBe('This username is already taken.');
    expect(uuid).not.toHaveBeenCalled();
    expect(getUsers()).toHaveLength(1);
    expect(getSession()).toBeNull();
  });
  it.each(['uuid', 'timestamp'])('handles %s generation failure without writes', (failure) => {
    if (failure === 'uuid') vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable'); });
    else vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => { throw new Error('clock'); });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(registerUser(input)).toEqual({ ok: false, error: 'generation_failed' });
    expect(write).not.toHaveBeenCalled();
    expect(getSession()).toBeNull();
  });
  it('handles missing crypto capability without writing', () => {
    vi.stubGlobal('crypto', {});
    expect(registerUser(input).error).toBe('generation_failed');
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
  it('leaves account and existing identity intact when account write fails, then re-reads on explicit retry', () => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([existing]));
    const oldSession = authenticate('other', 'demo', [existing]);
    setSession(oldSession);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(registerUser(input)).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(getUsers()).toEqual([existing]);
    expect(getSession()).toEqual(oldSession);
    expect(write.mock.calls.map(([key]) => key)).toEqual([STORAGE_KEYS.users]);
    write.mockRestore();
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([existing, { ...existing, id: 'third', username: 'third' }]));
    expect(registerUser(input).ok).toBe(true);
    expect(getUsers().map((user) => user.username)).toEqual(['other', 'third', 'Mira']);
  });
  it('returns serialization failure without establishing a session', () => {
    vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw new Error('serialization'); });
    expect(registerUser(input)).toEqual({ ok: false, error: 'serialization_failed' });
    expect(getSession()).toBeNull();
    expect(getUsers()).toEqual([]);
  });
  it('retains saved account after session failure, prevents duplicate retry, and supports Login recovery', () => {
    const original = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function writeKey(key, value) {
      if (key === STORAGE_KEYS.session) throw new Error('session blocked');
      original.call(this, key, value);
    });
    const result = registerUser(input);
    expect(result).toMatchObject({ ok: false, error: 'account_created', cause: 'storage_unavailable' });
    expect(getUsers()).toEqual([result.user]);
    expect(getSession()).toBeNull();
    const uuid = vi.spyOn(crypto, 'randomUUID');
    expect(registerUser(input).errors.username).toBe('This username is already taken.');
    expect(uuid).not.toHaveBeenCalled();
    expect(getUsers()).toHaveLength(1);
    write.mockRestore();
    const recovered = authenticate('Mira', ' demo-only ', getUsers());
    expect(setSession(recovered).ok).toBe(true);
    expect(getSession()?.userId).toBe(result.user.id);
  });
});
