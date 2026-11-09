/** Verify pure ordering, preview boundaries and text metadata edge cases. */
import { describe, it, expect } from 'vitest';
import { sortPosts, getLatestPosts, getExcerpt, formatPostDate } from './posts';

const posts = [
  { id: 'old', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'new', createdAt: '2026-04-01T00:00:00Z' },
  { id: 'middle', createdAt: '2026-03-01T00:00:00Z' },
  { id: 'second', createdAt: '2026-03-15T00:00:00Z' },
];

describe('sorted post views', () => {
  it('orders newest first without changing a frozen source', () => {
    const source = Object.freeze([...posts]);
    expect(sortPosts(source).map((post) => post.id)).toEqual(['new', 'second', 'middle', 'old']);
    expect(source.map((post) => post.id)).toEqual(['old', 'new', 'middle', 'second']);
  });
  it('takes exactly the newest three by default', () => {
    expect(getLatestPosts(posts).map((post) => post.id)).toEqual(['new', 'second', 'middle']);
  });
  it('handles zero, one, and larger-than-collection limits', () => {
    expect(getLatestPosts(posts, 0)).toEqual([]);
    expect(getLatestPosts(posts, 1)).toEqual([posts[1]]);
    expect(getLatestPosts(posts, 10)).toHaveLength(4);
    expect(getLatestPosts([], 3)).toEqual([]);
  });
  it.each([-1, 1.5, NaN, Infinity, '3', null])('returns empty for invalid preview count %s', (limit) => {
    expect(getLatestPosts(posts, limit)).toEqual([]);
  });
  it.each([undefined, null, {}, 'posts'])('handles non-array source %s', (source) => {
    expect(sortPosts(source)).toEqual([]);
    expect(getLatestPosts(source)).toEqual([]);
  });
  it('keeps equal dates stable and puts missing or invalid metadata last', () => {
    const source = [null, { id: 'bad', createdAt: 'not-a-date' }, posts[1], { id: 'tie', createdAt: posts[1].createdAt }, {}];
    expect(sortPosts(source)).toEqual([posts[1], source[3], null, source[1], {}]);
  });
  it('compares timestamps rather than lexically sorting offset strings', () => {
    const source = [{ id: 'later', createdAt: '2026-05-01T01:00:00-03:00' }, { id: 'earlier', createdAt: '2026-05-01T03:00:00Z' }];
    expect(sortPosts(source)[0].id).toBe('later');
  });
});

describe('plain-text excerpts', () => {
  it('preserves short text, markup and line breaks verbatim', () => {
    expect(getExcerpt('<script>alert(1)</script>\nSecond line')).toBe('<script>alert(1)</script>\nSecond line');
    expect(getExcerpt('')).toBe('');
  });
  it('keeps exactly 120 characters at and beyond the boundary without adding an ellipsis', () => {
    expect(getExcerpt('x'.repeat(120))).toBe('x'.repeat(120));
    expect(getExcerpt('x'.repeat(10000))).toBe('x'.repeat(120));
  });
  it.each([null, undefined, 3, {}])('returns empty for non-text body %s', (value) => {
    expect(getExcerpt(value)).toBe('');
  });
});

describe('post dates', () => {
  it('formats padded English dates in UTC', () => {
    expect(formatPostDate('2026-05-02T23:30:00-03:00')).toBe('May 03, 2026');
    expect(formatPostDate('2026-01-01T00:00:00Z')).toBe('Jan 01, 2026');
  });
  it.each([null, undefined, '', '   ', 'invalid', {}, 0])('labels unavailable metadata honestly: %s', (value) => {
    expect(formatPostDate(value)).toBe('Date unavailable');
  });
});
