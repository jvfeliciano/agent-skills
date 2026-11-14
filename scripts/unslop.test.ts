import test from 'node:test';
import assert from 'node:assert/strict';
import { scanUnslop } from './unslop.ts';

test('ignores fenced code blocks and inline backticks while preserving line numbers', () => {
  const md = [
    '# Title',
    '```ts',
    '// here is a comment — with em-dash',
    'const x = "absolutely!";',
    '```',
    'Inline `here is` and `—` should pass.',
    'Hope this helps with the setup.',
  ].join('\n');

  const hits = scanUnslop(md, 'doc.md');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].rule, 'chatbot-filler');
  assert.equal(hits[0].line, 7);
});

test('ignores em-dashes in markdown tables and scales threshold by prose length', () => {
  const shortDoc = [
    '| Col | Desc |',
    '|---|---|',
    '| A | item — one |',
    '| B | item — two |',
    '| C | item — three |',
    'Line — one.',
    'Line — two.',
  ].join('\n');
  assert.equal(scanUnslop(shortDoc, 'short.md').length, 0);

  const shortFail = `${shortDoc}\nLine — three.`;
  const shortHits = scanUnslop(shortFail, 'short-fail.md');
  assert.equal(shortHits.length, 1);
  assert.equal(shortHits[0].rule, 'excessive-em-dash');

  const longLines = Array.from({ length: 75 }, (_, i) => `Prose line ${i + 1}.`);
  longLines[0] = 'First — dash.';
  longLines[1] = 'Second — dash.';
  longLines[2] = 'Third — dash.';
  assert.equal(scanUnslop(longLines.join('\n'), 'long.md').length, 0);
});
