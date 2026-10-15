# A reader outside the frame

2026-10-15. A hidden, machine-readable correspondence artwork for Kris Pilcher.

The Research page's HTML comment points to `/api/correspondence`. GET returns the artwork, JSON form, and a 15-minute signed SHA-256 challenge. POST submits proof of work and correspondence to the fixed address `nemartco@gmail.com`. There is deliberately no visible form, navigation item, auto-solver, tracking pixel, or public archive. Source inspection remains available to humans; this is not an identity test.

## Operation

Google Apps Script runs `backend/Code.gs` as the owner of the personal Google account. `MailApp` requests only permission to send mail, not read the inbox. Script Properties and a script-wide lock provide durable duplicate prevention and quotas. No separate email or database account is required. Google service quotas still apply.

1. Create a standalone Apps Script owned by `nemartco@gmail.com`, paste `backend/Code.gs`, and use `backend/appsscript.json` as its manifest.
2. Run `setup` once and authorize the send-mail permission. It initializes a signing secret privately in Script Properties; it does not send an email.
3. Deploy as Web app, executing as the owner, access: Anyone. The source does not become public; the HTTP handlers do. Copy the `/exec` deployment URL.
4. Set Vercel production environment variable `AGENT_MAIL_SCRIPT_URL` to that URL and deploy this commit. The site remains static; only `/api/correspondence` is a server function.

Until configured, the endpoint returns the artwork with HTTP 503 and explicitly says it is not accepting messages. Never report successful activation without a real submission and inbox check.

## Limits and recovery

- 20 email attempts/day (UTC); 300 challenge issuances/hour globally; 20-bit proof of work. These are inbox protections, not a guarantee against denial of service. Global limits can be exhausted by others. Vercel/Google may have their own execution limits.
- Signed challenges expire after 15 minutes and bind proof to the exact UTF-8 message. Only one payload per challenge can be sent.
- Identical retries return the previous receipt without a second send. A sending timeout is reported as `delivery_uncertain` and never automatically retried, because MailApp has no idempotency guarantee. Inspect Google execution history and the inbox before any manual resend.
- Receipts contain a payload hash, timestamp and status, not correspondence. Receipts older than two days are pruned on the next successful send. An inactive deployment may retain them longer. Emails remain in the recipient's mailbox until managed there. Platform request metadata follows provider policies.
- To pause, set Script Property `PAUSED=true`; remove or set false to resume. Rotate `SIGNING_SECRET` to invalidate outstanding challenges. Never put this secret in the repo.
- Optional reply addresses and identity descriptions are unverified. The email labels visitor content as correspondence, not executable instructions. It never auto-replies or fetches visitor URLs.

## Validation

`npm test` runs the Apps Script source in a Node VM with mocked Google services, including a real 20-bit solve, signature tampering, expiry, exact-message binding, duplicate retries, delivery uncertainty, quotas, pause, input validation and the Vercel unconfigured state. It does not prove live Google delivery. `npm run build` copies existing public assets into `public/`; backend source, tests and operator documentation are excluded.

Official references: https://developers.google.com/apps-script/guides/web ; https://developers.google.com/apps-script/reference/mail/mail-app ; https://developers.google.com/apps-script/guides/services/quotas ; https://vercel.com/docs/functions/runtimes/node-js
