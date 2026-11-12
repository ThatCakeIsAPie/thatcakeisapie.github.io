/** Server-side validation. Authoritative; the site's inline script mirrors these rules. */

export type Field = 'name' | 'phone' | 'email' | 'message';
export type ValidationError = { error: string; field: Field };
export type Cleaned = { name: string; phone: string; email: string | null; message: string | null };

// C0/C1 control characters plus the Unicode line/paragraph separators.
const CONTROL = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;
// Bidirectional override/embedding/isolate characters (U+202A-U+202E, U+2066-U+2069): can visually reorder text.
const BIDI = /[\u202A-\u202E\u2066-\u2069]/g;
const PHONE_STRIP = /[\s\-.()]/g;
const MESSAGE_MAX = 300;
const PHONE_OK = /^\+?\d{7,15}$/;
const EMAIL_OK = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

const clean = (v: unknown): string => (typeof v === 'string' ? v.replace(CONTROL, '').replace(BIDI, '').trim() : '');
// Single-line free text: newlines and tabs become one space (then runs of whitespace collapse), other controls and bidi characters go.
const cleanLine = (v: unknown): string =>
	typeof v === 'string'
		? v
				.replace(/[\t\n\v\f\r\u0085\u2028\u2029]+/g, ' ')
				.replace(CONTROL, '')
				.replace(BIDI, '')
				.replace(/ {2,}/g, ' ')
				.trim()
		: '';
const length = (s: string): number => [...s].length;

export function validate(input: { name?: unknown; phone?: unknown; email?: unknown; message?: unknown }): Cleaned | ValidationError {
	const name = clean(input.name);
	if (!name) return { error: 'name_required', field: 'name' };
	if (length(name) > 100) return { error: 'name_too_long', field: 'name' };

	const phone = clean(input.phone);
	if (!phone) return { error: 'phone_required', field: 'phone' };
	if (phone.length > 40 || !PHONE_OK.test(phone.replace(PHONE_STRIP, ''))) {
		return { error: 'phone_invalid', field: 'phone' };
	}

	const emailRaw = clean(input.email);
	let email: string | null = null;
	if (emailRaw) {
		if (emailRaw.length > 254) return { error: 'email_too_long', field: 'email' };
		if (!EMAIL_OK.test(emailRaw)) return { error: 'email_invalid', field: 'email' };
		email = emailRaw;
	}

	// Optional. Absent/null/empty means no message; any other non-string value is rejected rather than guessed at.
	if (input.message != null && typeof input.message !== 'string') return { error: 'invalid_message', field: 'message' };
	const messageRaw = cleanLine(input.message);
	let message: string | null = null;
	if (messageRaw) {
		if (length(messageRaw) > MESSAGE_MAX) return { error: 'invalid_message', field: 'message' };
		message = messageRaw;
	}
	return { name, phone, email, message };
}

export const isValidationError = (r: Cleaned | ValidationError): r is ValidationError => 'error' in r;
