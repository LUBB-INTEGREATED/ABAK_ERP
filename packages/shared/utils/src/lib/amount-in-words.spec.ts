import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { amountInWords } from './amount-in-words.js';

// Runner-agnostic: uses the built-in node:test runner so it runs with zero
// extra deps (`node --test` over the compiled output). The assertions are the
// vetted contract for SAR tafqit and double as the spec for any future runner.
describe('amountInWords — SAR tafqit', () => {
  it('renders the roadmap acceptance case 851,000.00 (EN + AR)', () => {
    assert.equal(
      amountInWords(851000, { locale: 'en' }),
      'Eight hundred fifty-one thousand Saudi Riyals only',
    );
    assert.equal(
      amountInWords(851000, { locale: 'ar' }),
      'ثمانمائة وواحد وخمسون ألف ريال سعودي فقط لا غير',
    );
  });

  it('appends halalas when there is a fractional remainder', () => {
    assert.equal(
      amountInWords(1234.56, { locale: 'en' }),
      'One thousand two hundred thirty-four Saudi Riyals and fifty-six Halalas only',
    );
    assert.equal(
      amountInWords(1234.56, { locale: 'ar' }),
      'ألف ومئتان وأربعة وثلاثون ريال سعودي وستة وخمسون هللة فقط لا غير',
    );
  });

  it('rounds to two decimals (halalas)', () => {
    assert.equal(
      amountInWords(0.5, { locale: 'en' }),
      'Zero Saudi Riyals and fifty Halalas only',
    );
    assert.equal(
      amountInWords(0.5, { locale: 'ar' }),
      'صفر ريال سعودي وخمسون هللة فقط لا غير',
    );
  });

  it('handles zero', () => {
    assert.equal(amountInWords(0, { locale: 'en' }), 'Zero Saudi Riyals only');
    assert.equal(
      amountInWords(0, { locale: 'ar' }),
      'صفر ريال سعودي فقط لا غير',
    );
  });

  it('handles single units', () => {
    assert.equal(amountInWords(5, { locale: 'en' }), 'Five Saudi Riyals only');
    assert.equal(
      amountInWords(5, { locale: 'ar' }),
      'خمسة ريال سعودي فقط لا غير',
    );
  });

  it('uses the Arabic dual for millions (2,000,000)', () => {
    assert.equal(
      amountInWords(2000000, { locale: 'en' }),
      'Two million Saudi Riyals only',
    );
    assert.equal(
      amountInWords(2000000, { locale: 'ar' }),
      'مليونان ريال سعودي فقط لا غير',
    );
  });

  it('uses the Arabic 3-10 plural for thousands (3,000)', () => {
    assert.equal(
      amountInWords(3000, { locale: 'ar' }),
      'ثلاثة آلاف ريال سعودي فقط لا غير',
    );
  });

  it('uses the Arabic 11+ singular for thousands (11,000)', () => {
    assert.equal(
      amountInWords(11000, { locale: 'ar' }),
      'أحد عشر ألف ريال سعودي فقط لا غير',
    );
    assert.equal(
      amountInWords(11000, { locale: 'en' }),
      'Eleven thousand Saudi Riyals only',
    );
  });

  it('omits the closing affirmation when affirm: false', () => {
    assert.equal(
      amountInWords(100, { locale: 'en', affirm: false }),
      'One hundred Saudi Riyals',
    );
    assert.equal(
      amountInWords(100, { locale: 'ar', affirm: false }),
      'مائة ريال سعودي',
    );
  });

  it('defaults to English', () => {
    assert.equal(amountInWords(5), 'Five Saudi Riyals only');
  });
});
