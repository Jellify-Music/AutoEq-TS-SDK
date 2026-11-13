import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fromProfileJson, profilePath, type Profile } from '../src/index.js'

/** Reads a profile from the generated `profiles/` directory. */
export function readProfile(id: string): Profile {
	const path = join(import.meta.dir, '..', profilePath(id))
	return fromProfileJson(id, JSON.parse(readFileSync(path, 'utf8')))
}
