import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { requireOwner } from '../lib/require-owner.js';
import analyze from '../api/analyze.js';
import claude from '../api/claude.js';
import notion from '../api/notion.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, end() {} };
}
const user = { id: 'd0392604-f5d6-4fd3-82d7-55ecbd08c581', email_confirmed_at: '2026-01-01', is_anonymous: false };
const req = { headers: { authorization: 'Bearer test-token' } };

test('all three endpoints reject missing and malformed tokens before external calls', async () => {
  globalThis.fetch = () => { throw new Error('External request must not run'); };
  for (const [handler, method] of [[analyze, 'POST'], [claude, 'POST'], [notion, 'GET']]) {
    for (const authorization of [undefined, '', 'Basic abc', 'Bearer a b']) {
      const res = response();
      await handler({ method, headers: { authorization } }, res);
      assert.equal(res.code, 401);
      assert.equal(res.headers['Cache-Control'], 'private, no-store');
    }
  }
});
test('expired or forged tokens are rejected by Supabase Auth', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 401 }; };
  const res = response();
  assert.equal(await requireOwner(req, res), null);
  assert.equal(res.code, 401);
  assert.equal(calls, 1);
});
test('a valid but unauthorized user cannot reach providers', async () => {
  let calls = 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => ++calls === 1 ? user : [] });
  const res = response();
  assert.equal(await requireOwner(req, res), null);
  assert.equal(res.code, 403);
});
test('user metadata cannot grant access', async () => {
  let calls = 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => ++calls === 1 ? { ...user, user_metadata: { owner: true } } : [{ user_id: 'another-user' }] });
  const res = response();
  assert.equal(await requireOwner(req, res), null);
  assert.equal(res.code, 403);
});
test('confirmed allowlisted owner is accepted and token is forwarded only to fixed Supabase URLs', async () => {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    assert.ok(url.startsWith('https://iunittdjpnmkhvlaizpo.supabase.co/'));
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return { ok: true, json: async () => ++calls === 1 ? user : [{ user_id: user.id }] };
  };
  assert.deepEqual(await requireOwner(req, response()), user);
});
test('auth or allowlist outages fail closed', async () => {
  for (const failAt of [1, 2]) {
    let calls = 0;
    globalThis.fetch = async () => {
      if (++calls === failAt) throw new Error('offline');
      return { ok: true, json: async () => user };
    };
    const res = response();
    assert.equal(await requireOwner(req, res), null);
    assert.equal(res.code, 503);
  }
});
test('unconfirmed and anonymous accounts are rejected', async () => {
  for (const candidate of [{ ...user, email_confirmed_at: null }, { ...user, is_anonymous: true }]) {
    globalThis.fetch = async () => ({ ok: true, json: async () => candidate });
    const res = response();
    assert.equal(await requireOwner(req, res), null);
    assert.equal(res.code, 403);
  }
});
