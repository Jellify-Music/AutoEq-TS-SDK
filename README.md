# AutoEq-TS-SDK

[AutoEq](https://github.com/jaakkopasanen/AutoEq) headphone correction profiles for TypeScript.

- A catalog of every headphone in AutoEq's results (6,000+ models, 8,800+ measurements)
- Fuzzy matching of Bluetooth and system audio device names to headphones
- Profile loading, from `api.jellify.app` by default or from the files in the package
- Conversion of any profile to gains and a preamp for a graphic equalizer with any band layout

It's plain TypeScript with no dependencies, so it runs in React Native, browsers, Node.js and Bun.

## Install

```sh
bun add @jellify-music/autoeq-ts-sdk
```

## Usage

```ts
import {
	getProfile,
	matchHeadphone,
	searchHeadphones,
	toBandGains,
} from '@jellify-music/autoeq-ts-sdk'

// Match an output device's name, e.g. from a Bluetooth route change
const match = matchHeadphone('LE_WH-1000XM4')
// → { headphone: { name: 'Sony WH-1000XM4', recommended: { id: 'oratory1990/over-ear/sony-wh-1000xm4', ... }, ... }, score: 1 }

// Or let the user pick, for wired outputs that report a generic name
const results = searchHeadphones('hd650')

// Fetch the recommended profile and fit it to your equalizer's bands
const profile = await getProfile(match.headphone.recommended)
const { preamp, gains } = toBandGains(
	profile,
	[31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
)
// → { preamp: -5.8, gains: [-4.3, -1.8, -5.8, -1.4, 0.5, -0.6, 6, -0.8, 1, -2.2], method: 'fixedBand' }
```

Apply `preamp` as a volume reduction, e.g. `10 ** (preamp / 20)` as a linear gain, so boosted bands don't clip.

### Matching device names

`matchHeadphone` handles the usual differences between device names and product names: a missing brand (`WH-1000XM4`), an owner prefix (`Violet's AirPods Pro`), different spacing (`Galaxy Buds2 Pro`) and extra words like `LE_` or `Stereo`. It returns `null` when no headphone scores at least `minScore` (0.8 by default), and always for generic names like `Headphones` or `USB Audio`. Use `rankHeadphones` to get the closest candidates, for example to suggest a match in a picker.

### Band layouts

When the bands match AutoEq's own 10-band layout (`FIXED_BAND_FREQUENCIES`, Q `1.41`, within a tenth of an octave), `toBandGains` returns AutoEq's fixed-band gains. Otherwise it fits peaking-filter gains to the profile's parametric EQ by least squares. Pass `minGain` and `maxGain` for your equalizer's range; the preamp is recomputed when gains are clamped.

```ts
toBandGains(profile, [{ frequency: 60, q: 0.8 }, { frequency: 230, q: 0.8 }, ...], { minGain: -6, maxGain: 6 })
```

The parametric EQ is available as `profile.parametric` for equalizers that support arbitrary filters, and `formatAutoEqText` writes it in the format Equalizer APO and many other equalizers import.

### Loading profiles

The catalog is bundled, but profiles aren't, to keep bundles small. `getProfile` fetches them from `https://api.jellify.app/v1/autoeq/profiles/`, which serves the profiles from every published version of this package. Cache them if you need them offline. Pass `baseUrl` to host them yourself, or `fetch` to use your own implementation.

In Node.js or Bun, you can read the files straight from the installed package:

```ts
import { readFile } from 'node:fs/promises'
import { fromProfileJson, profilePath } from '@jellify-music/autoeq-ts-sdk'

const url = import.meta.resolve(`@jellify-music/autoeq-ts-sdk/${profilePath(id)}`)
const profile = fromProfileJson(id, JSON.parse(await readFile(new URL(url), 'utf8')))
```

## API

| Export                                           | Description                                          |
| ------------------------------------------------ | ---------------------------------------------------- |
| `getHeadphones()`                                | Every headphone, sorted by name                      |
| `getHeadphone(name)`                             | A headphone by exact name, ignoring case             |
| `getProfileEntries()` / `getProfileEntry(id)`    | Every measurement, or one by ID                      |
| `searchHeadphones(query, options?)`              | Search by name for a picker                          |
| `matchHeadphone(deviceName, options?)`           | The headphone matching a device name, or `null`      |
| `rankHeadphones(deviceName, options?)`           | The closest headphones to a device name, with scores |
| `getProfile(idOrEntry, options?)`                | Fetch a profile's EQ settings                        |
| `toBandGains(profile, bands, options?)`          | Gains and preamp for a graphic EQ                    |
| `computePreamp(filters, sampleRate?)`            | The preamp that keeps filters from clipping          |
| `frequencyResponse(filters, frequencies, ...)`   | A set of filters' response in dB                     |
| `parseAutoEqText(text)` / `formatAutoEqText(eq)` | Read and write AutoEq's / Equalizer APO's format     |
| `AUTOEQ_COMMIT` / `AUTOEQ_DATE`                  | The AutoEq commit the data was generated from        |

## Data

The catalog (`src/data/catalog.ts`) and profiles (`profiles/`) are generated from AutoEq's [results](https://github.com/jaakkopasanen/AutoEq/tree/master/results). A weekly workflow regenerates them and opens a pull request when AutoEq's results change. The publish workflow uploads the profiles to the R2 bucket behind [`api.jellify.app`](https://github.com/Jellify-Music/API-Gateway) before publishing to npm. It needs the `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID` and `NPM_TOKEN` secrets.

```sh
bun run generate                    # clones AutoEq's results into a temporary directory
bun run generate --autoeq ../AutoEq # or uses an existing checkout
```

Profile IDs are `<source>/<rig directory>/<name>`, slugified, e.g. `crinacle/gras-43ag-7-over-ear/sennheiser-hd-600`.

## Development

```sh
bun install
bun test
bun run typecheck
bun run build
```

## Credits

All profiles come from [AutoEq](https://github.com/jaakkopasanen/AutoEq) by Jaakko Pasanen, MIT licensed (see [`LICENSE-AutoEq`](./LICENSE-AutoEq)). The measurements behind them are by oratory1990, crinacle, Innerfidelity, Rtings and the other sources each profile's `source` names. Please credit the source when showing a profile.

## License

MIT
