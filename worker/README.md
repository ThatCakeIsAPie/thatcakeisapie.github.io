# coleholistics-contact

Cloudflare Worker behind the contact form on coleholistics.us. `POST /contact` validates, checks a
Turnstile token, rate-limits per IP hash, stores the submission in D1 and emails a notification to the owner.

- Body: `name`, `phone` (required), `email`, `message` (optional; `message` is one line, at most 300 characters after cleaning:
  control characters, line/paragraph separators and bidi override characters removed, newlines/tabs become one space;
  too long gives `400 {error:'invalid_message', field:'message'}`), `token`, plus the `company` honeypot and `elapsedMs`.
  Requests without `message` still work.
- Endpoint: `https://coleholistics-contact.lylecole.workers.dev/contact` (`GET /health` for a liveness check)
- D1 database: `coleholistics-contact` (binding `DB`), schema in `migrations/`
- Turnstile widget: `coleholistics.us contact form` (managed; hostnames coleholistics.us, www.coleholistics.us, localhost, 127.0.0.1)

## Config

| Name | Kind | Purpose |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | var (wrangler.jsonc) | Comma-separated exact origins allowed to POST. Anything else gets 403. |
| `TURNSTILE_SECRET` | secret | Turnstile secret key. |
| `IP_PEPPER` | secret | Mixed into SHA-256 of the client IP; raw IPs are never stored. |
| `NOTIFY_TO` | secret | Notification recipient: the owner's address, which must be a verified Email Routing destination address. |
| `NOTIFY_FROM` | var | Sender address, on the domain that has Email Routing enabled (`contact@coleholistics.us`). |
| `EMAIL` | `send_email` binding | Unrestricted send binding; the recipient is not pinned in `wrangler.jsonc` so no address lives in the repo. |
| `TURNSTILE_RELAXED` | `.dev.vars` only | `1` skips the action/hostname check, because Turnstile's test keys return fixed values. Never set in production. |

Set secrets with `npx wrangler secret put NAME` (value on stdin). Never commit values.

## Notification email

Free-plan setup, no Email Sending product (that needs the Workers Paid plan). Cloudflare allows a Worker to send to
**verified destination addresses** through the `send_email` binding on any plan, as long as Email Routing is enabled
for the sender's domain.

- Email Routing is enabled on `coleholistics.us` (`npx wrangler email routing enable coleholistics.us`); the owner's
  address is verified as a destination (`npx wrangler email routing addresses list`).
- `wrangler.jsonc` has `"send_email": [{ "name": "EMAIL" }]` and the var `NOTIFY_FROM`.
- `src/notify.ts` calls `env.EMAIL.send({ to, from, subject, text, replyTo? })` (plain text, subject
  `New contact: <name>`, an `About: <message>` line when the visitor gave one (body only, never a header), `Reply-To` set when the submitter gave an email). On success the row gets `notified = 1`.
  Errors are caught and logged as an error code plus a redacted message; a failed email never fails the submission.
- The recipient is the secret `NOTIFY_TO`. Set it without echoing it:
  `npx wrangler email routing addresses list | grep -Eo '[[:alnum:]._%+-]+@[[:alnum:].-]+' | head -1 | tr -d '\n' | npx wrangler secret put NOTIFY_TO`
- Limits: it can only reach verified destination addresses (sending to anyone else needs Email Sending on the Workers
  Paid plan). Replies to the submitter go from the owner's own mailbox, not from this Worker.
- Testing for real: `wrangler dev` simulates the binding and sends nothing. Use `npx wrangler dev --remote --port 8798`
  with a `.dev.vars` containing the Turnstile test secret, `ALLOWED_ORIGINS=http://localhost:<port>` and `NOTIFY_TO`;
  delete the test row from the remote D1 afterwards.

## Local development

```
cp /dev/null .dev.vars   # then add, using Cloudflare's always-pass Turnstile test secret:
# TURNSTILE_SECRET=1x0000000000000000000000000000000AA
# IP_PEPPER=any-local-string
# TURNSTILE_RELAXED=1
# ALLOWED_ORIGINS=http://localhost:4321,http://127.0.0.1:4321
npx wrangler d1 migrations apply DB --local
npx wrangler dev --port 8799
```

Point the site at it with `PUBLIC_CONTACT_ENDPOINT=http://127.0.0.1:8799/contact PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` at build/dev time
(the test site key always passes). `npm run check` regenerates types and runs `tsc`.

## Reading submissions

```
npx wrangler d1 execute DB --remote --command "SELECT created_at, name, phone, email, message, country, notified FROM submissions ORDER BY created_at DESC LIMIT 20"
```
