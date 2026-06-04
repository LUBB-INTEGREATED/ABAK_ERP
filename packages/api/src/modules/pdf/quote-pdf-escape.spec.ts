import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { esc } from './quote-pdf.service';

// RV-4: the quote-PDF builder HTML-escapes user-authored text (item
// descriptions, scope, client name) before it reaches headless Chromium, so a
// crafted description can't inject markup/script into the rendered document.

test('RV-4: esc() neutralises all HTML metacharacters', () => {
  assert.equal(
    esc('<script>alert(1)</script>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;',
  );
  assert.equal(esc(`a"b'c&d<e>f`), 'a&quot;b&#39;c&amp;d&lt;e&gt;f');
});

test('RV-4: esc() is a no-op on safe text (incl. Arabic)', () => {
  assert.equal(esc('تصميم إنشائي 123'), 'تصميم إنشائي 123');
  assert.equal(esc(''), '');
});
