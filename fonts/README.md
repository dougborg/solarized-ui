# JetBrains Mono Nerd Font web subsets

These WOFF2 files are build inputs, copied byte-for-byte to `dist/fonts/` by `src/bundle.ts`.
Consumers serve them locally beside the stylesheet.
Normal builds need no network, Python, font patcher, or subsetting tools.

Source: [Nerd Fonts v3.5.1](https://github.com/ryanoasis/nerd-fonts/tree/v3.5.1/patched-fonts/JetBrainsMono/Ligatures), commit `b894ea7803af6aade63d60a4381e006098ec9c4d`.
Use the **Ligatures/JetBrainsMonoNerdFont** family, not the NoLigatures variant.

| Input | SHA-256 | Output |
| --- | --- | --- |
| JetBrainsMonoNerdFont-Regular.ttf | `1c680e8cde9fcf8b88a5605ce8d1fb94dd3fb15841f7ca7bf4c55664855e5611` | `jetbrains-mono-nerd-400.woff2` |
| JetBrainsMonoNerdFont-SemiBold.ttf | `d987f2994fa3000512ea6442e4b3fa8c96e0724262e2c5c9646f1ee02cae675e` | `jetbrains-mono-nerd-600.woff2` |

Subset with FontTools 4.65.0 and WOFF2 support.
Retain all layout features and names, and preserve timestamps.
For each downloaded input, the equivalent CLI is:

```sh
uvx --from 'fonttools[woff]==4.65.0' pyftsubset INPUT.ttf \
  --output-file=OUTPUT.woff2 --flavor=woff2 --no-recalc-timestamp \
  --unicodes='U+0000-024F,U+2000-206F,U+2190-21FF,U+2500-257F,U+F001,U+F015,U+F019,U+F02D,U+F08C,U+F095,U+F09B,U+F0A3,U+F0AD,U+F0B1,U+F0C1,U+F0C2,U+F0D0,U+F0E0,U+F0F4,U+F0F6,U+F108,U+F121,U+F130,U+F185,U+F186,U+F19D,U+F1C0,U+F1C1,U+F1C2,U+F1C9,U+F206,U+F233' \
  --layout-features='*' --name-IDs='*' --name-languages='*' --name-legacy
```

The subset keeps Latin text, punctuation, arrows, box drawing, contextual ligatures, and twenty-eight Font Awesome glyphs used by the theme control (desktop/auto, sun, and moon), the reference page, and the résumé that first consumed this package.
It is not the complete Nerd Fonts icon collection.
Add required codepoints before using more icons.
Both files retain GSUB layout tables and the twenty-eight icon mappings.

Add a codepoint to the `--unicodes` list above and re-subset both weights before mapping a new icon.
A link whose codepoint is absent renders as an empty icon slot rather than a visible error, so confirm a glyph is in the subset before mapping a new one.

Rebuilding does not reproduce the previous woff2 byte-for-byte: the glyph data, tables and `head.modified` match, but the woff2 container compresses differently across brotli builds.
Compare cmap coverage rather than file hashes when verifying a re-subset.

`jetbrains-mono-nerd-LICENSE` bundles the unmodified upstream JetBrains OFL, Nerd Fonts licensing notice, and `src/glyphs/font-awesome/LICENSE.txt`, including Fonticons attribution and the font/icon license terms.
Publish it with the fonts.
