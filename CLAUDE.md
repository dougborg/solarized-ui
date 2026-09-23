# CLAUDE.md

Framework-free Solarized design system published as `@dougborg/solarized-ui`.
The [README](README.md) is the adoption guide, API contract, and versioning policy.

## Commands

Use the pinned Node (`.nvmrc`) and pnpm (`packageManager`); run from the repo root.

```sh
pnpm install --frozen-lockfile
pnpm build          # dist/ and site/ (both ignored by git)
pnpm check          # Biome, rumdl, tsc, Knip, node --test
pnpm test:browser   # Playwright + axe on the built reference page, port 4174
```

Run `actionlint` after editing workflows.

## Invariants

- Color tokens use only the 16 exact Solarized sRGB values; never mix them or apply opacity.
- The only derived colors are the `--tint-*` tokens: `oklch(from var(--solarized-*) L C h)` keeps the source hue and changes only lightness and chroma, text on them must pass axe AA in both themes, and a bundle test enforces the form.
- The API is token names, class names, `data-accent` values, `dist/` paths, and the theme-control markup; a change to any of them is `feat!`.
- Every font ships with its license; keep `THIRD_PARTY_NOTICES.md` current.
- Status and meaning never rely on color alone; keep focus visible and controls at least 44px.
- The page must work without `theme.js`.
- Biome cognitive complexity stays at most 15 per function.
- Write one sentence per line in Markdown.
- Conventional Commits with lowercase subjects; release-please derives versions and the changelog from them.
- Never publish to npm by hand after the first release; `.github/workflows/release.yml` is the stage-only trusted publisher, and the owner approves each staged version with 2FA.

## Consumers

[resume.dougborg.org](https://github.com/dougborg/resume) is the first consumer, and it checks that its built files match byte for byte.
A change here reaches it only through a version bump, so inspect the résumé in both themes when updating it.
