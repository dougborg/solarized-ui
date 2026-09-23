# solarized-ui

A small, framework-free design system built on the exact [Solarized](https://ethanschoonover.com/solarized/) palette: semantic tokens, mixed IBM Plex Sans and JetBrains Mono Nerd Font typography, a few content components, and an optional light/dark theme control.
It serves personal sites and internal tools, and started as the foundation of [resume.dougborg.org](https://resume.dougborg.org/).

See the [reference page](https://dougborg.org/solarized-ui/) for every component in both themes.

## Install

```sh
pnpm add @dougborg/solarized-ui
```

The package contains only built files:

| Path | Contents |
| --- | --- |
| `dist/solarized-ui.css` | Fonts, tokens, base typography, and components in one stylesheet |
| `dist/fonts/` | WOFF2 files and their licenses, referenced relative to the stylesheet |
| `dist/theme.js` | Optional native module for the theme control |
| `dist/theme-control.html` | Markup for the theme control |

Serve the stylesheet with `fonts/` beside it; its font URLs are relative, so the bundle also works under a subdirectory.
With a bundler, `import "@dougborg/solarized-ui"` resolves to the stylesheet, and the fonts resolve through the same relative URLs.
Without one, copy `node_modules/@dougborg/solarized-ui/dist/` into your public assets directory as part of your build.
Do not hotlink assets from another deployment.

Start with this document structure:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>Your page</title>
  <link rel="stylesheet" href="assets/solarized-ui.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to main content</a>
  <main id="main" tabindex="-1">
    <h1>Your page</h1>
    <section class="content-section" data-accent="violet">
      <h2 class="section-title">Projects</h2>
      <article class="surface">Your content</article>
    </section>
  </main>
</body>
</html>
```

Add page-specific layout CSS after the stylesheet.
The foundation supplies typography and components, not a fixed page grid.

### Theme control

Paste `dist/theme-control.html` before `</body>`.
Its script tag loads `assets/theme.js`; adjust that path to wherever you serve the module.
The control defaults to Auto on each page load, follows the system, and cycles Auto → Light → Dark.
Selection is not persisted.
Without JavaScript, system colors still work; browsers without `light-dark()` receive the light fallback and no unusable control.
Reserve `var(--control-gutter)` at the right and at least 60px at the bottom so the floating control cannot cover content.

## Tokens and components

| Contract | Purpose |
| --- | --- |
| `--paper`, `--rail`, `--ink`, `--ink-2`, `--ink-3` | Page, raised surface, and text roles |
| `--accent`, `--accent-ink`, `--rule` | Controls, hover/focus, and separators |
| `--solarized-*` | The exact 16 official Solarized sRGB values |
| `--tone-{blue,cyan,green,yellow,orange,red,magenta,violet}` | Unmodified accent aliases, identical in light and dark |
| `--tint-{accent}`, `--section-tint` | Quiet surfaces derived from each accent's hue; `data-accent` sets `--section-tint`, which only `.surface[data-tint]` and `.card` paint |
| `--accent-band` | Six-accent hard-stop gradient (blue, cyan, green, yellow, orange, magenta) |
| `--sans`, `--mono`, `--text-*`, `--leading`, `--measure` | Mixed typography and 68ch reading measure |
| `--space-*`, `--radius`, `--radius-lg` | Shared spacing scale, 4px corners, and 12px panel corners |
| `--panel`, `--panel-ink`, `--panel-border`, `--panel-divider` | Quiet panel surface, text, edge, and row dividers |
| `--shadow-color`, `--elevation` | A faint two-layer shadow in light themes; transparent in dark themes and without relative color |
| `.content-section`, `.section-title`, `data-accent` | Accent scope and lowercase section heading |
| `.surface`, `--card-padding` | Borderless grouped content with optional padding override |
| `.surface[data-tint]` | A surface tinted from its `data-accent` |
| `.entry-heading`, `.entry-title`, `.meta` | Wrapping title/metadata row |
| `.text-list`, `.supporting-details` | Accomplishments and one nested detail level |
| `.facts` | Semantic `dl` category/value pairs |
| `.stack`, `.cluster` | Vertical and wrapping horizontal composition |
| `.action`, `.status` | Outlined link/action and explicit textual status |
| `.nerd-icon`, `.section-icon` | Decorative glyphs alongside visible text |
| `.page-column` | Single reading column with the control gutter reserved; top-level blocks in its `main` are spaced apart |
| `.masthead`, `.masthead-title`, `.site-nav` | Site title and primary navigation; mark the current page with `aria-current="page"`; these links drop the resting underline because they sit apart from body text, and underline on hover |
| `.article-header` | An article's `h1` and `.meta` line above its body |
| `.post-list` | A list of posts built from `.entry-heading`, `.entry-title`, `.meta`, and an optional summary |
| `.page-footer` | Small, ruled site footer |
| `.masthead--band`, `.masthead-title--identity` | A masthead ruled by the accent band, and a bold blue identity name |
| `.accent-band` | The accent band as a standalone 4px rule, such as an `hr` |
| `.meta-row` | Inline metadata items separated by space, not punctuation |
| `.timeline-list`, `.timeline-list--marked`, `.timeline-marker` | An ordered list with a rail and a marker per item in its `data-accent`; the marked variant holds initials or a logo |
| `.card-grid`, `.card` | Tinted cards with an accent edge in a grid that reflows to one column; `--card-min` sets the column width |
| `.chip-list`, `.chip` | Static tags, optionally with a leading `.nerd-icon` |
| `.pager` | Older and newer links (`rel="prev"`, `rel="next"`) at the end of a page |
| `.read-progress` | A CSS-only reading bar fixed to the top; hidden without scroll timelines, under reduced motion, and in print |
| `.panel`, `.panel-title`, `.panel-description` | A bordered, softly raised group with a title and a muted line |
| `.panel-rows` | Put on a panel `ul`/`ol`, or on a panel wrapping a `table`: rows with dividers, title on the start side and a value or status on the end side |
| `li` or `tr` with `data-state` or `data-accent` inside `.panel-rows` | A marked row: the state's or accent's tint, a 4px leading edge that curves with the panel's corners (a head or caption counts as hidden only with `.visually-hidden`), and card ink for text; a `.status--pill` inside sits on the plain panel with a ring of its color |
| `.status[data-state]` | `ok`, `warn`, `down`, or `info`: a round dot in green, yellow, red, or blue beside the label, which stays in ink |
| `.status--pill` | A status on its tint, for standalone badges |
| `.callout`, `.callout-icon`, `.callout-title` | An icon badge beside a headline and sentence, toned by `data-state` (`ok`, `warn`, or `down`; without one it uses the blue accent, which also serves as info); combine with `.panel`, and add `role="status"` when it updates live |
| `.callout--tinted` | The callout fills with its state's tint and takes the same leading edge as a marked row; the icon gets a ring |
| `.section-label` | A small, muted, sans-serif heading for a group of panels, quieter than `.section-title` |
| `.numeric` | Tabular figures that never wrap, for latencies, counts, and dates |
| `.table--stack` | A table that becomes labelled rows below 560px, using each cell's `data-label`; give it explicit ARIA table roles, since stacking hides its table semantics in some browsers, as `reference/status.html` does |
| `.masthead--plain` | A masthead without its rule |
| `.visually-hidden` | Hidden visually but kept for assistive technology, such as a table's header row |
| `.prose` | Long-form writing: headings, lists, quotes, wrapped code blocks, tables, figures, rules, and footnotes |
| `.token.*` | Prism syntax tokens, highlighted by weight and style only, never by color |

The scale is 4, 8, 12, 16, 24, 32, 44, 48px; token suffixes count 4px units.
Body text is 1rem with 1.55 leading; small/section/title sizes are 0.875/1.1875/1.75rem.
Use sans-serif for prose, titles within entries, and data; monospace for section labels, code, and controls.
Preserve proper nouns.
Use a visible label for each status: color alone must never mean success, maintenance, or failure.
Use the [official Solarized values](https://ethanschoonover.com/solarized/#the-values) for every color token, without mixing or opacity.
There are two exceptions.
The tints: each `--tint-*` keeps its accent's own hue and changes only lightness and chroma (`oklch(from var(--solarized-*) L C h)`), so it adds no new color; browsers without relative color fall back to the neutral raised surface.
The shadow: `--shadow-color` is base03 with a few percent opacity (`oklch(from var(--solarized-base03) l c h / 7%)`) in light themes and transparent in dark ones; it is the only color with transparency, and it never carries text.
Accents belong on decorative glyphs, rules, swatches, and markers.
Small text and links use Solarized neutrals; underlines identify links.
Status text has a colored marker, so the exact red does not have to meet text contrast on a dark surface.
State labels stay in ink because Solarized green and yellow fall below 4.5:1 as small text on the light background; the dot repeats the state in color.
Plain surfaces use the exact secondary background; tinted cards keep the card text color, which meets AA on every tint in both themes.
Stable hue tokens retain their values across themes.

Use native headings, lists, links, and buttons.
`.text-list` keeps native numbering on ordered lists; chevrons and nested dots apply only to unordered lists.
Decorative glyphs need `aria-hidden="true"`; icon-only controls need an accessible name.
Examples of bundled codepoints are in [the reference page](reference/index.html).
The Nerd Font is a subset, so verify new glyphs before using them.
Keep focus visible and controls at least 44px.
This is not a complete form, navigation, or application-widget library.

See the [example article](https://dougborg.org/solarized-ui/article.html) for the site and prose components together.
For code highlighting, use a highlighter that emits Prism token classes, such as Astro's `syntaxHighlight: "prism"`; highlighters that write inline colors bypass the contrast rules above.
Class names are global and unprefixed, so check them against any other stylesheet an application loads.
The timeline is `.timeline-list`, not `.timeline`, because the résumé already uses that name.
See the [example status page](https://dougborg.org/solarized-ui/status.html) for the quiet patterns together.

## Versioning

The public API is the set of token names, class names, `data-accent` values, file paths under `dist/`, and the theme-control markup.
Releases follow [Semantic Versioning](https://semver.org/) against that API:

| Change | Commit type | Before 1.0 | From 1.0 |
| --- | --- | --- | --- |
| Remove or rename a token, class, accent, `dist/` path, or control markup | `feat!` | minor | major |
| Change what a token or class means | `feat!` | minor | major |
| Add a token, component, or icon glyph | `feat` | minor | minor |
| Adjust appearance within the same contract | `fix` | patch | patch |

Pin an exact version and review updates with your application's own screenshot and accessibility checks.
See the [changelog](CHANGELOG.md) for release notes.

## Develop

Use the pinned Node (`.nvmrc`) and pnpm (`packageManager`).

```sh
pnpm install --frozen-lockfile
pnpm build          # dist/ (package) and site/ (reference page)
pnpm check          # Biome, rumdl, tsc, Knip, unit tests
pnpm exec playwright install chromium
pnpm test:browser   # Playwright and axe against the built reference page
pnpm preview        # http://127.0.0.1:4173
```

Edit `src/css/fonts.css`, `tokens.css`, `base.css`, and `components.css`; the build concatenates them in that order.
`src/theme.ts` owns the control's behavior and `src/theme-control.html` its markup.
`reference/index.html` adds examples and its own responsive layout.
New components or palette changes need equivalent contrast, reflow, keyboard, and print coverage in `test/browser/`.
The Nerd Font is a subset; see [font provenance](fonts/README.md) before using a new glyph.

## Release

Merges to `main` use Conventional Commit titles.
The [release-please](https://github.com/googleapis/release-please) workflow keeps a release PR with the next version and changelog; merging it tags the release.
The publish job then builds, checks, and stages the version on npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers) and provenance, so the repository stores no npm token.
The trusted publisher may only stage, so a maintainer approves each version with two-factor authentication before it goes live, using `npm stage list` and `npm stage approve <stage-id>` or the Staged Packages tab on npmjs.com.
See [staged publishing](https://docs.npmjs.com/staged-publishing/).

## License

[MIT](LICENSE).
Solarized is MIT licensed by Ethan Schoonover, and the bundled fonts keep their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md).
