/**
 * Lowercases text, strips diacritics and spells out `&` and `+`, so names
 * compare the same however they're written.
 */
function fold(text: string): string {
	return text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/\+/g, ' plus ')
}

/**
 * Converts text to a URL and filename safe slug, e.g.
 * `Sennheiser HD 650` → `sennheiser-hd-650`.
 */
export function slugify(text: string): string {
	return fold(text)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

/**
 * Splits text into lowercase alphanumeric tokens, e.g.
 * `Sony WH-1000XM4` → `['sony', 'wh', '1000xm4']`.
 */
export function tokenize(text: string): string[] {
	return fold(text)
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length > 0)
}
