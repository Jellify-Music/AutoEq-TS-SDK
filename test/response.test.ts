import { describe, expect, it } from 'bun:test'
import { frequencyResponse, logFrequencies } from '../src/index.js'

describe('frequencyResponse', () => {
	it('is flat with no filters', () => {
		expect(frequencyResponse([], [100, 1000])).toEqual([0, 0])
	})

	it('peaks at the gain of a peaking filter at its center', () => {
		const [center, far] = frequencyResponse(
			[{ type: 'peaking', frequency: 1000, gain: 6, q: 1.41 }],
			[1000, 20],
		)

		expect(center).toBeCloseTo(6, 3)
		expect(far).toBeCloseTo(0, 1)
	})

	it('reaches the full gain of shelves past their corner and half at it', () => {
		const lowShelf = { type: 'lowShelf', frequency: 1000, gain: -8, q: 0.7 } as const
		const highShelf = { type: 'highShelf', frequency: 1000, gain: 4, q: 0.7 } as const

		const [lowBelow, lowCorner, lowAbove] = frequencyResponse([lowShelf], [20, 1000, 15000])
		expect(lowBelow).toBeCloseTo(-8, 1)
		expect(lowCorner).toBeCloseTo(-4, 1)
		expect(lowAbove).toBeCloseTo(0, 1)

		const [highBelow, highAbove] = frequencyResponse([highShelf], [20, 15000])
		expect(highBelow).toBeCloseTo(0, 1)
		expect(highAbove).toBeCloseTo(4, 0)
	})

	it('sums filters', () => {
		const filter = { type: 'peaking', frequency: 1000, gain: 3, q: 1 } as const
		const [single] = frequencyResponse([filter], [1000])
		const [double] = frequencyResponse([filter, filter], [1000])
		expect(double).toBeCloseTo(single! * 2, 6)
	})
})

describe('logFrequencies', () => {
	it('spans the range on a log scale', () => {
		const frequencies = logFrequencies(20, 20000, 4)
		expect(frequencies.map(Math.round)).toEqual([20, 200, 2000, 20000])
	})
})
