import { notify } from './notify';
import { isValidationError, validate } from './validate';

const MAX_BODY_BYTES = 4096;
const RATE_LIMIT = 5; // accepted submissions per rolling window per ip_hash
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MIN_ELAPSED_MS = 800; // faster than a human can focus a field and press Send
const TURNSTILE_ACTION = 'contact';
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const log = (evt: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ evt, ...extra }));

const originList = (env: Env): string[] =>
	(env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
			'x-content-type-options': 'nosniff',
			...extra,
		},
	});
}

const fail = (error: string, status: number, cors: Record<string, string>, field?: string) =>
	json(field ? { ok: false, error, field } : { ok: false, error }, status, cors);

/** Read at most MAX_BODY_BYTES; null when the body is larger. */
async function readLimited(request: Request): Promise<string | null> {
	const declared = Number(request.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
	if (!request.body) return '';
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_BODY_BYTES) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	const all = new Uint8Array(total);
	let off = 0;
	for (const c of chunks) {
		all.set(c, off);
		off += c.byteLength;
	}
	return new TextDecoder().decode(all);
}

async function ipHash(ip: string, pepper: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${pepper}`));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyTurnstile(env: Env, token: string, ip: string): Promise<'ok' | 'rejected' | 'unavailable'> {
	const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
	if (ip) form.set('remoteip', ip);
	let result: { success?: boolean; action?: string; hostname?: string; 'error-codes'?: string[] };
	try {
		const r = await fetch(SITEVERIFY, { method: 'POST', body: form, signal: AbortSignal.timeout(8000) });
		if (!r.ok) throw new Error(`siteverify ${r.status}`);
		result = await r.json();
	} catch {
		return 'unavailable';
	}
	if (result.success !== true) {
		log('siteverify_failed', { codes: result['error-codes'] ?? [] });
		return 'rejected';
	}
	// The Turnstile dummy/test keys return a fixed hostname and action; local dev only (.dev.vars).
	if (env.TURNSTILE_RELAXED === '1') return 'ok';
	const hosts = originList(env).map((o) => new URL(o).hostname);
	if (result.action !== TURNSTILE_ACTION || !result.hostname || !hosts.includes(result.hostname)) return 'rejected';
	return 'ok';
}

async function handleContact(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const origin = request.headers.get('origin');
	if (!origin || !originList(env).includes(origin)) return fail('forbidden_origin', 403, {});
	const cors = {
		'access-control-allow-origin': origin,
		vary: 'Origin',
	};

	if (request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: {
				...cors,
				'access-control-allow-methods': 'POST, OPTIONS',
				'access-control-allow-headers': 'Content-Type',
				'access-control-max-age': '86400',
			},
		});
	}
	if (request.method !== 'POST') return fail('not_found', 404, cors);

	if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
		return fail('unsupported_media_type', 415, cors);
	}
	const text = await readLimited(request);
	if (text === null) return fail('payload_too_large', 413, cors);

	let body: Record<string, unknown>;
	try {
		const parsed: unknown = JSON.parse(text);
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('shape');
		body = parsed as Record<string, unknown>;
	} catch {
		return fail('bad_request', 400, cors);
	}

	// Honeypot: pretend success, store nothing.
	if (typeof body.company === 'string' ? body.company.trim() !== '' : body.company != null && body.company !== '') {
		log('contact', { outcome: 'honeypot' });
		return json({ ok: true }, 200, cors);
	}
	// Submitted faster than a human could: treat like the honeypot.
	if (typeof body.elapsedMs === 'number' && body.elapsedMs < MIN_ELAPSED_MS) {
		log('contact', { outcome: 'too_fast' });
		return json({ ok: true }, 200, cors);
	}

	const cleaned = validate(body);
	if (isValidationError(cleaned)) return fail(cleaned.error, 400, cors, cleaned.field);

	if (!env.TURNSTILE_SECRET || !env.IP_PEPPER) {
		log('contact', { outcome: 'misconfigured' });
		return fail('server_error', 500, cors);
	}

	const token = body.token;
	if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
		return fail('turnstile_failed', 403, cors);
	}
	const ip = request.headers.get('cf-connecting-ip') ?? '';
	const verdict = await verifyTurnstile(env, token, ip);
	if (verdict === 'unavailable') {
		log('contact', { outcome: 'turnstile_unavailable' });
		return fail('verification_unavailable', 503, cors);
	}
	if (verdict === 'rejected') {
		log('contact', { outcome: 'turnstile_rejected' });
		return fail('turnstile_failed', 403, cors);
	}

	const hash = await ipHash(ip || 'unknown', env.IP_PEPPER);
	const id = crypto.randomUUID();
	const now = new Date();
	const createdAt = now.toISOString();
	const since = new Date(now.getTime() - RATE_WINDOW_MS).toISOString();
	const country = request.headers.get('cf-ipcountry') ?? (request.cf?.country as string | undefined) ?? null;

	try {
		// One statement: insert only while this client is under the limit (no check-then-insert race).
		const res = await env.DB.prepare(
			`INSERT INTO submissions (id, created_at, name, phone, email, country, ip_hash)
			 SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
			 WHERE (SELECT COUNT(*) FROM submissions WHERE ip_hash = ?7 AND created_at > ?8) < ?9`,
		)
			.bind(id, createdAt, cleaned.name, cleaned.phone, cleaned.email, country, hash, since, RATE_LIMIT)
			.run();
		if (res.meta.changes === 0) {
			log('contact', { outcome: 'rate_limited' });
			return fail('rate_limited', 429, { ...cors, 'retry-after': '3600' });
		}
	} catch (err) {
		log('contact', { outcome: 'db_error', name: err instanceof Error ? err.name : 'unknown' });
		return fail('server_error', 500, cors);
	}

	log('contact', { outcome: 'stored', id, country });

	ctx.waitUntil(
		notify(env, { id, createdAt, ...cleaned, country })
			.then(async (sent) => {
				if (sent) await env.DB.prepare('UPDATE submissions SET notified = 1 WHERE id = ?1').bind(id).run();
			})
			.catch(() => log('notify_update_failed', { id })),
	);

	return json({ ok: true }, 200, cors);
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const { pathname } = new URL(request.url);
			if (pathname === '/contact') return await handleContact(request, env, ctx);
			if (pathname === '/health' && request.method === 'GET') return json({ ok: true }, 200);
			return json({ ok: false, error: 'not_found' }, 404);
		} catch (err) {
			log('unhandled', { name: err instanceof Error ? err.name : 'unknown' });
			return json({ ok: false, error: 'server_error' }, 500);
		}
	},
} satisfies ExportedHandler<Env>;
