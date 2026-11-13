import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
	getHeadphone,
	getHeadphones,
	getProfileEntries,
	getProfileEntry,
	parseRigDirectory,
	profileId,
	profilePath,
} from '../src/index.js'

describe('catalog', () => {
	it('has a unique ID for every profile', () => {
		const entries = getProfileEntries()
		expect(entries.length).toBeGreaterThan(0)
		expect(new Set(entries.map(({ id }) => id)).size).toBe(entries.length)
	})

	it('has a profile file for every entry', () => {
		const missing = getProfileEntries().filter(
			({ id }) => !existsSync(join(import.meta.dir, '..', profilePath(id))),
		)
		expect(missing).toEqual([])
	})

	it('recommends exactly one profile per headphone, listed first', () => {
		for (const headphone of getHeadphones()) {
			expect(headphone.profiles.filter(({ recommended }) => recommended)).toHaveLength(1)
			expect(headphone.profiles[0]).toBe(headphone.recommended)
		}
	})

	it('looks up profiles and headphones', () => {
		const entry = getProfileEntry('oratory1990/over-ear/sennheiser-hd-650')

		expect(entry).toEqual({
			id: 'oratory1990/over-ear/sennheiser-hd-650',
			name: 'Sennheiser HD 650',
			source: 'oratory1990',
			rig: null,
			formFactor: 'over-ear',
			recommended: true,
		})
		expect(getHeadphone('sennheiser hd 650')?.recommended).toBe(entry!)
		expect(getHeadphone('Not A Headphone')).toBeUndefined()
	})
})

describe('parseRigDirectory', () => {
	it('splits the rig and form factor', () => {
		expect(parseRigDirectory('GRAS 43AG-7 over-ear')).toEqual({
			rig: 'GRAS 43AG-7',
			formFactor: 'over-ear',
		})
		expect(parseRigDirectory('in-ear')).toEqual({ rig: null, formFactor: 'in-ear' })
	})

	it('throws on unknown form factors', () => {
		expect(() => parseRigDirectory('711 on-ear')).toThrow()
	})
})

describe('profileId', () => {
	it('slugifies each part', () => {
		expect(profileId('crinacle', 'EARS + 711 over-ear', 'Beyerdynamic DT 770 Pro (80 Ω)')).toBe(
			'crinacle/ears-plus-711-over-ear/beyerdynamic-dt-770-pro-80',
		)
	})
})
