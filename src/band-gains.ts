import {
	DEFAULT_SAMPLE_RATE,
	FIXED_BAND_FREQUENCIES,
	FIXED_BAND_Q,
	FIXED_BAND_TOLERANCE_OCTAVES,
} from './constants.js'
import { frequencyResponse, logFrequencies } from './response.js'
import type { BandGains, EqBand, Filter, Profile } from './types.js'

export interface BandGainsOptions {
	/** Lowest gain in dB the equalizer supports. Defaults to `-12`. */
	minGain?: number
	/** Highest gain in dB the equalizer supports. Defaults to `12`. */
	maxGain?: number
	/** The sample rate the equalizer runs at. Defaults to {@link DEFAULT_SAMPLE_RATE}. */
	sampleRate?: number
	/**
	 * Whether to use AutoEq's fixed-band gains directly when the bands match
	 * its 10-band layout. Defaults to `true`.
	 */
	useFixedBand?: boolean
}

/** Gains are rounded to this many steps per dB (0.1 dB), like AutoEq's own files */
const STEPS_PER_DB = 10

/** Gains finer than this are rounding noise, so fitting stops */
const CONVERGENCE_DB = 0.001

const MAX_ITERATIONS = 50

/** Step in dB for the numerical derivative of a band's response */
const DERIVATIVE_STEP_DB = 0.25

/** Damping that keeps the fit stable when neighbouring bands overlap heavily */
const DAMPING = 1e-3

const roundGain = (gain: number) => Math.round(gain * STEPS_PER_DB) / STEPS_PER_DB + 0

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Computes the preamp in dB that keeps a set of filters from boosting any
 * frequency above 0 dB, the same way AutoEq does.
 *
 * @returns A preamp ≤ 0, rounded down to 0.1 dB
 */
export function computePreamp(
	filters: readonly Filter[],
	sampleRate: number = DEFAULT_SAMPLE_RATE,
): number {
	const response = frequencyResponse(filters, analysisFrequencies(sampleRate), sampleRate)
	const peak = Math.max(0, ...response)
	return -Math.ceil(peak * STEPS_PER_DB - 1e-9) / STEPS_PER_DB + 0
}

/**
 * Converts a profile to gains for a graphic equalizer with the given bands.
 *
 * When the bands match AutoEq's 10-band layout ({@link FIXED_BAND_FREQUENCIES},
 * Q {@link FIXED_BAND_Q}), AutoEq's own fixed-band gains are used. Otherwise
 * the gains are fitted to the profile's parametric EQ by least squares.
 *
 * Gains are clamped to `minGain` and `maxGain`, and the preamp is recomputed
 * whenever that changes the response.
 *
 * @param profile The profile to convert
 * @param bands Center frequencies in Hz, or bands with their own Q
 * @param options The equalizer's gain range and sample rate
 *
 * @example
 * ```ts
 * const { preamp, gains } = toBandGains(profile, [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000])
 * ```
 */
export function toBandGains(
	profile: Profile,
	bands: readonly (number | EqBand)[],
	options: BandGainsOptions = {},
): BandGains {
	const {
		minGain = -12,
		maxGain = 12,
		sampleRate = DEFAULT_SAMPLE_RATE,
		useFixedBand = true,
	} = options

	if (minGain > 0 || maxGain < 0 || minGain >= maxGain) {
		throw new RangeError(`Invalid gain range: ${minGain} to ${maxGain} dB`)
	}

	const normalized = bands.map((band) =>
		typeof band === 'number'
			? { frequency: band, q: FIXED_BAND_Q }
			: { frequency: band.frequency, q: band.q ?? FIXED_BAND_Q },
	)

	if (normalized.length === 0) {
		return { preamp: 0, gains: [], method: 'fitted' }
	}

	if (useFixedBand && matchesFixedBand(normalized)) {
		const original = profile.fixedBand.filters.map((filter) => filter.gain)
		const gains = original.map((gain) => clamp(gain, minGain, maxGain))
		const clamped = gains.some((gain, index) => gain !== original[index])

		return {
			preamp: clamped
				? computePreamp(toFilters(normalized, gains), sampleRate)
				: profile.fixedBand.preamp,
			gains,
			method: 'fixedBand',
		}
	}

	const gains = fitGains(profile.parametric.filters, normalized, minGain, maxGain, sampleRate)

	return {
		preamp: computePreamp(toFilters(normalized, gains), sampleRate),
		gains,
		method: 'fitted',
	}
}

/**
 * Whether bands match AutoEq's 10-band layout closely enough to use its
 * fixed-band gains as they are.
 */
function matchesFixedBand(bands: readonly Required<EqBand>[]): boolean {
	return (
		bands.length === FIXED_BAND_FREQUENCIES.length &&
		bands.every(
			(band, index) =>
				Math.abs(Math.log2(band.frequency / FIXED_BAND_FREQUENCIES[index]!)) <=
					FIXED_BAND_TOLERANCE_OCTAVES && Math.abs(band.q - FIXED_BAND_Q) < 0.05,
		)
	)
}

function toFilters(bands: readonly Required<EqBand>[], gains: readonly number[]): Filter[] {
	return bands.map((band, index) => ({
		type: 'peaking',
		frequency: band.frequency,
		gain: gains[index] ?? 0,
		q: band.q,
	}))
}

/**
 * The audible frequencies to evaluate responses at, kept below Nyquist.
 */
function analysisFrequencies(sampleRate: number): number[] {
	return logFrequencies(20, Math.min(20000, sampleRate * 0.45))
}

/**
 * Fits peaking-filter gains at the given bands to the response of `target`
 * using damped Gauss-Newton, clamping gains to the allowed range after each step.
 */
function fitGains(
	target: readonly Filter[],
	bands: readonly Required<EqBand>[],
	minGain: number,
	maxGain: number,
	sampleRate: number,
): number[] {
	const frequencies = analysisFrequencies(sampleRate)
	const targetResponse = frequencyResponse(target, frequencies, sampleRate)

	const bandResponse = (index: number, gain: number) =>
		frequencyResponse([toFilters([bands[index]!], [gain])[0]!], frequencies, sampleRate)

	// Start from the target response at each band's center
	let gains = frequencyResponse(
		target,
		bands.map((band) => band.frequency),
		sampleRate,
	).map((gain) => clamp(gain, minGain, maxGain))

	for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
		const model = new Array<number>(frequencies.length).fill(0)
		const jacobian: number[][] = []

		gains.forEach((gain, index) => {
			bandResponse(index, gain).forEach((value, f) => {
				model[f]! += value
			})

			const above = bandResponse(index, gain + DERIVATIVE_STEP_DB)
			const below = bandResponse(index, gain - DERIVATIVE_STEP_DB)
			jacobian.push(above.map((value, f) => (value - below[f]!) / (2 * DERIVATIVE_STEP_DB)))
		})

		const residual = targetResponse.map((value, f) => value - model[f]!)

		const n = gains.length
		const normal = Array.from({ length: n }, (_, i) =>
			Array.from({ length: n }, (_, j) => dot(jacobian[i]!, jacobian[j]!)),
		)
		const rhs = jacobian.map((column) => dot(column, residual))

		const meanDiagonal = normal.reduce((sum, row, i) => sum + row[i]!, 0) / n
		normal.forEach((row, i) => {
			row[i]! += DAMPING * meanDiagonal
		})

		const step = solve(normal, rhs)
		const next = gains.map((gain, index) => clamp(gain + step[index]!, minGain, maxGain))
		const change = Math.max(...next.map((gain, index) => Math.abs(gain - gains[index]!)))

		gains = next
		if (change < CONVERGENCE_DB) break
	}

	return gains.map(roundGain)
}

function dot(a: readonly number[], b: readonly number[]): number {
	let sum = 0
	for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!
	return sum
}

/**
 * Solves `matrix · x = vector` by Gaussian elimination with partial pivoting.
 */
function solve(matrix: number[][], vector: number[]): number[] {
	const n = vector.length
	const a = matrix.map((row, i) => [...row, vector[i]!])

	for (let col = 0; col < n; col++) {
		let pivot = col
		for (let row = col + 1; row < n; row++) {
			if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row
		}
		;[a[col], a[pivot]] = [a[pivot]!, a[col]!]

		const pivotValue = a[col]![col]!
		if (Math.abs(pivotValue) < 1e-12) continue

		for (let row = col + 1; row < n; row++) {
			const factor = a[row]![col]! / pivotValue
			for (let k = col; k <= n; k++) a[row]![k]! -= factor * a[col]![k]!
		}
	}

	const x = new Array<number>(n).fill(0)
	for (let row = n - 1; row >= 0; row--) {
		const pivotValue = a[row]![row]!
		if (Math.abs(pivotValue) < 1e-12) continue

		let sum = a[row]![n]!
		for (let k = row + 1; k < n; k++) sum -= a[row]![k]! * x[k]!
		x[row] = sum / pivotValue
	}

	return x
}
