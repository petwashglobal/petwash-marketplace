/**
 * ReDoS safety test for notificationDispatcher.ts stripHtml
 *
 * Proves that the HTML-stripping function terminates in linear time even for
 * adversarially crafted inputs that would cause catastrophic backtracking in
 * vulnerable regex implementations.
 *
 * Run: node --test tests/notification-dispatcher-redos.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Inline copy of stripHtml so the test has no server dependencies.
// Keep this in sync with server/lib/notificationDispatcher.ts.
// ---------------------------------------------------------------------------
function stripHtml(html) {
  if (typeof html !== 'string') return '';
  // Normalise <br> variants and closing <p> first (literal replacements; no backtracking)
  let s = html
    .replaceAll('<br>', '\n')
    .replaceAll('<BR>', '\n')
    .replaceAll('<br/>', '\n')
    .replaceAll('<BR/>', '\n')
    .replaceAll('<br />', '\n')
    .replaceAll('<BR />', '\n')
    .replace(/<\/p>/gi, '\n');

  // Remove HTML tags iteratively until the string stops changing.
  // A single pass of /<[^>]*>/g can leave artifacts when a `>` appears inside an
  // attribute value (e.g. <img src=">">); looping until stable eliminates those
  // remnants and satisfies CodeQL CWE-116 (incomplete multi-character sanitization).
  let prev;
  do {
    prev = s;
    s = s.replace(/<[^>]*>/g, '');
  } while (s !== prev);

  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-zA-Z]{1,10};/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('stripHtml: basic br normalisation', () => {
  assert.equal(stripHtml('Hello<br>World'), 'Hello\nWorld');
  assert.equal(stripHtml('Hello<br/>World'), 'Hello\nWorld');
  assert.equal(stripHtml('Hello<br />World'), 'Hello\nWorld');
  assert.equal(stripHtml('Hello<BR>World'), 'Hello\nWorld');
  assert.equal(stripHtml('Hello<BR/>World'), 'Hello\nWorld');
  assert.equal(stripHtml('Hello<BR />World'), 'Hello\nWorld');
});

test('stripHtml: strips generic tags', () => {
  assert.equal(stripHtml('<b>bold</b> and <i>italic</i>'), 'bold and italic');
  assert.equal(stripHtml('<p>paragraph</p>'), 'paragraph');
  assert.equal(stripHtml('<div class="foo">text</div>'), 'text');
});

test('stripHtml: decodes common HTML entities', () => {
  assert.equal(stripHtml('Hello&nbsp;World'), 'Hello World');
  assert.equal(stripHtml('AT&amp;T'), 'AT&T');
});

test('stripHtml: returns empty string for non-string input', () => {
  assert.equal(stripHtml(null), '');
  assert.equal(stripHtml(undefined), '');
  assert.equal(stripHtml(42), '');
});

// ---------------------------------------------------------------------------
// ReDoS safety: these inputs would hang a vulnerable implementation but must
// complete in < 100 ms on any modern CPU with a safe implementation.
// ---------------------------------------------------------------------------
test('stripHtml: ReDoS safety — very long malicious br-tag input completes quickly', () => {
  // Generate a 500 000-character string of the form '<br  ...  >' that would
  // cause catastrophic backtracking in patterns like /<br\s+[^>]*>/
  const maliciousBr = '<br' + ' '.repeat(500_000) + '>';
  const start = Date.now();
  const result = stripHtml(maliciousBr);
  const elapsed = Date.now() - start;
  // With replaceAll (literal match) the <br variants are replaced first but
  // this specific crafted input (spaces inside the tag) won't match any of
  // the literal replaceAll calls.  The /<[^>]+>/g pass is O(n) and will
  // strip it in linear time.
  assert.equal(result, '', 'malicious br tag should be stripped to empty string');
  assert.ok(elapsed < 500, `Expected < 500 ms but took ${elapsed} ms — possible ReDoS`);
});

test('stripHtml: ReDoS safety — deeply nested angle-bracket-free content completes quickly', () => {
  // 1 000 000 chars of text between two simple tags — exercises /<[^>]+>/g linearly
  const body = 'a'.repeat(1_000_000);
  const input = `<span>${body}</span>`;
  const start = Date.now();
  const result = stripHtml(input);
  const elapsed = Date.now() - start;
  assert.equal(result, body, 'text content should be preserved');
  assert.ok(elapsed < 500, `Expected < 500 ms but took ${elapsed} ms — possible ReDoS`);
});

test('stripHtml: ReDoS safety — entity reference with maximum-length name completes quickly', () => {
  // Generate 100 000 near-maximal entity names: &abcdefghij; (10 alpha chars)
  const entity = '&abcdefghij;';
  const input = entity.repeat(100_000);
  const start = Date.now();
  const result = stripHtml(input);
  const elapsed = Date.now() - start;
  assert.equal(result, '', 'all entity refs should be stripped');
  assert.ok(elapsed < 500, `Expected < 500 ms but took ${elapsed} ms — possible ReDoS`);
});
