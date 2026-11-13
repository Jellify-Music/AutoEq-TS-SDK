import { DEFAULT_SAMPLE_RATE } from './constants.js'
import type { Filter } from './types.js'

/**
 * Normalized biquad coefficients `[b0, b1, b2, a1, a2]`, with `a0 = 1`.
 */
type Coefficients = [number, number, number, number, number]

/**
 * Computes biquad coefficients for a filter using the formulas from Robert
 * Bristow-Johnson's Audio EQ Cookbook, which AutoEq also uses.
 *
 * @see https://www.w3.org/TR/audio-eq-cookbook/
 */
function coefficients(filter: Filter, sampleRate: number): Coefficients {
	const a = Math.pow(10, filter.gain / 40)
	const w0 = (2 * Math.PI * filter.frequency) / sampleRate
	const cos = Math.cos(w0)
	const alpha = Math.sin(w0) / (2 * filter.q)

	let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number

	switch (filter.type) {
		case 'peaking':
			b0 = 1 + alpha * a
			b1 = -2 * cos
			b2 = 1 - alpha * a
			a0 = 1 + alpha / a
			a1 = -2 * cos
			a2 = 1 - alpha / a
			break
		case 'lowShelf': {
			const k = 2 * Math.sqrt(a) * alpha
			b0 = a * (a + 1 - (a - 1) * cos + k)
			b1 = 2 * a * (a - 1 - (a + 1) * cos)
			b2 = a * (a + 1 - (a - 1) * cos - k)
			a0 = a + 1 + (a - 1) * cos + k
			a1 = -2 * (a - 1 + (a + 1) * cos)
			a2 = a + 1 + (a - 1) * cos - k
			break
		}
		case 'highShelf': {
			const k = 2 * Math.sqrt(a) * alpha
			b0 = a * (a + 1 + (a - 1) * cos + k)
			b1 = -2 * a * (a - 1 + (a + 1) * cos)
			b2 = a * (a + 1 + (a - 1) * cos - k)
			a0 = a + 1 - (a - 1) * cos + k
			a1 = 2 * (a - 1 - (a + 1) * cos)
			a2 = a + 1 - (a - 1) * cos - k
			break
		}
	}

	return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
}

/**
 * The magnitude in dB of a biquad at a frequency.
 */
function magnitude([b0, b1, b2, a1, a2]: Coefficients, frequency: number, sampleRate: number) {
	const w = (2 * Math.PI * frequency) / sampleRate
	const cos1 = Math.cos(w)
	const sin1 = Math.sin(w)
	const cos2 = Math.cos(2 * w)
	const sin2 = Math.sin(2 * w)

	const numerator = (b0 + b1 * cos1 + b2 * cos2) ** 2 + (b1 * sin1 + b2 * sin2) ** 2
	const denominator = (1 + a1 * cos1 + a2 * cos2) ** 2 + (a1 * sin1 + a2 * sin2) ** 2

	return 10 * Math.log10(numerator / denominator)
}

/**
 * Computes the combined magnitude response in dB of a set of filters.
 *
 * Doesn't include a preamp.
 *
 * @param filters The filters to evaluate
 * @param frequencies The frequencies in Hz to evaluate the response at
 * @param sampleRate The sample rate the filters run at
 * @returns The response in dB at each frequency
 */
export function frequencyResponse(
	filters: readonly Filter[],
	frequencies: readonly number[],
	sampleRate: number = DEFAULT_SAMPLE_RATE,
): number[] {
	const response = new Array<number>(frequencies.length).fill(0)

	for (const filter of filters) {
		if (filter.gain === 0) continue

		const coeffs = coefficients(filter, sampleRate)
		frequencies.forEach((frequency, index) => {
			response[index]! += magnitude(coeffs, frequency, sampleRate)
		})
	}

	return response
}

/**
 * Builds `count` frequencies spaced evenly on a log scale from `min` to `max` Hz.
 */
export function logFrequencies(min = 20, max = 20000, count = 256): number[] {
	const ratio = Math.log(max / min)
	return Array.from(
		{ length: count },
		(_, index) => min * Math.exp((ratio * index) / (count - 1)),
	)
}
