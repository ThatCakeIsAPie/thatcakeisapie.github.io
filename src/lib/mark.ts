// Pulls the single path out of the brand SVG so it can be inlined once
// (as a <symbol>) and reused with <use>.
import raw from '../assets/brand/faleth-mark.svg?raw';

export const markViewBox = raw.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 100 100';
export const markSize = (() => {
	const [, , w, h] = markViewBox.split(/\s+/).map(Number);
	return { w, h };
})();
export const markPath = raw.match(/\sd="([^"]+)"/)?.[1] ?? '';
