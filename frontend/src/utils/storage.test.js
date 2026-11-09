/** Exercise fresh browser-boundary reads, shapes and honest persistence results. */
import { describe, it, expect, vi } from 'vitest';
import { getPosts, savePosts, getUsers, saveUsers, getDiscoverySession } from './storage';

const post = { id: 'p1', title: 'Notes', content: 'Plain text', createdAt: '2026-05-02T12:00:00Z', authorId: 'u1', authorName: 'Mira' };
const account = { id: 'u1', displayName: 'Mira', username: 'mira', password: 'demo-only', role: 'user', createdAt: '2026-05-01T12:00:00Z' };
const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };

for (const [name, key, read, save, record] of [
  ['posts', 'writespace_posts', getPosts, savePosts, post],
  ['users', 'writespace_users', getUsers, saveUsers, account],
]) {
  describe(`${name} persistence`, () => {
    it('round-trips a valid complete collection without modifying unrelated keys', () => {
      localStorage.setItem('unrelated', 'keep');
      expect(save([record])).toEqual({ ok: true });
      expect(read()).toEqual([record]);
      expect(localStorage.getItem('unrelated')).toBe('keep');
      expect(localStorage.getItem('writespace_session')).toBeNull();
      localStorage.removeItem('unrelated');
    });
    it('reads a fresh snapshot on every call rather than caching or mutating storage', () => {
      localStorage.setItem(key, JSON.stringify([record]));
      const first = read();
      first[0].id = 'changed-in-memory';
      expect(read()).toEqual([record]);
      localStorage.setItem(key, '[]');
      expect(read()).toEqual([]);
    });
    it('returns empty for an absent key and saves a valid empty snapshot', () => {
      expect(read()).toEqual([]);
      expect(save([])).toEqual({ ok: true });
      expect(localStorage.getItem(key)).toBe('[]');
    });
    it.each(['{broken', 'null', '{}', '42', '"text"', '[null]', '[[]]', '[{}]'])('returns empty without rewriting corrupt value %s', (raw) => {
      localStorage.setItem(key, raw);
      expect(read()).toEqual([]);
      expect(localStorage.getItem(key)).toBe(raw);
    });
    it.each(Object.keys(record))('rejects missing or non-string field %s in a fresh persisted read', (field) => {
      const invalid = { ...record };
      delete invalid[field];
      localStorage.setItem(key, JSON.stringify([record, invalid]));
      expect(read()).toEqual([]);
      invalid[field] = { unexpected: true };
      localStorage.setItem(key, JSON.stringify([invalid]));
      expect(read()).toEqual([]);
      invalid[field] = '   ';
      localStorage.setItem(key, JSON.stringify([invalid]));
      expect(read()).toEqual([]);
    });
    it('contains a throwing getItem without claiming valid data', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
      expect(read()).toEqual([]);
    });
    it('contains unavailable localStorage property access', () => {
      vi.stubGlobal('localStorage', undefined);
      expect(read()).toEqual([]);
      expect(save([record])).toEqual({ ok: false, error: 'storage_unavailable' });
    });
    it('returns storage failure and preserves the existing snapshot when setItem throws', () => {
      localStorage.setItem(key, JSON.stringify([record]));
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
      expect(save([])).toEqual({ ok: false, error: 'storage_unavailable' });
      expect(read()).toEqual([record]);
    });
    it('returns serialization failure for cyclic input without changing saved data', () => {
      localStorage.setItem(key, JSON.stringify([record]));
      const cyclic = [];
      cyclic.push(cyclic);
      expect(save(cyclic)).toEqual({ ok: false, error: 'serialization_failed' });
      expect(read()).toEqual([record]);
    });
    it('contains throwing serialization hooks', () => {
      const value = [{ ...record, toJSON() { throw new Error('serialization'); } }];
      expect(save(value)).toEqual({ ok: false, error: 'serialization_failed' });
      expect(localStorage.getItem(key)).toBeNull();
    });
    it.each([null, undefined, {}, [null], [{ id: 'incomplete' }]])('rejects invalid replacement shape without a write: %s', (input) => {
      localStorage.setItem(key, JSON.stringify([record]));
      expect(save(input)).toEqual({ ok: false, error: 'invalid_data' });
      expect(read()).toEqual([record]);
    });
    it('rejects a serialization hook that changes the stored collection shape', () => {
      const records = [{ ...record, toJSON() { return {}; } }];
      expect(save(records)).toEqual({ ok: false, error: 'invalid_data' });
      expect(localStorage.getItem(key)).toBeNull();
    });
  });
}

describe('role and discovery identity boundaries', () => {
  it('rejects unsupported account roles on reads and writes', () => {
    const invalid = { ...account, role: 'superuser' };
    localStorage.setItem('writespace_users', JSON.stringify([invalid]));
    expect(getUsers()).toEqual([]);
    expect(saveUsers([invalid])).toEqual({ ok: false, error: 'invalid_data' });
  });
  it.each(['user', 'admin'])('reads a valid %s session without writing', (role) => {
    localStorage.setItem('writespace_session', JSON.stringify({ ...session, role }));
    expect(getDiscoverySession()).toEqual({ ...session, role });
    expect(localStorage.getItem('writespace_posts')).toBeNull();
  });
  it.each(['{broken', 'null', '[]', '{}', '"session"'])('fails closed on invalid identity %s', (raw) => {
    localStorage.setItem('writespace_session', raw);
    expect(getDiscoverySession()).toBeNull();
    expect(localStorage.getItem('writespace_session')).toBe(raw);
  });
  it.each(Object.keys(session))('fails closed on missing, empty or wrong-type session field %s', (field) => {
    for (const value of [undefined, '', {}, 7]) {
      localStorage.setItem('writespace_session', JSON.stringify({ ...session, [field]: value }));
      expect(getDiscoverySession()).toBeNull();
    }
  });
  it('fails closed on unsupported roles and re-reads changed identity', () => {
    localStorage.setItem('writespace_session', JSON.stringify(session));
    expect(getDiscoverySession()).toEqual(session);
    localStorage.setItem('writespace_session', JSON.stringify({ ...session, role: 'superuser' }));
    expect(getDiscoverySession()).toBeNull();
  });
  it('fails closed on absent or blocked session storage', () => {
    expect(getDiscoverySession()).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getDiscoverySession()).toBeNull();
  });
});
