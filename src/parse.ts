import { FIXED_BAND_FREQUENCIES, FIXED_BAND_Q } from './constants.js'
import type { Filter, FilterType, ParametricEq, Profile } from './types.js'

const FILTER_CODES = {
	PK: 'peaking',
	LSC: 'lowShelf',
	HSC: 'highShelf',
} as const satisfies Record<string, FilterType>

type FilterCode = keyof typeof FILTER_CODES

const FILTER_TYPES = Object.fromEntries(
	Object.entries(FILTER_CODES).map(([code, type]) => [type, code]),
) as Record<FilterType, FilterCode>

const PREAMP_PATTERN = /^Preamp:\s*(-?[\d.]+)\s*dB/i

const FILTER_PATTERN =
	/^Filter\s+\d+:\s*(ON|OFF)\s+(\w+)\s+Fc\s+([\d.]+)\s*Hz\s+Gain\s+(-?[\d.]+)\s*dB\s+Q\s+([\d.]+)/i

/**
 * Parses an EQ in AutoEq's text format, as used by its `ParametricEQ.txt`
 * and `FixedBandEQ.txt` files (and Equalizer APO):
 *
 * ```
 * Preamp: -6.1 dB
 * Filter 1: ON LSC Fc 105 Hz Gain 6.4 dB Q 0.70
 * Filter 2: ON PK Fc 8800 Hz Gain 5.1 dB Q 1.42
 * ```
 *
 * Filters that are `OFF` are skipped.
 *
 * @throws If a filter uses a type other than `PK`, `LSC` or `HSC`
 */
export function parseAutoEqText(text: string): ParametricEq {
	let preamp = 0
	const filters: Filter[] = []

	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim()

		const preampMatch = PREAMP_PATTERN.exec(trimmed)
		if (preampMatch) {
			preamp = Number(preampMatch[1])
			continue
		}

		const filterMatch = FILTER_PATTERN.exec(trimmed)
		if (!filterMatch) continue

		const [, state, code, frequency, gain, q] = filterMatch
		if (state?.toUpperCase() === 'OFF') continue

		const type = FILTER_CODES[code?.toUpperCase() as FilterCode]
		if (!type) throw new Error(`Unsupported filter type: ${code}`)

		filters.push({ type, frequency: Number(frequency), gain: Number(gain), q: Number(q) })
	}

	return { preamp, filters }
}

/**
 * Formats an EQ in AutoEq's text format, which Equalizer APO and many
 * other equalizers can import. The reverse of {@link parseAutoEqText}.
 */
export function formatAutoEqText(eq: ParametricEq): string {
	const lines = [`Preamp: ${eq.preamp.toFixed(1)} dB`]

	eq.filters.forEach((filter, index) => {
		lines.push(
			`Filter ${index + 1}: ON ${FILTER_TYPES[filter.type]} Fc ${Math.round(filter.frequency)} Hz Gain ${filter.gain.toFixed(1)} dB Q ${filter.q.toFixed(2)}`,
		)
	})

	return `${lines.join('\n')}\n`
}

/**
 * The compact JSON form of a {@link Profile}, as stored under `profiles/`.
 *
 * Filters are `[code, frequency, gain, q]` tuples and fixed-band gains are
 * in the order of {@link FIXED_BAND_FREQUENCIES}.
 */
export interface ProfileJson {
	preamp: number
	filters: [FilterCode, number, number, number][]
	fixedBand: {
		preamp: number
		gains: number[]
	}
}

/**
 * Converts a {@link Profile} to its compact JSON form.
 */
export function toProfileJson(profile: Omit<Profile, 'id'>): ProfileJson {
	return {
		preamp: profile.parametric.preamp,
		filters: profile.parametric.filters.map((filter) => [
			FILTER_TYPES[filter.type],
			filter.frequency,
			filter.gain,
			filter.q,
		]),
		fixedBand: {
			preamp: profile.fixedBand.preamp,
			gains: profile.fixedBand.filters.map((filter) => filter.gain),
		},
	}
}

/**
 * Converts a profile's compact JSON form back to a {@link Profile}.
 *
 * @throws If the JSON isn't a valid profile
 */
export function fromProfileJson(id: string, json: ProfileJson): Profile {
	if (
		typeof json?.preamp !== 'number' ||
		!Array.isArray(json.filters) ||
		!Array.isArray(json.fixedBand?.gains) ||
		json.fixedBand.gains.length !== FIXED_BAND_FREQUENCIES.length
	) {
		throw new Error(`Invalid profile: ${id}`)
	}

	return {
		id,
		parametric: {
			preamp: json.preamp,
			filters: json.filters.map(([code, frequency, gain, q]) => {
				const type = FILTER_CODES[code]
				if (!type) throw new Error(`Unsupported filter type in ${id}: ${code}`)
				return { type, frequency, gain, q }
			}),
		},
		fixedBand: {
			preamp: json.fixedBand.preamp,
			filters: json.fixedBand.gains.map((gain, index) => ({
				type: 'peaking',
				frequency: FIXED_BAND_FREQUENCIES[index]!,
				gain,
				q: FIXED_BAND_Q,
			})),
		},
	}
}
