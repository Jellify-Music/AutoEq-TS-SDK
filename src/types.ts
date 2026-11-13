/**
 * The form factor of a headphone, taken from how AutoEq groups its measurements.
 */
export type FormFactor = 'in-ear' | 'over-ear' | 'earbud'

/**
 * A biquad filter type used by AutoEq's parametric profiles.
 *
 * AutoEq writes these as `PK`, `LSC` and `HSC`.
 */
export type FilterType = 'peaking' | 'lowShelf' | 'highShelf'

/**
 * A single biquad filter.
 */
export interface Filter {
	type: FilterType
	/** Center or corner frequency in Hz */
	frequency: number
	/** Gain in dB */
	gain: number
	q: number
}

/**
 * A parametric EQ: a preamp and a set of filters.
 */
export interface ParametricEq {
	/** Gain in dB to apply before the filters so boosted frequencies don't clip */
	preamp: number
	filters: Filter[]
}

/**
 * One measurement of a headphone, and the EQ profile AutoEq computed from it.
 */
export interface ProfileEntry {
	/**
	 * Stable identifier, e.g. `oratory1990/over-ear/sennheiser-hd-650`.
	 *
	 * Also the path of the profile's JSON file under `profiles/`.
	 */
	id: string
	/** Headphone name as AutoEq lists it, e.g. `Sennheiser HD 650` */
	name: string
	/** Who measured the headphone, e.g. `oratory1990` or `crinacle` */
	source: string
	/** The measurement rig, when the source uses more than one */
	rig: string | null
	formFactor: FormFactor
	/** Whether AutoEq recommends this measurement over the others for this headphone */
	recommended: boolean
}

/**
 * A headphone model and every profile available for it.
 */
export interface Headphone {
	name: string
	formFactor: FormFactor
	/** The profile AutoEq recommends for this headphone */
	recommended: ProfileEntry
	/** Every profile for this headphone, recommended first */
	profiles: ProfileEntry[]
}

/**
 * The EQ settings for a headphone.
 */
export interface Profile {
	id: string
	/** AutoEq's parametric EQ, usually 10 filters */
	parametric: ParametricEq
	/**
	 * AutoEq's 10-band graphic EQ, using peaking filters with a Q of
	 * {@link FIXED_BAND_Q} at {@link FIXED_BAND_FREQUENCIES}.
	 */
	fixedBand: ParametricEq
}

/**
 * A band of a graphic equalizer.
 */
export interface EqBand {
	/** Center frequency in Hz */
	frequency: number
	/** Defaults to {@link FIXED_BAND_Q} */
	q?: number
}

/**
 * Gains for a graphic equalizer, from {@link toBandGains}.
 */
export interface BandGains {
	/** Gain in dB to apply before the bands so boosted frequencies don't clip. Always ≤ 0. */
	preamp: number
	/** Gain in dB for each band, in the order the bands were given */
	gains: number[]
	/**
	 * `fixedBand` when the bands matched AutoEq's own 10-band layout and its
	 * gains were used directly, `fitted` when the gains were fitted from the
	 * parametric EQ.
	 */
	method: 'fixedBand' | 'fitted'
}
