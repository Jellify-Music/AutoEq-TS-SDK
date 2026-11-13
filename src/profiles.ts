import { DEFAULT_PROFILE_BASE_URL } from './constants.js'
import { fromProfileJson, type ProfileJson } from './parse.js'
import type { Profile, ProfileEntry } from './types.js'

export interface GetProfileOptions {
	/**
	 * URL of the `profiles/` directory to fetch from, ending in `/`.
	 * Defaults to {@link DEFAULT_PROFILE_BASE_URL}.
	 */
	baseUrl?: string
	/** The `fetch` implementation to use. Defaults to the global `fetch`. */
	fetch?: typeof fetch
	signal?: AbortSignal
}

/**
 * The path of a profile's JSON file, relative to the package root,
 * e.g. `profiles/oratory1990/over-ear/sennheiser-hd-650.json`.
 *
 * In Node.js or Bun you can read it straight from the installed package
 * with `import.meta.resolve('@jellify-music/autoeq-ts-sdk/' + profilePath(id))`.
 */
export function profilePath(id: string): string {
	return `profiles/${id}.json`
}

/**
 * The URL a profile is fetched from.
 */
export function profileUrl(id: string, baseUrl: string = DEFAULT_PROFILE_BASE_URL): string {
	return `${baseUrl}${id}.json`
}

/**
 * Fetches a profile's EQ settings.
 *
 * Profiles aren't bundled with the code, so this fetches them from
 * {@link DEFAULT_PROFILE_BASE_URL} by default. Cache the result if you need
 * it offline.
 *
 * @param profile A profile ID or entry
 * @throws If the request fails or the response isn't a valid profile
 */
export async function getProfile(
	profile: string | ProfileEntry,
	options: GetProfileOptions = {},
): Promise<Profile> {
	const { baseUrl, fetch: fetchImpl = globalThis.fetch, signal } = options
	const id = typeof profile === 'string' ? profile : profile.id

	const response = await fetchImpl(profileUrl(id, baseUrl), { signal })
	if (!response.ok) {
		throw new Error(`Failed to fetch profile ${id}: ${response.status} ${response.statusText}`)
	}

	return fromProfileJson(id, (await response.json()) as ProfileJson)
}
