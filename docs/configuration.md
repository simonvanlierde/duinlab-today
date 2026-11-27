# Configure your own daily page

Edit `site.toml` to choose your page's location, units, picture sources and games.
The default is The Hague. TOML is the only supported format.
All settings appear in the built website. Keep API keys out of this file.

## Start with a city

Copy an example to `site.toml`:

```sh
cp examples/utrecht.toml site.toml
```

`examples/evanston.toml` describes Evanston, Illinois, with the `America/Chicago` time zone and Fahrenheit display.
Both examples omit Hague events, tides and sea conditions. Utrecht enables Buienradar; Evanston uses Open-Meteo rain forecasts.
Replace the example `site.url` with the HTTPS origin where you will serve the page.

For a temporary build, select the file without replacing the default:

```sh
SITE_CONFIG=examples/utrecht.toml pnpm build
```

Configuration is read at build time. Restart the background dev server after an edit:

```sh
pnpm exec astro dev stop
just dev
```

Use `SITE_CONFIG=examples/utrecht.toml just dev` to preview that example.
The build rejects missing settings, unknown keys and unsupported values with the setting's name.

## Settings

The examples contain every required section. Keep those sections when editing a profile.

| Section | Settings |
|---|---|
| `[site]` | `title`, `url`, `description`. `url` must be an HTTPS origin without a path, query or fragment; a trailing slash is removed. |
| `[location]` | `name`, `latitude`, `longitude`, `timezone`, `country`. Use an IANA time zone such as `Europe/Amsterdam`, and a two-letter uppercase country code. |
| `[units]` | `temperature`: `celsius` or `fahrenheit`; `wind`: `kmh` or `mph`. |
| `[content]` | `pictures`, `tides`, `sea`, `events`, `radar`, `holidays`; see the source limits below. |
| `[[games]]` | One table per game, with `id`, `name`, `url` and `blurb`. Game URLs must use HTTPS. |

Latitude must fall between −55° and 55°. The sky calculations require daily dawn and dusk throughout the year.
Longitude must fall between −180° and 180°. The page and its sourced facts remain in English.
The location controls the calendar day, clock, weather, sun, moon, planets and sky events.
Changing the location or content settings starts a separate cache of daily content.
Changing the title, description, URL, units or games does not regenerate the day's quiz.
Browser progress stays on its original origin; changing domains does not transfer it.

### Pictures and local sources

Set `content.pictures` to any subset of these sources, in your preferred order:

| Source | Pictures |
|---|---|
| `apod` | NASA's Astronomy Picture of the Day |
| `met` | Public-domain highlights from The Metropolitan Museum of Art |
| `wikipedia` | Wikipedia's picture of the day |
| `aic` | Public-domain works from the Art Institute of Chicago (its API blocks Cloudflare's network, so it fails on the live site) |
| `rijks` | Public-domain paintings from the Rijksmuseum |
| `cleveland` | CC0 paintings from the Cleveland Museum of Art |
| `smk` | Public-domain paintings from SMK, the National Gallery of Denmark |
| `wellcome` | Openly licensed images from the Wellcome Collection, limited to the subjects you choose |

Use `pictures = []` to omit the picture strip.
Each source picks one picture a day, the same for every visitor. A source skips a work much wider or taller than 3:1,
and the strip shows an image only once when two sources return it.

The Wellcome Collection is mostly medical history. Its pictures come only from the subjects in
`[content.wellcome]`, as the collection's catalogue names them; without that table they come from botany,
plants, birds and animals:

```toml
[content.wellcome]
subjects = ["Botany", "Plants", "Birds"]
```

To add a source of your own, see [Adding a source](adding-a-source.md).
`apod` is NASA's **Astronomy Picture of the Day**. It needs the `NASA_API_KEY` secret, even when the official APOD feed supplies the image.
A source that fails is omitted while the other sources continue.

`tides`, `sea` and `events` are boolean settings. Their current adapters describe Scheveningen and The Hague.
They can be enabled only at the default Hague coordinates, country and time zone.
A different city must set all three to `false`; the page then omits those sections.
There is no generic local agenda or tide-station setting.

`radar` accepts:

- `knmi`: the Hague-only KV nowcast feed, with Buienradar and Open-Meteo as fallbacks. It requires a separate job that writes `rain/v1`.
- `buienradar`: rain radar for coordinates in the Netherlands, with Open-Meteo as a fallback.
- `none`: Open-Meteo rain forecasts, without a separate radar feed.

All profiles use Open-Meteo for the weather at their configured coordinates.
`holidays` accepts `nl` for Dutch holidays when `country = "NL"`, or `none` to omit holidays.
These settings use the built-in sources. Custom feed URLs are not supported.

### KV feeds

Two outside jobs write JSON to the `DAYS` KV namespace. The Worker checks each one and drops what doesn't fit.

`rain/v1` is the KNMI nowcast, read when `radar = "knmi"`:

```json
{ "issuedAt": "2026-11-26T09:40:00Z", "steps": [{ "time": "09:45", "mm": 0.2 }] }
```

- `issuedAt` is an ISO 8601 time. A feed more than 45 minutes old, or more than 5 minutes in the future, is ignored.
- Each `time` is `HH:MM` on the configured city's clock and marks the start of a 5-minute step.
- Each `mm` is a number of 0 or more. A single missing or malformed step drops the whole feed, so missing radar never shows as dry.

A dropped feed falls back to Buienradar, then Open-Meteo, without a log line.

`agenda/v1` holds events, read when `events = true`:

```json
{ "items": [{ "venue": "Amare", "name": "A concert", "url": "https://example.org/a", "start": "2026-11-28", "time": "20:15", "end": null }] }
```

`start` is `YYYY-MM-DD` and `time` is `HH:MM` or `null`, both local. `url` must be https. Items outside the coming week, or with a missing field, are skipped one by one.

### Games

Keep a game's `id` when changing its display name, description or URL. Browser progress uses that identifier.
Use unique lowercase IDs containing letters, digits or hyphens, starting with a letter. Reserved object names such as `constructor` are rejected.
Games appear alphabetically by name. To omit games, remove all `[[games]]` tables and put `games = []` before the first section.

```toml
[[games]]
id = "wordle"
name = "Wordle"
url = "https://www.nytimes.com/games/wordle/index.html"
blurb = "Five letters, six tries."
```

## Deploy a fork

Use your own Cloudflare account, Worker and storage. Before any deployment or secret command, edit `wrangler.jsonc`:

1. Replace `name` with a unique Worker name, such as `utrecht-daily-page`.

2. Remove the original `routes` entry. Keep `workers_dev: true` for the first deployment.

3. Create a KV namespace in your account:

   ```sh
   pnpm exec wrangler kv namespace create DAYS
   ```

   Replace the `DAYS` namespace `id` in `wrangler.jsonc` with the returned ID.

4. Keep the `DAY_COORDINATOR` binding and `v1` SQLite migration. The first deployment creates that Worker’s Durable Objects.

Do not reuse the original Worker name, KV namespace or domain route.
Editing the TOML file does not create Cloudflare resources or change account settings.

Set `site.url` to your intended HTTPS origin. For a first deployment, use your Worker’s `workers.dev` origin.
If you later add a custom domain, set the matching route in your own account and update `site.url` before rebuilding.

Build and deploy your edited `site.toml`:

```sh
pnpm deploy
```

To use a separate profile, edit that file's settings and `site.url` first, then select it explicitly:

```sh
SITE_CONFIG=examples/utrecht.toml pnpm deploy
```

Both commands build the selected configuration before deploying it.
If you run `wrangler deploy` separately, it uses the existing build; it does not reread the TOML file.

For local NASA images, put `NASA_API_KEY=<your key>` in the ignored `.dev.vars` file.
After the first deployment creates your Worker, store its production key as a secret:

```sh
pnpm exec wrangler secret put NASA_API_KEY
```

The other picture sources work without this key. Never put a key in TOML or commit `.dev.vars`.
The next retry can add APOD to an incomplete day after you add the key.

For automatic deployment from a fork, configure its own Cloudflare credentials and production environment.
The `production` job in `.github/workflows/ts.yml` reads `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
and `NASA_API_KEY` from the `production` environment, which `just repo-settings` creates for `main` only.
Pull request previews read `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the `preview`
environment; without them, previews skip with a notice (README, "Pull request previews").
Commit your chosen profile as `site.toml`, or set `SITE_CONFIG` for the workflow’s build step.
Review the original workflow’s environment URL before enabling it.

## Verify the deployment

Open the page and `/today.json` on your deployed origin.
Check the title, local clock and calendar date. Confirm the weather location and displayed units.
For Utrecht or Evanston, confirm that no Hague agenda, Scheveningen tide times or sea conditions appear.
With JavaScript disabled, the page should still show the same local content.

The JSON API keeps metric weather fields, including Celsius and km/h, even when the page displays Fahrenheit or mph.
Its `date` and bare rain clocks use the configured time zone. Sun timestamps carry that zone’s UTC offset.
See the [data contract](../README.md#data) for the remaining fields.

The social image remains a static file. Edit `docs/og-card.html` for your title and location, then render `public/og.png` with `just og-card`.
