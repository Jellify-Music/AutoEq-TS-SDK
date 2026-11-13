/**
 * Where {@link getProfile} fetches profiles from by default.
 *
 * Jellify's API gateway serves them from R2. The publish workflow only adds
 * or updates files there and never deletes them, so IDs from older versions
 * of this package keep resolving.
 */
export const DEFAULT_PROFILE_BASE_URL = 'https://api.jellify.app/v1/autoeq/profiles/'

/**
 * Center frequencies in Hz of AutoEq's 10-band graphic EQ profiles.
 */
export const FIXED_BAND_FREQUENCIES = [
	31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const

/**
 * The Q of each peaking filter in AutoEq's 10-band graphic EQ profiles.
 */
export const FIXED_BAND_Q = 1.41

/**
 * How far in octaves a band can be from {@link FIXED_BAND_FREQUENCIES}
 * and still use AutoEq's fixed-band gains directly. Covers equalizers that
 * label 62 Hz as 63 Hz.
 */
export const FIXED_BAND_TOLERANCE_OCTAVES = 0.1

/**
 * The sample rate AutoEq designs its filters for.
 */
export const DEFAULT_SAMPLE_RATE = 44100
