// Secrets and local-only vars that `wrangler types` cannot see in wrangler.jsonc.
// (`npm run types` ignores .dev.vars on purpose so the types are the same on every machine.)
interface Env {
	/** Secret. Turnstile secret key. */
	TURNSTILE_SECRET: string;
	/** Secret. Pepper mixed into the IP hash. */
	IP_PEPPER: string;
	/** Local dev only (.dev.vars): '1' skips the Turnstile action/hostname check, because test keys return fixed values. */
	TURNSTILE_RELAXED?: string;
	/** Secret. Notification recipient. */
	NOTIFY_TO?: string;
	/** Var. Sender address on the Email Routing domain. */
	NOTIFY_FROM?: string;
}
