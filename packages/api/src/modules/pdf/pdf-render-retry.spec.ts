import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { Browser } from 'playwright';
import { PdfRenderService } from './pdf-render.service';

// A-5 regression. The Chromium singleton previously cached a REJECTED launch
// promise forever — one launch failure broke ALL PDF rendering until restart.
// The fix clears the cache on failure (next request retries) and relaunches a
// crashed (disconnected) browser. Pure unit test — no real Chromium.

function fakeBrowser(connected = true): Browser {
  let isConn = connected;
  return {
    isConnected: () => isConn,
    close: async () => {
      isConn = false;
    },
  } as unknown as Browser;
}

/** Test harness exposing the protected seams and a programmable launcher. */
class TestPdfRenderService extends PdfRenderService {
  public launches = 0;
  public nextResults: Array<{ ok: boolean; browser?: Browser }> = [];

  protected override launchBrowser(): Promise<Browser> {
    this.launches += 1;
    const next = this.nextResults.shift();
    if (!next || !next.ok) {
      return Promise.reject(new Error('Executable does not exist'));
    }
    return Promise.resolve(next.browser ?? fakeBrowser());
  }

  public getBrowser(): Promise<Browser> {
    return this.browser();
  }
}

test('A-5: a failed launch does not poison subsequent requests', async () => {
  const svc = new TestPdfRenderService();

  // 1st request: launch fails.
  svc.nextResults = [{ ok: false }];
  await assert.rejects(() => svc.getBrowser(), /Executable does not exist/);
  assert.equal(svc.launches, 1);

  // 2nd request: launch succeeds — the previous rejection must NOT be cached.
  const good = fakeBrowser();
  svc.nextResults = [{ ok: true, browser: good }];
  const b = await svc.getBrowser();
  assert.equal(b, good, 'second request retries and gets a fresh browser');
  assert.equal(svc.launches, 2, 'a second launch actually happened');
});

test('A-5: a connected browser is reused without relaunching', async () => {
  const svc = new TestPdfRenderService();
  const good = fakeBrowser(true);
  svc.nextResults = [{ ok: true, browser: good }];

  const first = await svc.getBrowser();
  const second = await svc.getBrowser();
  assert.equal(first, good);
  assert.equal(second, good, 'same browser reused');
  assert.equal(svc.launches, 1, 'no relaunch while connected');
});

test('A-5: a crashed (disconnected) browser is relaunched', async () => {
  const svc = new TestPdfRenderService();
  const crashed = fakeBrowser(true);
  svc.nextResults = [{ ok: true, browser: crashed }];

  const first = await svc.getBrowser();
  assert.equal(first, crashed);
  assert.equal(svc.launches, 1);

  // Simulate a crash.
  await crashed.close();

  const fresh = fakeBrowser(true);
  svc.nextResults = [{ ok: true, browser: fresh }];
  const second = await svc.getBrowser();
  assert.equal(second, fresh, 'crashed browser is replaced');
  assert.equal(svc.launches, 2, 'relaunched after disconnect');
});
