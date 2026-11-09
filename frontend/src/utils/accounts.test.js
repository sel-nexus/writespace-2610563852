/** Exercise registration against real local storage and injected boundary failures. */
import { describe, expect, it, vi } from 'vitest';
import { registerUser, createManagedUser, deleteManagedUser } from './accounts';
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

const admin = { userId: 'default-admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const managed = { displayName: ' Mira Chen ', username: ' Mira ', password: ' demo-only ', role: 'user' };

/** Seed a managed-action snapshot and return untouched nonaccount bytes. */
function seedManaged() {
  setSession(admin);
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([existing]));
  localStorage.setItem(STORAGE_KEYS.posts, '[{"id":"p","title":"Retained","content":"Text","createdAt":"2026-05-01","authorId":"other-id","authorName":"Other"}]');
  return { session: localStorage.getItem(STORAGE_KEYS.session), posts: localStorage.getItem(STORAGE_KEYS.posts) };
}

describe('managed accounts', () => {
  it.each(['user', 'admin'])('creates %s with generated metadata, preserves identity and posts, and supports exact login', (role) => {
    const before = seedManaged();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-05-02T12:00:00.000Z');
    const result = createManagedUser({ ...managed, role, id: 'forged', createdAt: 'forged' });
    expect(result).toEqual({ ok: true, user: {
      id, displayName: 'Mira Chen', username: 'Mira', password: ' demo-only ', role, createdAt: '2026-05-02T12:00:00.000Z',
    } });
    expect(getUsers()).toEqual([existing, result.user]);
    expect(authenticate('Mira', ' demo-only ', getUsers())?.role).toBe(role);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(before.session);
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(before.posts);
  });
  it('uses real UUID and ISO metadata and re-reads users before each creation', () => {
    seedManaged();
    const first = createManagedUser(managed);
    expect(first.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(new Date(first.user.createdAt).toISOString()).toBe(first.user.createdAt);
    const raw = localStorage.getItem(STORAGE_KEYS.users);
    expect(createManagedUser({ ...managed, username: ' mIRA ' }).errors.username).toBe('This username is already taken.');
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(raw);
  });
  it.each([undefined, null, {}, ...['displayName', 'username', 'password', 'role'].flatMap((field) => (
    ['', '   ', 42, null, {}, []].map((value) => ({ ...managed, [field]: value }))
  )), { ...managed, role: 'owner' }, { ...managed, username: ' AdMiN ' }])('rejects invalid managed input %j before generation', (draft) => {
    const before = seedManaged();
    const uuid = vi.spyOn(crypto, 'randomUUID');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(createManagedUser(draft).error).toBe('validation_failed');
    expect(getUsers()).toEqual([existing]);
    expect(uuid).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(before.posts);
  });
  it.each([null, { ...admin, role: 'user' }, { ...admin, role: 'owner' }, {}])('fails closed for fresh changed identity %j', (identity) => {
    seedManaged();
    if (identity === null) localStorage.removeItem(STORAGE_KEYS.session);
    else localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(identity));
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(createManagedUser(managed).error).toBe('forbidden');
    expect(deleteManagedUser(existing.id, true).error).toBe('forbidden');
    expect(getUsers()).toEqual([existing]);
    expect(write).not.toHaveBeenCalled();
  });
  it.each(['uuid', 'timestamp', 'missing crypto'])('reports %s generation failure without changing records', (failure) => {
    const before = seedManaged();
    if (failure === 'missing crypto') vi.stubGlobal('crypto', {});
    else if (failure === 'uuid') vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw Error('uuid'); });
    else vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => { throw Error('clock'); });
    expect(createManagedUser(managed).error).toBe('generation_failed');
    expect(getUsers()).toEqual([existing]);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(before.session);
  });
  it.each([false, undefined, null, 'true', 1])('requires literal affirmative confirmation %j', (confirmed) => {
    seedManaged();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(deleteManagedUser(existing.id, confirmed)).toEqual({ ok: false, error: 'canceled' });
    expect(getUsers()).toEqual([existing]);
    expect(write).not.toHaveBeenCalled();
  });
  it.each(['default-admin', 'reserved', 'self'])('protects %s even after a fresh record or identity change', (kind) => {
    seedManaged();
    let target = existing.id;
    if (kind === 'default-admin') target = 'default-admin';
    if (kind === 'reserved') localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([{ ...existing, username: ' AdMiN ' }]));
    if (kind === 'self') setSession({ ...admin, userId: existing.id, username: existing.username });
    const before = localStorage.getItem(STORAGE_KEYS.users);
    expect(deleteManagedUser(target, true).error).toBe('forbidden');
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(before);
  });
  it.each([undefined, null, 42, {}, 'missing'])('reports missing identifier %j without rewriting accounts', (target) => {
    seedManaged();
    expect(deleteManagedUser(target, true).error).toBe('not_found');
    expect(getUsers()).toEqual([existing]);
  });
  it('deletes from fresh accounts, preserving newer accounts, posts and session bytes', () => {
    const before = seedManaged();
    const newer = { ...existing, id: 'newer', username: 'newer' };
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([existing, newer]));
    expect(deleteManagedUser(existing.id, true)).toEqual({ ok: true, removedId: existing.id });
    expect(getUsers()).toEqual([newer]);
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(before.posts);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(before.session);
    expect(deleteManagedUser(existing.id, true).error).toBe('not_found');
    expect(getUsers()).toEqual([newer]);
  });
  it.each(['create', 'delete'])('retains all bytes on %s storage failure and succeeds on explicit retry', (action) => {
    const before = seedManaged();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    const mutate = () => action === 'create' ? createManagedUser(managed) : deleteManagedUser(existing.id, true);
    expect(mutate().error).toBe('storage_unavailable');
    expect(getUsers()).toEqual([existing]);
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(before.posts);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(before.session);
    write.mockRestore();
    expect(mutate().ok).toBe(true);
    expect(getUsers()).toHaveLength(action === 'create' ? 2 : 0);
  });
  it.each(['create', 'delete'])('reports %s serialization failure without a write', (action) => {
    seedManaged();
    vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw Error('serialize'); });
    expect((action === 'create' ? createManagedUser(managed) : deleteManagedUser(existing.id, true)).error).toBe('serialization_failed');
    expect(getUsers()).toEqual([existing]);
    expect(getSession()).toEqual(admin);
  });
  it('fails closed when fresh session storage is inaccessible', () => {
    seedManaged();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
    expect(createManagedUser(managed).error).toBe('forbidden');
    expect(deleteManagedUser(existing.id, true).error).toBe('forbidden');
  });
});
