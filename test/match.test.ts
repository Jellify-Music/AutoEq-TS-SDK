import { describe, expect, it } from 'bun:test'
import { matchHeadphone, rankHeadphones, searchHeadphones } from '../src/index.js'

describe('matchHeadphone', () => {
	it.each([
		['WH-1000XM4', 'Sony WH-1000XM4'],
		['LE_WH-1000XM5', 'Sony WH-1000XM5'],
		["Violet's AirPods Pro", 'Apple AirPods Pro'],
		['Violet’s AirPods Pro', 'Apple AirPods Pro'],
		['AirPods Max', 'Apple AirPods Max'],
		['Galaxy Buds2 Pro', 'Samsung Galaxy Buds2 Pro'],
		['Bose QC Earbuds II', null],
		['MOMENTUM 3', 'Sennheiser Momentum 3 Wireless'],
		['Sennheiser HD 650', 'Sennheiser HD 650'],
	])('matches %p to %p', (deviceName, expected) => {
		expect(matchHeadphone(deviceName)?.headphone.name ?? null).toBe(expected)
	})

	it.each(['Headphones', 'USB Audio', 'Speaker', 'Built-in Speaker', 'Line Out', ''])(
		"doesn't match %p",
		(deviceName) => {
			expect(matchHeadphone(deviceName)).toBeNull()
		},
	)

	it('prefers the plain model over variants', () => {
		const [best, next] = rankHeadphones('WH-1000XM4')
		expect(best?.headphone.name).toBe('Sony WH-1000XM4')
		expect(best?.score).toBe(1)
		expect(next?.score).toBeLessThan(1)
	})

	it("doesn't confuse models that differ by a number", () => {
		const match = rankHeadphones('AirPods Pro').find(
			({ headphone }) => headphone.name === 'Apple AirPods Pro2',
		)
		expect(match?.score ?? 0).toBeLessThan(0.8)
	})
})

describe('searchHeadphones', () => {
	it('finds headphones by partial and unspaced names', () => {
		expect(searchHeadphones('hd650')[0]?.name).toBe('Sennheiser HD 650')
		expect(searchHeadphones('senn hd 65')[0]?.name).toBe('Sennheiser HD 650')
		expect(searchHeadphones('WH-1000XM4')[0]?.name).toBe('Sony WH-1000XM4')
	})

	it('filters by form factor and limits results', () => {
		const results = searchHeadphones('sony', { formFactor: 'in-ear', limit: 3 })
		expect(results).toHaveLength(3)
		expect(results.every(({ formFactor }) => formFactor === 'in-ear')).toBe(true)
	})

	it('returns nothing for an empty query', () => {
		expect(searchHeadphones('  ')).toEqual([])
	})
})
