import { ENTRIES, RIGS, SOURCES } from './data/catalog.js'
import { slugify } from './text.js'
import type { FormFactor, Headphone, ProfileEntry } from './types.js'

const FORM_FACTORS: readonly FormFactor[] = ['in-ear', 'over-ear', 'earbud']

/**
 * Splits one of AutoEq's rig directory names into the rig and form factor,
 * e.g. `GRAS 43AG-7 over-ear` → `{ rig: 'GRAS 43AG-7', formFactor: 'over-ear' }`.
 *
 * @throws If the directory doesn't end in a known form factor
 */
export function parseRigDirectory(directory: string): {
	rig: string | null
	formFactor: FormFactor
} {
	const formFactor = FORM_FACTORS.find(
		(form) => directory === form || directory.endsWith(` ${form}`),
	)
	if (!formFactor) throw new Error(`Unknown form factor in rig directory: ${directory}`)

	const rig = directory.slice(0, -formFactor.length).trim()
	return { rig: rig.length > 0 ? rig : null, formFactor }
}

/**
 * Builds a profile's ID from where AutoEq stores it:
 * `results/<source>/<rig directory>/<name>`.
 */
export function profileId(source: string, rigDirectory: string, name: string): string {
	return [source, rigDirectory, name].map(slugify).join('/')
}

let profileEntries: ProfileEntry[] | undefined
let profileEntriesById: Map<string, ProfileEntry> | undefined
let headphones: Headphone[] | undefined
let headphonesByName: Map<string, Headphone> | undefined

/**
 * Every profile in the catalog, in AutoEq's index order.
 */
export function getProfileEntries(): readonly ProfileEntry[] {
	profileEntries ??= ENTRIES.map(([name, sourceIndex, rigIndex, recommended]) => {
		const source = SOURCES[sourceIndex]!
		const rigDirectory = RIGS[rigIndex]!

		return {
			id: profileId(source, rigDirectory, name),
			name,
			source,
			...parseRigDirectory(rigDirectory),
			recommended: recommended === 1,
		}
	})

	return profileEntries
}

/**
 * Looks up a profile by its ID.
 */
export function getProfileEntry(id: string): ProfileEntry | undefined {
	profileEntriesById ??= new Map(getProfileEntries().map((entry) => [entry.id, entry]))
	return profileEntriesById.get(id)
}

/**
 * Every headphone in the catalog, sorted by name.
 */
export function getHeadphones(): readonly Headphone[] {
	if (headphones) return headphones

	const grouped = new Map<string, ProfileEntry[]>()
	for (const entry of getProfileEntries()) {
		const group = grouped.get(entry.name)
		if (group) group.push(entry)
		else grouped.set(entry.name, [entry])
	}

	headphones = [...grouped].map(([name, entries]) => {
		const recommended = entries.find((entry) => entry.recommended) ?? entries[0]!
		return {
			name,
			formFactor: recommended.formFactor,
			recommended,
			profiles: [recommended, ...entries.filter((entry) => entry !== recommended)],
		}
	})
	headphones.sort((a, b) => a.name.localeCompare(b.name))

	return headphones
}

/**
 * Looks up a headphone by its exact name, ignoring case.
 */
export function getHeadphone(name: string): Headphone | undefined {
	headphonesByName ??= new Map(
		getHeadphones().map((headphone) => [headphone.name.toLowerCase(), headphone]),
	)
	return headphonesByName.get(name.toLowerCase())
}
