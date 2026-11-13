import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
	DEFAULT_PROFILE_BASE_URL,
	getProfile,
	getProfileEntry,
	profilePath,
	profileUrl,
} from '../src/index.js'
import { readProfile } from './helpers.js'

const ID = 'oratory1990/over-ear/sennheiser-hd-650'

/** A fetch that serves profiles from the generated `profiles/` directory */
function createFetch(requests: string[]): typeof fetch {
	return (async (input: RequestInfo | URL) => {
		const url = input.toString()
		requests.push(url)

		const path = url.replace('https://example.com/', '')
		try {
			return new Response(readFileSync(join(import.meta.dir, '..', path)))
		} catch {
			return new Response(null, { status: 404, statusText: 'Not Found' })
		}
	}) as typeof fetch
}

describe('getProfile', () => {
	it('fetches and parses a profile by ID or entry', async () => {
		const requests: string[] = []
		const options = { baseUrl: 'https://example.com/profiles/', fetch: createFetch(requests) }

		expect(await getProfile(ID, options)).toEqual(readProfile(ID))
		expect(await getProfile(getProfileEntry(ID)!, options)).toEqual(readProfile(ID))
		expect(requests).toEqual([
			`https://example.com/profiles/${ID}.json`,
			`https://example.com/profiles/${ID}.json`,
		])
	})

	it('throws when the request fails', async () => {
		const options = { baseUrl: 'https://example.com/profiles/', fetch: createFetch([]) }
		expect(getProfile('missing/profile/id', options)).rejects.toThrow('404')
	})
})

describe('profile URLs', () => {
	it('builds the URL from the base URL', () => {
		expect(profileUrl(ID)).toBe(`https://api.jellify.app/v1/autoeq/profiles/${ID}.json`)
		expect(profileUrl(ID, 'https://example.com/')).toBe(`https://example.com/${ID}.json`)
		expect(DEFAULT_PROFILE_BASE_URL.endsWith('/')).toBe(true)
	})

	it('builds the path inside the package', () => {
		expect(profilePath(ID)).toBe(`profiles/${ID}.json`)
	})
})
