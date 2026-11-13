import { getHeadphones } from './catalog.js'
import { tokenize } from './text.js'
import type { FormFactor, Headphone } from './types.js'

export interface SearchOptions {
	/** Maximum number of results. Defaults to `20`. */
	limit?: number
	/** Only return headphones of this form factor */
	formFactor?: FormFactor
}

export interface MatchOptions {
	/** Minimum score from 0 to 1 for a match. Defaults to {@link DEFAULT_MIN_MATCH_SCORE}. */
	minScore?: number
}

export interface RankOptions {
	/** Maximum number of results. Defaults to `5`. */
	limit?: number
}

/**
 * A headphone that matched an output device's name.
 */
export interface HeadphoneMatch {
	headphone: Headphone
	/** How closely the names matched, from 0 to 1 */
	score: number
}

/**
 * The default minimum score for {@link matchHeadphone}.
 */
export const DEFAULT_MIN_MATCH_SCORE = 0.8

/**
 * Words that Bluetooth and system audio device names add, or that headphone
 * names include inconsistently, so they're ignored when matching.
 */
const NOISE_TOKENS = new Set([
	'a2dp',
	'ble',
	'earbud',
	'earbuds',
	'earphone',
	'earphones',
	'free',
	'hands',
	'handsfree',
	'headphone',
	'headphones',
	'headset',
	'hfp',
	'le',
	'stereo',
	'true',
	'tws',
	'usb',
	'wireless',
])

/**
 * Words that operating systems use for outputs with no product name, like
 * `USB Audio` or `Built-in Speaker`. A device name made only of these and
 * {@link NOISE_TOKENS} can't identify a headphone.
 */
const GENERIC_DEVICE_TOKENS = new Set([
	'audio',
	'built',
	'default',
	'device',
	'digital',
	'in',
	'line',
	'out',
	'output',
	'phone',
	'speaker',
	'speakers',
])

/** How many leading words of a headphone name can be skipped as the brand */
const MAX_BRAND_TOKENS = 3

/** Score multiplier for variants like `(ANC Off)`, so the plain model wins ties */
const VARIANT_PENALTY = 0.97

/** Score multiplier when names only differ by a number, like `AirPods Pro` and `AirPods Pro 2` */
const NUMBER_MISMATCH_PENALTY = 0.6

interface IndexedHeadphone {
	headphone: Headphone
	tokens: string[]
	compact: string
	/** Tokens without any parenthesised variant, e.g. `(ANC Off)` */
	baseTokens: string[] | null
}

let indexed: IndexedHeadphone[] | undefined

function getIndexed(): IndexedHeadphone[] {
	indexed ??= getHeadphones().map((headphone) => {
		const tokens = tokenize(headphone.name)
		const base = headphone.name.replace(/\([^)]*\)/g, ' ')
		return {
			headphone,
			tokens,
			compact: tokens.join(''),
			baseTokens: base === headphone.name ? null : tokenize(base),
		}
	})
	return indexed
}

/**
 * Searches headphones by name, for a headphone picker.
 *
 * Every word in the query must start a word in the name, or appear in the
 * name with spaces removed, so `hd650` finds `Sennheiser HD 650`.
 */
export function searchHeadphones(query: string, options: SearchOptions = {}): Headphone[] {
	const { limit = 20, formFactor } = options

	const queryTokens = tokenize(query)
	if (queryTokens.length === 0) return []

	const queryCompact = queryTokens.join('')
	const results: { headphone: Headphone; score: number }[] = []

	for (const { headphone, tokens, compact } of getIndexed()) {
		if (formFactor && headphone.formFactor !== formFactor) continue

		let exactTokens = 0
		const matchesAll = queryTokens.every((queryToken) => {
			if (tokens.includes(queryToken)) {
				exactTokens++
				return true
			}
			return (
				tokens.some((token) => token.startsWith(queryToken)) || compact.includes(queryToken)
			)
		})
		if (!matchesAll) continue

		const coverage = queryCompact.length / compact.length
		const score =
			coverage +
			(compact.startsWith(queryCompact) ? 1 : 0) +
			(exactTokens === queryTokens.length ? 0.5 : 0)

		results.push({ headphone, score })
	}

	return results
		.sort((a, b) => b.score - a.score || a.headphone.name.localeCompare(b.headphone.name))
		.slice(0, limit)
		.map(({ headphone }) => headphone)
}

/**
 * Ranks headphones by how well their names match an audio output device's
 * name, best first.
 *
 * Handles the ways Bluetooth names usually differ from product names: a
 * missing brand (`WH-1000XM4`), an owner prefix (`Violet's AirPods Pro`),
 * different spacing (`Galaxy Buds2 Pro`) and suffixes like `LE_` or `Stereo`.
 */
export function rankHeadphones(deviceName: string, options: RankOptions = {}): HeadphoneMatch[] {
	const { limit = 5 } = options

	const deviceTokens = cleanTokens(tokenize(stripOwner(deviceName)))
	if (deviceTokens.every((token) => GENERIC_DEVICE_TOKENS.has(token))) return []

	const device = new Set(deviceTokens)
	const deviceCompact = deviceTokens.join('')

	const matches: HeadphoneMatch[] = []

	for (const { headphone, tokens, baseTokens } of getIndexed()) {
		let score = scoreTokens(cleanTokens(tokens), device, deviceCompact)
		if (baseTokens) {
			score = Math.max(
				score,
				scoreTokens(cleanTokens(baseTokens), device, deviceCompact) * VARIANT_PENALTY,
			)
		}

		if (score > 0) matches.push({ headphone, score })
	}

	return matches
		.sort(
			(a, b) =>
				b.score - a.score ||
				a.headphone.name.length - b.headphone.name.length ||
				a.headphone.name.localeCompare(b.headphone.name),
		)
		.slice(0, limit)
}

/**
 * Finds the headphone that best matches an audio output device's name,
 * such as a Bluetooth device name.
 *
 * Wired outputs usually report generic names like `Headphones` or
 * `USB Audio`, which won't match anything, so let the user pick their
 * headphones with {@link searchHeadphones} instead.
 *
 * @returns The best match, or `null` when nothing scores at least `minScore`
 */
export function matchHeadphone(
	deviceName: string,
	options: MatchOptions = {},
): HeadphoneMatch | null {
	const { minScore = DEFAULT_MIN_MATCH_SCORE } = options
	const [best] = rankHeadphones(deviceName, { limit: 1 })
	return best && best.score >= minScore ? best : null
}

/**
 * Removes an owner prefix like `Violet's ` from a device name.
 */
function stripOwner(deviceName: string): string {
	return deviceName.replace(/^.+?['’]s\s+/, '')
}

function cleanTokens(tokens: readonly string[]): string[] {
	return tokens.filter((token) => !NOISE_TOKENS.has(token))
}

/**
 * Scores a headphone name against a device name, from 0 to 1.
 */
function scoreTokens(
	tokens: readonly string[],
	device: ReadonlySet<string>,
	deviceCompact: string,
) {
	// Skip brand words at the start of the name that the device name leaves out
	let start = 0
	while (
		start < MAX_BRAND_TOKENS &&
		start < tokens.length - 1 &&
		!device.has(tokens[start]!) &&
		!deviceCompact.startsWith(tokens[start]!)
	) {
		start++
	}

	const model = tokens.slice(start)
	if (model.length === 0) return 0

	const modelCompact = model.join('')
	if (modelCompact === deviceCompact) return 1

	// Token overlap
	const modelSet = new Set(model)
	let shared = 0
	for (const token of modelSet) if (device.has(token)) shared++
	const union = modelSet.size + device.size - shared
	const overlap = shared / union

	// Same characters with different spacing, e.g. `Buds2` and `Buds 2`
	let containment = 0
	const [shorter, longer] =
		modelCompact.length <= deviceCompact.length
			? [modelCompact, deviceCompact]
			: [deviceCompact, modelCompact]
	if (shorter.length >= 4 && longer.includes(shorter)) {
		const extra = longer.replace(shorter, '')
		containment =
			(shorter.length / longer.length) * (/\d/.test(extra) ? NUMBER_MISMATCH_PENALTY : 1)
	}

	return Math.max(overlap, containment)
}
