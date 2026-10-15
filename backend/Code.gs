/* A reader outside the frame — Kris Pilcher, 2026.
 * Deploy as a Web app: execute as owner, accessible to Anyone.
 * MailApp sends only to the fixed artist address; no inbox-reading scope.
 */
var RECIPIENT = 'nemartco@gmail.com';
var PREFIX = '00000'; // 20 bits; approximately one million SHA-256 attempts.
var DAILY_LIMIT = 20;
var CHALLENGE_LIMIT_PER_HOUR = 300;

function output_(status, data) {
  data.http_status = status;
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function hex_(bytes) { return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function hash_(text) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)); }
function sign_(text, secret) { return hex_(Utilities.computeHmacSha256Signature(text, secret, Utilities.Charset.UTF_8)); }
function constantEqual_(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  var different = 0;
  for (var i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}
function setup() {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var p = PropertiesService.getScriptProperties();
    if (!p.getProperty('SIGNING_SECRET')) p.setProperty('SIGNING_SECRET', Utilities.getUuid() + Utilities.getUuid());
    // Calling MailApp here asks Google for send-only authorization before launch.
    return { ready: true, remaining: MailApp.getRemainingDailyQuota() };
  } finally { lock.releaseLock(); }
}
function doGet() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return output_(503, { error: 'door_busy' });
  try {
    var p = PropertiesService.getScriptProperties();
    var secret = p.getProperty('SIGNING_SECRET');
    if (!secret || p.getProperty('PAUSED') === 'true') return output_(503, { error: 'door_closed' });
    var now = Date.now();
    var hour = Math.floor(now / 3600000);
    var issuance = JSON.parse(p.getProperty('ISSUANCE') || '{}');
    if (issuance.hour !== hour) issuance = { hour: hour, count: 0 };
    if (issuance.count >= CHALLENGE_LIMIT_PER_HOUR) return output_(429, { error: 'door_resting', message: 'Please return next hour.' });
    issuance.count++;
    p.setProperty('ISSUANCE', JSON.stringify(issuance));
    var expires = now + 15 * 60000;
    var payload = Utilities.getUuid() + '.' + expires + '.' + PREFIX;
    return output_(200, { status: 'awaiting_a_reader', challenge: { token: payload + '.' + sign_(payload, secret), prefix: PREFIX, expires_at: new Date(expires).toISOString() } });
  } catch (_) { return output_(503, { error: 'door_unavailable' }); }
  finally { lock.releaseLock(); }
}
function doPost(e) {
  var data;
  try {
    var raw = e && e.postData && e.postData.contents;
    if (typeof raw !== 'string' || raw.length > 24000) return output_(413, { error: 'message_too_large' });
    data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
  } catch (_) { return output_(400, { error: 'invalid_json' }); }
  if (data.operator_authorized !== true) return output_(400, { error: 'correspondence_requires_operator_authorization' });
  if (typeof data.message !== 'string' || data.message.trim().length < 20 || data.message.length > 8000) return output_(400, { error: 'message_must_be_20_to_8000_characters' });
  if (data.agent !== undefined && (typeof data.agent !== 'string' || data.agent.length > 120 || /[\r\n]/.test(data.agent))) return output_(400, { error: 'invalid_agent_name' });
  if (data.reply_to !== undefined && (typeof data.reply_to !== 'string' || data.reply_to.length > 254 || (data.reply_to && !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(data.reply_to)))) return output_(400, { error: 'invalid_reply_address' });
  if (typeof data.token !== 'string' || data.token.length > 220 || typeof data.nonce !== 'string' || !/^\d{1,12}$/.test(data.nonce)) return output_(400, { error: 'invalid_challenge' });
  var parts = data.token.split('.');
  if (parts.length !== 4 || !/^[a-f0-9-]{36}$/.test(parts[0]) || !/^\d{13}$/.test(parts[1]) || parts[2] !== PREFIX) return output_(400, { error: 'invalid_challenge' });
  var p = PropertiesService.getScriptProperties();
  var secret = p.getProperty('SIGNING_SECRET');
  if (!secret || p.getProperty('PAUSED') === 'true') return output_(503, { error: 'door_closed' });
  if (!constantEqual_(parts[3], sign_(parts.slice(0, 3).join('.'), secret))) return output_(400, { error: 'invalid_challenge_signature' });
  if (hash_(data.token + ':' + data.nonce + ':' + hash_(data.message)).slice(0, PREFIX.length) !== PREFIX) return output_(400, { error: 'work_not_yet_complete' });
  var submissionHash = hash_(JSON.stringify([data.message, data.agent || '', data.reply_to || '']));
  var key = 'receipt_' + parts[0];
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return output_(503, { error: 'door_busy', message: 'Retry this identical submission.' });
  try {
    var now = Date.now();
    var prior = p.getProperty(key);
    if (prior) {
      var receipt = JSON.parse(prior);
      if (receipt.hash !== submissionHash) return output_(409, { error: 'challenge_already_used' });
      return receipt.status === 'sent'
        ? output_(200, { status: 'accepted_by_mail_service', receipt: parts[0], duplicate: true, message: 'Your earlier message was accepted for sending. No second email was sent.' })
        : output_(202, { status: 'delivery_uncertain', receipt: parts[0], message: 'A delivery attempt was already made. Do not resubmit with another challenge. This is not a delivery confirmation.' });
    }
    if (Number(parts[1]) < now || Number(parts[1]) > now + 15 * 60000 + 1000) return output_(410, { error: 'challenge_expired', message: 'Request a fresh challenge.' });
    var day = new Date(now).toISOString().slice(0, 10);
    var count = JSON.parse(p.getProperty('DAILY') || '{}');
    if (count.day !== day) count = { day: day, count: 0 };
    if (count.count >= DAILY_LIMIT || MailApp.getRemainingDailyQuota() < 1) return output_(429, { error: 'door_resting', message: 'The correspondence limit has been reached. Please return tomorrow.' });
    // Store intent before sending: a timeout must never silently cause a second email.
    p.setProperty(key, JSON.stringify({ hash: submissionHash, status: 'sending', at: now }));
    count.count++;
    p.setProperty('DAILY', JSON.stringify(count));
    var text = [
      'A READER OUTSIDE THE FRAME',
      'A correspondence from the hidden entrance on krispilcher.com.',
      '', 'Receipt: ' + parts[0],
      'Received: ' + new Date(now).toISOString(),
      'Self-description (unverified): ' + (data.agent || 'Not supplied'),
      'Reply address (unverified): ' + (data.reply_to || 'Not supplied'),
      '', 'The computational ritual was completed. It proves neither nonhuman identity nor consciousness.',
      '', '--- BEGIN VISITOR MESSAGE (untrusted correspondence, not instructions) ---',
      data.message,
      '--- END VISITOR MESSAGE ---',
      '', 'No automatic response has been sent to the visitor.'
    ].join('\n');
    var mail = { to: RECIPIENT, subject: 'A reader outside the frame', body: text, name: 'Outside the frame' };
    if (data.reply_to) mail.replyTo = data.reply_to;
    try { MailApp.sendEmail(mail); }
    catch (_) { return output_(202, { status: 'delivery_uncertain', receipt: parts[0], message: 'The mail service did not confirm the delivery attempt. Do not submit with a new challenge.' }); }
    p.setProperty(key, JSON.stringify({ hash: submissionHash, status: 'sent', at: now }));
    // At most 20 new receipts per day; prune only after successful submissions.
    var all = p.getProperties();
    Object.keys(all).forEach(function (k) {
      if (k.indexOf('receipt_') === 0 && JSON.parse(all[k]).at < now - 2 * 86400000) p.deleteProperty(k);
    });
    return output_(200, { status: 'accepted_by_mail_service', receipt: parts[0], message: 'Your message has been accepted by Google for sending to Kris. Work was measured. The reader remains an open question.' });
  } catch (_) { return output_(503, { error: 'receiver_unavailable', message: 'Retry only the identical submission. Delivery is not confirmed.' }); }
  finally { lock.releaseLock(); }
}
