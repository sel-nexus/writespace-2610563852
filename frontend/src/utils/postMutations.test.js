/** Verify real persisted state after fresh, validated post operations. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPost, updatePost, deletePost } from './postMutations';
import { getPosts, savePosts } from './storage';
import { setSession } from './auth';

const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const post = { id: 'p1', title: 'Original', content: 'Original body', createdAt: '2026-05-01', authorId: 'u1', authorName: 'Mira' };
const draft = { title: ' New title ', content: '  Body\n second line  ' };

beforeEach(() => {
  setSession(session);
  savePosts([post]);
});

describe('createPost', () => {
  it('generates UUID and ISO time, binds only session author and appends to fresh records', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('fcd7b7eb-3133-4f81-a6a8-29a113878153');
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-05-02T12:00:00.000Z');
    const result = createPost({ ...draft, authorId: 'forged', authorName: 'Forged', id: 'forged' });
    expect(result.ok).toBe(true);
    expect(getPosts()).toEqual([post, {
      id: 'fcd7b7eb-3133-4f81-a6a8-29a113878153', title: 'New title', content: draft.content,
      authorId: 'u1', authorName: 'Mira', createdAt: '2026-05-02T12:00:00.000Z',
    }]);
    setSession({ ...session, userId: 'fresh', displayName: 'Fresh', role: 'admin' });
    createPost(draft);
    expect(getPosts()).toHaveLength(3);
    expect(getPosts()[2].authorId).toBe('fresh');
  });
  it.each(['uuid', 'clock'])('reports %s generation failure without writing', (kind) => {
    if (kind === 'uuid') vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable'); });
    else vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => { throw new Error('clock'); });
    expect(createPost(draft)).toEqual({ ok: false, error: 'generation_failed' });
    expect(getPosts()).toEqual([post]);
  });
  it('supports large plain text without truncation', () => {
    const content = '<script>not executable</script>\n' + 'x'.repeat(100000);
    expect(createPost({ title: 'Large', content }).ok).toBe(true);
    expect(getPosts()[1].content).toBe(content);
  });
});

describe('updatePost and deletePost', () => {
  it.each(['user', 'admin'])('permits %s update and deletion while preserving original metadata and other records', (role) => {
    setSession({ ...session, role, userId: role === 'admin' ? 'other' : 'u1' });
    const other = { ...post, id: 'p2', authorId: 'other' };
    savePosts([post, other]);
    expect(updatePost('p1', { ...draft, id: 'fake', authorId: 'fake', authorName: 'fake', createdAt: 'fake' }).ok).toBe(true);
    expect(getPosts()).toEqual([{ ...post, title: 'New title', content: draft.content }, other]);
    expect(deletePost('p1', true)).toEqual({ ok: true, removedId: 'p1' });
    expect(getPosts()).toEqual([other]);
  });
  it.each([undefined, null, false, 'true', 1, {}, []])('requires literal affirmative confirmation %s', (confirmed) => {
    expect(deletePost('p1', confirmed)).toEqual({ ok: false, error: 'canceled' });
    expect(getPosts()).toEqual([post]);
  });
  it.each([undefined, null, 1, {}, [], 'missing'])('rejects missing or invalid target %s without writes', (id) => {
    expect(updatePost(id, draft)).toEqual({ ok: false, error: 'not_found' });
    expect(deletePost(id, true)).toEqual({ ok: false, error: 'not_found' });
    expect(getPosts()).toEqual([post]);
  });
  it('rereads changes to metadata, other records, ownership and missing targets on every operation', () => {
    savePosts([{ ...post, authorName: 'Fresh author', createdAt: '2026-05-03' }, { ...post, id: 'p2' }]);
    updatePost('p1', draft);
    expect(getPosts()[0]).toMatchObject({ authorName: 'Fresh author', createdAt: '2026-05-03' });
    expect(getPosts()).toHaveLength(2);
    savePosts([{ ...post, authorId: 'other' }]);
    expect(updatePost('p1', draft).error).toBe('forbidden');
    expect(deletePost('p1', true).error).toBe('forbidden');
    expect(getPosts()).toEqual([{ ...post, authorId: 'other' }]);
    savePosts([]);
    expect(updatePost('p1', draft).error).toBe('not_found');
    expect(deletePost('p1', true).error).toBe('not_found');
    expect(getPosts()).toEqual([]);
  });
});

describe('mutation failure boundaries', () => {
  it.each([null, {}, [], 1, 'admin', { ...session, role: 'superuser' }, { ...session, userId: '' }, { ...session, displayName: 2 }])(
    'fails closed on fresh invalid session %s', (identity) => {
      localStorage.setItem('writespace_session', JSON.stringify(identity));
      expect(createPost(draft).error).toBe('forbidden');
      expect(updatePost('p1', draft).error).toBe('forbidden');
      expect(deletePost('p1', true).error).toBe('forbidden');
      expect(getPosts()).toEqual([post]);
    },
  );
  for (const field of ['title', 'content']) {
    it.each([undefined, '', ' \n ', 1, {}, []])(`rejects invalid ${field} %s in create and edit`, (value) => {
      for (const operation of [createPost, (input) => updatePost('p1', input)]) {
        expect(operation({ ...draft, [field]: value })).toMatchObject({ ok: false, error: 'validation_failed', errors: { [field]: expect.any(String) } });
      }
      expect(getPosts()).toEqual([post]);
    });
  }
  it.each([null, undefined, [], 1, 'text'])('rejects invalid draft %s without writing', (input) => {
    expect(createPost(input).error).toBe('validation_failed');
    expect(updatePost('p1', input).error).toBe('validation_failed');
    expect(getPosts()).toEqual([post]);
  });
  it.each(['create', 'update', 'delete'])('reports quota and serialization failures for %s, without altering persistence', (kind) => {
    const operation = () => kind === 'create' ? createPost(draft) : kind === 'update' ? updatePost('p1', draft) : deletePost('p1', true);
    const raw = localStorage.getItem('writespace_posts');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    expect(operation()).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    write.mockRestore();
    const serialize = vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw new Error('serialization'); });
    expect(operation()).toEqual({ ok: false, error: 'serialization_failed' });
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    serialize.mockRestore();
  });
  it('handles corrupt collection and denied session reads without repair', () => {
    localStorage.setItem('writespace_posts', '{broken');
    expect(updatePost('p1', draft).error).toBe('not_found');
    expect(localStorage.getItem('writespace_posts')).toBe('{broken');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(createPost(draft).error).toBe('forbidden');
  });
});
