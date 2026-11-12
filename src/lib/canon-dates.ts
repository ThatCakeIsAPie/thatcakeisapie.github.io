/** '2026-11-11T22:35:09Z' -> 'November 11, 2026' (UTC, so the same text is built everywhere). */
export function formatUpdated(iso: string | null | undefined): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
