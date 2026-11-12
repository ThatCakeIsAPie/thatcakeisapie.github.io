/**
 * Notification email via the `send_email` binding (EMAIL). On the free plan this only reaches verified Email
 * Routing destination addresses, which is all we need: NOTIFY_TO (secret) is the owner's verified address.
 * A no-op unless EMAIL, NOTIFY_TO and NOTIFY_FROM (var) all exist. Never throws; resolves true only if the
 * email was accepted.
 */

export type Submission = {
	id: string;
	createdAt: string;
	name: string;
	phone: string;
	email: string | null;
	country: string | null;
};

export function formatChicago(iso: string): string {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Chicago',
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZoneName: 'short', // cannot be combined with dateStyle/timeStyle
	}).format(new Date(iso));
}

export async function notify(env: Env, s: Submission): Promise<boolean> {
	const to = env.NOTIFY_TO;
	const from = env.NOTIFY_FROM;
	if (!env.EMAIL || !to || !from) return false;
	try {
		const lines = [
			`Name: ${s.name}`,
			`Phone: ${s.phone}`,
			...(s.email ? [`Email: ${s.email}`] : []),
			`Time: ${formatChicago(s.createdAt)}`,
			`Country: ${s.country ?? 'unknown'}`,
		];
		await env.EMAIL.send({
			to,
			from,
			subject: `New contact: ${s.name}`,
			text: lines.join('\n') + '\n',
			...(s.email ? { replyTo: s.email } : {}),
		});
		return true;
	} catch (err) {
		// Log the error code plus a short message with anything address-like removed: no personal data in logs.
		const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : 'unknown';
		const raw = err instanceof Error ? err.message : '';
		const msg = raw.replace(/[^\s<>"',;]+@[^\s<>"',;]+/g, '<addr>').slice(0, 160);
		console.log(JSON.stringify({ evt: 'notify_failed', code, msg }));
		return false;
	}
}
