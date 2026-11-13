import { describe, expect, it } from 'bun:test'
import {
	computePreamp,
	FIXED_BAND_FREQUENCIES,
	frequencyResponse,
	getProfileEntries,
	logFrequencies,
	toBandGains,
} from '../src/index.js'
import { readProfile } from './helpers.js'

const HD_650 = readProfile('oratory1990/over-ear/sennheiser-hd-650')

/** Bands used by react-native-nitro-player, which labels 62 Hz as 63 Hz */
const NITRO_PLAYER_BANDS = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

/** Every 50th profile, to keep the tests quick */
const SAMPLE = getProfileEntries()
	.filter((_, index) => index % 50 === 0)
	.map(({ id }) => readProfile(id))

const rms = (values: number[]) =>
	Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length)

describe('computePreamp', () => {
	it('matches the preamp AutoEq computed for its profiles', () => {
		for (const profile of SAMPLE) {
			expect(computePreamp(profile.parametric.filters)).toBeCloseTo(
				profile.parametric.preamp,
				0,
			)
			expect(computePreamp(profile.fixedBand.filters)).toBeCloseTo(
				profile.fixedBand.preamp,
				0,
			)
		}
	})

	it('is zero when nothing is boosted', () => {
		expect(computePreamp([{ type: 'peaking', frequency: 1000, gain: -6, q: 1 }])).toBe(0)
	})
})

describe('toBandGains', () => {
	it("uses AutoEq's fixed-band gains for its own layout", () => {
		const result = toBandGains(HD_650, [...FIXED_BAND_FREQUENCIES])

		expect(result.method).toBe('fixedBand')
		expect(result.preamp).toBe(-7.4)
		expect(result.gains).toEqual([7, 2.6, -1.2, -2.2, 0.5, -1, 0.7, -1.2, 5.1, -3.6])
	})

	it('treats 63 Hz as the 62 Hz band', () => {
		expect(toBandGains(HD_650, NITRO_PLAYER_BANDS).method).toBe('fixedBand')
	})

	it('clamps fixed-band gains to the range and recomputes the preamp', () => {
		const result = toBandGains(HD_650, NITRO_PLAYER_BANDS, { minGain: -6, maxGain: 6 })

		expect(result.gains[0]).toBe(6)
		expect(Math.max(...result.gains)).toBeLessThanOrEqual(6)
		expect(result.preamp).toBeGreaterThan(-7.4)
		expect(result.preamp).toBeLessThanOrEqual(0)
	})

	it("fits gains close to AutoEq's own for its layout", () => {
		for (const profile of SAMPLE) {
			const fitted = toBandGains(profile, [...FIXED_BAND_FREQUENCIES], {
				useFixedBand: false,
			})
			const autoEq = profile.fixedBand.filters.map((filter) => filter.gain)

			expect(fitted.method).toBe('fitted')
			// Bands near the ends can differ more since the fit only sees 20 Hz – 20 kHz
			const middle = fitted.gains.slice(1, -1).map((gain, index) => gain - autoEq[index + 1]!)
			expect(rms(middle)).toBeLessThan(1.5)
		}
	})

	it('fits other layouts closely to the parametric response', () => {
		const bands = [60, 230, 910, 3600, 14000]
		const result = toBandGains(
			HD_650,
			bands.map((frequency) => ({ frequency, q: 0.8 })),
		)

		const frequencies = logFrequencies(40, 16000, 64)
		const target = frequencyResponse(HD_650.parametric.filters, frequencies)
		const fitted = frequencyResponse(
			bands.map((frequency, index) => ({
				type: 'peaking',
				frequency,
				gain: result.gains[index]!,
				q: 0.8,
			})),
			frequencies,
		)

		expect(result.method).toBe('fitted')
		expect(result.gains).toHaveLength(5)
		expect(rms(target.map((value, index) => value - fitted[index]!))).toBeLessThan(2)
		expect(result.preamp).toBe(
			computePreamp(
				bands.map((frequency, index) => ({
					type: 'peaking',
					frequency,
					gain: result.gains[index]!,
					q: 0.8,
				})),
			),
		)
	})

	it('keeps fitted gains in range and rounds them to 0.1 dB', () => {
		const result = toBandGains(HD_650, [100, 1000, 10000], { minGain: -3, maxGain: 3 })

		for (const gain of result.gains) {
			expect(gain).toBeGreaterThanOrEqual(-3)
			expect(gain).toBeLessThanOrEqual(3)
			expect(Math.round(gain * 10) / 10).toBe(gain)
		}
	})

	it('handles no bands', () => {
		expect(toBandGains(HD_650, [])).toEqual({ preamp: 0, gains: [], method: 'fitted' })
	})

	it('rejects an invalid gain range', () => {
		expect(() => toBandGains(HD_650, [1000], { minGain: 3, maxGain: 6 })).toThrow(RangeError)
	})
})
