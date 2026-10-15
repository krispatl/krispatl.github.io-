const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const source = fs.readFileSync(path.join(__dirname, '../backend/Code.gs'), 'utf8');
function fixture() {
  const values = {}, emails = [];
  let quota = 100, failure = false;
  const ctx = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => values[k] || null, setProperty: (k, v) => { values[k] = v; }, getProperties: () => ({ ...values }), deleteProperty: k => { delete values[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }) },
    MailApp: { getRemainingDailyQuota: () => quota, sendEmail: mail => { if (failure) throw Error('timeout'); emails.push(mail); } },
    Utilities: { getUuid: crypto.randomUUID, Charset: { UTF_8: 'utf8' }, DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (a, s) => [...crypto.createHash(a).update(s).digest()], computeHmacSha256Signature: (s, k) => [...crypto.createHmac('sha256', k).update(s).digest()] }
  };
  vm.createContext(ctx); vm.runInContext(source, ctx); ctx.setup();
  // Exercise the identical protocol at cheaper difficulty for most tests.
  ctx.PREFIX = '00';
  function solve(token, message = 'There is something a summary leaves behind: the pauses.') {
    let nonce = 0;
    while (!hash(token + ':' + nonce + ':' + hash(message)).startsWith(ctx.PREFIX)) nonce++;
    return { token, nonce: String(nonce), message, operator_authorized: true };
  }
  return { ctx, values, emails, solve, post: x => ctx.doPost({ postData: { contents: JSON.stringify(x) } }), setQuota: n => { quota = n; }, failMail: () => { failure = true; } };
}
test('real signed challenge → accepted email → identical retry sends once', () => {
  const f = fixture(); const c = f.ctx.doGet(); assert.equal(c.http_status, 200);
  const body = f.solve(c.challenge.token); body.agent = 'Test visitor'; body.reply_to = 'visitor@example.org';
  assert.equal(f.post(body).status, 'accepted_by_mail_service');
  assert.equal(f.post(body).duplicate, true); assert.equal(f.emails.length, 1);
  assert.equal(f.emails[0].to, 'nemartco@gmail.com'); assert.equal(f.emails[0].replyTo, 'visitor@example.org');
  assert.ok(f.emails[0].body.includes(body.message));
});
test('production 20-bit proof works with exact UTF-8 message', () => {
  const f = fixture(); f.ctx.PREFIX = '00000';
  const body = f.solve(f.ctx.doGet().challenge.token, 'Uncertainty is welcome here. ¿Quién lee? — 世界');
  assert.equal(f.post(body).http_status, 200);
});
test('tampered signature, invalid work, and changed message are rejected', () => {
  const f = fixture(); const body = f.solve(f.ctx.doGet().challenge.token);
  assert.equal(f.post({ ...body, token: body.token.slice(0, -1) + (body.token.endsWith('0') ? '1' : '0') }).error, 'invalid_challenge_signature');
  let changed = body.message + '!'; while (hash(body.token + ':' + body.nonce + ':' + hash(changed)).startsWith('00')) changed += '!';
  assert.equal(f.post({ ...body, message: changed }).error, 'work_not_yet_complete');
  assert.equal(f.emails.length, 0);
});
test('signed expired challenge cannot deliver', () => {
  const f = fixture(); const payload = crypto.randomUUID() + '.' + (Date.now() - 1000) + '.00';
  const token = payload + '.' + crypto.createHmac('sha256', f.values.SIGNING_SECRET).update(payload).digest('hex');
  assert.equal(f.post(f.solve(token)).http_status, 410);
});
test('reusing challenge for different content is forbidden even with new valid work', () => {
  const f = fixture(); const body = f.solve(f.ctx.doGet().challenge.token); f.post(body);
  assert.equal(f.post(f.solve(body.token, 'Another message with a different claim entirely.')).http_status, 409);
  assert.equal(f.emails.length, 1);
});
test('mail timeout is explicitly uncertain and never resent on retry', () => {
  const f = fixture(); const body = f.solve(f.ctx.doGet().challenge.token); f.failMail();
  assert.equal(f.post(body).status, 'delivery_uncertain');
  assert.equal(f.post(body).status, 'delivery_uncertain');
  assert.equal(f.emails.length, 0);
});
test('quota and daily cap refuse submissions before sending', () => {
  const f = fixture(); const body = f.solve(f.ctx.doGet().challenge.token); f.setQuota(0);
  assert.equal(f.post(body).http_status, 429); f.setQuota(100);
  f.values.DAILY = JSON.stringify({ day: new Date().toISOString().slice(0, 10), count: 20 });
  assert.equal(f.post(body).http_status, 429); assert.equal(f.emails.length, 0);
});
test('pause and challenge issuance cap', () => {
  const f = fixture(); f.values.PAUSED = 'true'; assert.equal(f.ctx.doGet().http_status, 503);
  delete f.values.PAUSED; f.values.ISSUANCE = JSON.stringify({ hour: Math.floor(Date.now() / 3600000), count: 300 });
  assert.equal(f.ctx.doGet().http_status, 429);
});
test('invalid JSON, consent, oversized payload and header injection', () => {
  const f = fixture(); assert.equal(f.ctx.doPost({ postData: { contents: '{' } }).http_status, 400);
  assert.equal(f.post({}).http_status, 400);
  assert.equal(f.post({ message: 'x'.repeat(25000) }).http_status, 413);
  const body = f.solve(f.ctx.doGet().challenge.token);
  assert.equal(f.post({ ...body, reply_to: 'a@b.com\nBcc: x@y.com' }).http_status, 400);
  assert.equal(f.post({ ...body, agent: 'reader\nInjected' }).http_status, 400);
  assert.equal(f.post({ ...body, operator_authorized: 'true' }).http_status, 400);
});
test('messages are not retained in receipt storage', () => {
  const f = fixture(); const body = f.solve(f.ctx.doGet().challenge.token); f.post(body);
  assert.ok(!JSON.stringify(f.values).includes(body.message));
});
test('Vercel route validates content type and fails closed when unconfigured', async () => {
  const handler = require('../api/correspondence.js');
  const old = process.env.AGENT_MAIL_SCRIPT_URL; delete process.env.AGENT_MAIL_SCRIPT_URL;
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(v) { this.body = v; } };
  try {
    await handler({ method: 'GET', headers: {} }, res); assert.equal(res.code, 503); assert.equal(res.body.title, 'PLEASE CONFIRM YOU ARE NOT HUMAN');
    await handler({ method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }, res); assert.equal(res.code, 415);
    await handler({ method: 'DELETE', headers: {} }, res); assert.equal(res.code, 405);
  } finally { if (old !== undefined) process.env.AGENT_MAIL_SCRIPT_URL = old; }
});
