/** Cover valid roles, ownership and fail-closed malformed permission inputs. */
import { describe, it, expect } from 'vitest';
import { canManagePost, canDeleteAccount } from './permissions';

const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const post = { id: 'p1', title: 'Title', content: 'Body', createdAt: '2026-05-01', authorId: 'u1', authorName: 'Mira' };
const account = { id: 'u2', username: 'other', displayName: 'Other', password: 'demo', role: 'user', createdAt: '2026-05-01' };
const invalid = [null, undefined, [], 1, true, 'admin', {}];

describe('post permissions', () => {
  it('allows owner and Admin, but rejects another user', () => {
    expect(canManagePost(session, post)).toBe(true);
    expect(canManagePost({ ...session, userId: 'other', role: 'admin' }, post)).toBe(true);
    expect(canManagePost({ ...session, userId: 'other' }, post)).toBe(false);
  });
  it.each(invalid)('rejects invalid identity or post %s', (value) => {
    expect(canManagePost(value, post)).toBe(false);
    expect(canManagePost(session, value)).toBe(false);
  });
  for (const field of Object.keys(session)) {
    it.each([undefined, '', ' ', 1, {}, []])(`rejects invalid session ${field}: %s`, (value) => {
      expect(canManagePost({ ...session, [field]: value }, post)).toBe(false);
      expect(canDeleteAccount({ ...session, role: 'admin', [field]: value }, account)).toBe(false);
    });
  }
  for (const field of Object.keys(post)) {
    it.each([undefined, '', ' ', 1, {}, []])(`rejects invalid post ${field}: %s`, (value) => {
      expect(canManagePost({ ...session, role: 'admin' }, { ...post, [field]: value })).toBe(false);
    });
  }
  it.each(['Admin', 'superuser', ' user '])('rejects unsupported owner role %s', (role) => {
    expect(canManagePost({ ...session, role }, post)).toBe(false);
    expect(canDeleteAccount({ ...session, role }, account)).toBe(false);
  });
});

describe('account permissions', () => {
  it('allows a valid Admin to delete another ordinary or managed Admin account', () => {
    expect(canDeleteAccount({ ...session, role: 'admin' }, account)).toBe(true);
    expect(canDeleteAccount({ ...session, role: 'admin' }, { ...account, role: 'admin' })).toBe(true);
    expect(canDeleteAccount(session, account)).toBe(false);
  });
  it.each(invalid)('rejects invalid account or identity %s', (value) => {
    expect(canDeleteAccount({ ...session, role: 'admin' }, value)).toBe(false);
    expect(canDeleteAccount(value, account)).toBe(false);
  });
  for (const field of Object.keys(account)) {
    it.each([undefined, '', ' ', 1, {}, []])(`rejects invalid account ${field}: %s`, (value) => {
      expect(canDeleteAccount({ ...session, role: 'admin' }, { ...account, [field]: value })).toBe(false);
    });
  }
  it.each([
    { ...account, id: 'default-admin' }, { ...account, username: ' AdMiN ' },
    { ...account, id: 'u1' }, { ...account, role: 'superuser' },
  ])('protects reserved, default, current and invalid-role accounts %s', (target) => {
    const before = JSON.stringify(target);
    expect(canDeleteAccount({ ...session, role: 'admin' }, target)).toBe(false);
    expect(JSON.stringify(target)).toBe(before);
  });
});
