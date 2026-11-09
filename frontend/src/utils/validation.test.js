/** Verify pure presence, uniqueness, equality, and plain-text validation. */
import { describe, expect, it } from 'vitest';
import { validatePost, validateRegistration } from './validation';

const valid = { displayName: ' Mira ', username: ' Mira ', password: ' demo ', confirmPassword: ' demo ' };
const invalidValues = [undefined, null, 42, false, {}, [], '', ' \n\t '];

describe('validateRegistration', () => {
  it('accepts complete values without mutating or normalizing them', () => {
    const input = Object.freeze({ ...valid });
    const users = Object.freeze([{ username: 'other' }]);
    expect(validateRegistration(input, users)).toEqual({ ok: true, errors: {} });
    expect(input).toEqual(valid);
  });
  for (const field of Object.keys(valid)) {
    it.each(invalidValues)(`rejects only ${field} when invalid: %j`, (value) => {
      const result = validateRegistration({ ...valid, [field]: value });
      expect(result.ok).toBe(false);
      expect(Object.keys(result.errors)).toEqual([field]);
    });
    it(`rejects missing ${field} one at a time`, () => {
      const input = { ...valid };
      delete input[field];
      expect(Object.keys(validateRegistration(input).errors)).toEqual([field]);
    });
  }
  it.each([undefined, null, {}, [], 42])('rejects an absent or malformed draft: %j', (input) => {
    expect(Object.keys(validateRegistration(input).errors)).toEqual(Object.keys(valid));
  });
  it.each(['admin', 'ADMIN', ' AdMiN '])('reserves %s without a stored Admin', (username) => {
    expect(validateRegistration({ ...valid, username }, []).errors).toEqual({ username: 'This username is reserved.' });
  });
  it('rejects normalized duplicates including managed Admin accounts', () => {
    expect(validateRegistration(valid, [{ username: 'mIRA', role: 'admin' }]).errors)
      .toEqual({ username: 'This username is already taken.' });
  });
  it('ignores malformed comparison records and accepts a different username', () => {
    expect(validateRegistration(valid, [null, {}, { username: 42 }, { username: 'different' }]).ok).toBe(true);
    expect(validateRegistration(valid, null).ok).toBe(true);
  });
  it('compares passwords exactly instead of trimming away a mismatch', () => {
    expect(validateRegistration({ ...valid, confirmPassword: 'demo' }).errors)
      .toEqual({ confirmPassword: 'Passwords do not match.' });
  });
});

describe('validatePost', () => {
  it('accepts literal text and preserves surrounding whitespace and newlines', () => {
    const input = Object.freeze({ title: ' Title ', content: ' \n<script>literal</script>\n body \n' });
    expect(validatePost(input)).toEqual({ ok: true, errors: {} });
    expect(input.content).toBe(' \n<script>literal</script>\n body \n');
  });
  for (const field of ['title', 'content']) {
    it.each(invalidValues)(`rejects only invalid ${field}: %j`, (value) => {
      const result = validatePost({ title: 'Title', content: 'Body', [field]: value });
      expect(result.ok).toBe(false);
      expect(Object.keys(result.errors)).toEqual([field]);
    });
    it(`rejects missing ${field} alone`, () => {
      const input = { title: 'Title', content: 'Body' };
      delete input[field];
      expect(Object.keys(validatePost(input).errors)).toEqual([field]);
    });
  }
  it.each([undefined, null, {}, [], 42])('rejects malformed post drafts: %j', (input) => {
    expect(validatePost(input)).toEqual({ ok: false, errors: { title: 'Title is required.', content: 'Content is required.' } });
  });
  it('accepts long plain text without introducing an unplanned length limit', () => {
    expect(validatePost({ title: 'x'.repeat(10000), content: 'x'.repeat(100000) }).ok).toBe(true);
  });
});
