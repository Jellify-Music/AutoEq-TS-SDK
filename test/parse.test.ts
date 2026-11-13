import { describe, expect, it } from 'bun:test'
import { formatAutoEqText, fromProfileJson, parseAutoEqText, toProfileJson } from '../src/index.js'

const HD_650_PARAMETRIC = `Preamp: -6.1 dB
Filter 1: ON LSC Fc 105 Hz Gain 6.4 dB Q 0.70
Filter 2: ON PK Fc 8800 Hz Gain 5.1 dB Q 1.42
Filter 3: ON PK Fc 118 Hz Gain -3.1 dB Q 0.50
Filter 4: ON PK Fc 37 Hz Gain 0.7 dB Q 3.96
Filter 5: ON PK Fc 3169 Hz Gain -1.7 dB Q 3.89
Filter 6: ON HSC Fc 10000 Hz Gain -2.1 dB Q 0.70
Filter 7: ON PK Fc 1227 Hz Gain -1.2 dB Q 2.53
Filter 8: ON PK Fc 2055 Hz Gain 1.2 dB Q 3.23
Filter 9: ON PK Fc 587 Hz Gain 0.4 dB Q 1.19
Filter 10: ON PK Fc 5332 Hz Gain -1.1 dB Q 5.75
`

describe('parseAutoEqText', () => {
	it('parses the preamp and filters', () => {
		const eq = parseAutoEqText(HD_650_PARAMETRIC)

		expect(eq.preamp).toBe(-6.1)
		expect(eq.filters).toHaveLength(10)
		expect(eq.filters[0]).toEqual({ type: 'lowShelf', frequency: 105, gain: 6.4, q: 0.7 })
		expect(eq.filters[1]).toEqual({ type: 'peaking', frequency: 8800, gain: 5.1, q: 1.42 })
		expect(eq.filters[5]).toEqual({ type: 'highShelf', frequency: 10000, gain: -2.1, q: 0.7 })
	})

	it('skips filters that are off and handles CRLF line endings', () => {
		const eq = parseAutoEqText(
			'Preamp: -1 dB\r\nFilter 1: OFF PK Fc 100 Hz Gain 3 dB Q 1\r\nFilter 2: ON PK Fc 200 Hz Gain 1 dB Q 1\r\n',
		)

		expect(eq.filters).toEqual([{ type: 'peaking', frequency: 200, gain: 1, q: 1 }])
	})

	it('throws on unsupported filter types', () => {
		expect(() => parseAutoEqText('Filter 1: ON LP Fc 100 Hz Gain 0 dB Q 1')).toThrow('LP')
	})

	it('round trips through formatAutoEqText', () => {
		expect(formatAutoEqText(parseAutoEqText(HD_650_PARAMETRIC))).toBe(HD_650_PARAMETRIC)
	})
})

describe('profile JSON', () => {
	it('round trips a profile', () => {
		const parametric = parseAutoEqText(HD_650_PARAMETRIC)
		const fixedBand = parseAutoEqText(
			[31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
				.map(
					(frequency, index) =>
						`Filter ${index + 1}: ON PK Fc ${frequency} Hz Gain ${index} dB Q 1.41`,
				)
				.join('\n'),
		)

		const profile = fromProfileJson('test', toProfileJson({ parametric, fixedBand }))

		expect(profile).toEqual({ id: 'test', parametric, fixedBand })
	})

	it('rejects invalid JSON', () => {
		expect(() => fromProfileJson('bad', {} as never)).toThrow('Invalid profile: bad')
	})
})
