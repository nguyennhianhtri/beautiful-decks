# Template reference

The examples are the safest source of truth. This page lists the common field contracts; advanced templates live in `engine/build.js` and `engine/build-wide.js`.

## Deck-level fields

```js
module.exports = {
  format: 'standard',       // 'standard' | 'ultrawide'
  title: 'Browser title',
  foot: 'Default footer',
  motion: true,             // optional; navigation works with or without motion
  theme: 'dark',            // optional on standard decks
  brand: { accent: '#7C3AED', accent2: '#06B6D4' }, // optional ultrawide tint
  customer: { logoSvg: '<svg>...</svg>', plate: true }, // optional approved logo
  slides: []
};
```

Builders validate template names, required arrays, CSS colors, key ultrawide cardinalities, finite chart points, sentiment ranges, and swimlane grid bounds before rendering. They do not mutate the imported spec.

Ultrawide currently supports the dark theme only. `theme: 'light'` fails fast instead of producing unreadable white-on-white v2 components.

Asset slugs accept letters, digits, `_`, and `-`; explicit image extensions are preserved. Source links allow `http:`, `https:`, `mailto:`, fragments, and relative paths. Deck specs are executable JavaScript and must still be trusted.

## Standard 16:9 templates

| Type | Required fields | Useful optional fields |
|---|---|---|
| `cover` | `title` | `img`, `eyebrow`, `badge`, `subtitle`, `meta[]` |
| `agenda` | `title`, `items[{n,t}]` | item `d`, `active`; `kicker` |
| `section` | `num`, `title` | `img`, `eyebrow`, `subtitle` |
| `content` | `title`, `bullets[]` | `kicker`, `subtitle`, `insight` |
| `split` | `title`, `img` | `body`, `bullets[]`, `insight`, `wide` |
| `cards3` | `title`, `cards[{icon,title,body}]` | card `num`, `foot`, `gold` |
| `quad` | `title`, `cards[{icon,title,body,color}]` | card `pill` |
| `features` | `title`, `rows[{icon,h,b}]` | row `idx`, `gold`; `cols:2` |
| `metrics` | `title`, `stats[{n,l}]` | `img`, `kicker`, `subtitle` |
| `phases` | `title`, `steps[{t,b}]` | step `state`; `insight` |
| `timeline` | `title`, `body`, `items[{when,t,b}]` | `insight`, `kicker` |
| `compare` | `title`, `rows[{dim,from,to}]` | `fromLabel`, `toLabel`, row `icon`, `insight` |
| `usecases` | `title`, `rows[{uc,pain,gain}]` | `subtitle`, `tight`, `insight` |
| `spotlight` | `title`, `img`, `body`, `stats[{n,l}]` | `tag`, `wide`, `kicker` |
| `statement` | `title` | `img`, `eyebrow`, `subtitle` |
| `closing` | `title`, `steps[{k,v}]` | `img`, `eyebrow` |
| `big` | `figure` | `line`, `img`, `tone`, `align`, `kicker` |
| `punch` | `title` | `dark`, `img`, `eyebrow`, `tag` |
| `webexhibit` | `img` | `title`, `caption`, `src`, `plate`, `fit`, `dark` |

Advanced standard types: `archgrid`, `placeholder`, `product`.

Standard text fields accept trusted inline HTML for emphasis. Do not insert untrusted text without escaping it.

## Ultrawide 48:9 templates

| Type | Required fields | Useful optional fields |
|---|---|---|
| `wcover` | `title` | `eyebrow`, `subtitle`, `meta[]` |
| `wcurtain` | `title` | `eyebrow`, `subtitle` |
| `wflap` | `word` | `eyebrow`, `caption` |
| `wspotlight` | `title`, `items[{n,t,b}]` | item `icon`; `kicker` |
| `whorizon` | `title` | `eyebrow`, `attribution` |
| `wunfold` | `title`, `acts[{n,t,b}]` | act `foot`, `dark`; `kicker` |
| `wjourney` | `title`, `stations[]` | `kicker`, `subtitle`, station emotion/assist fields |
| `wribbon` | `title`, `kpis[{l,n}]` | KPI `spark[]`, `delta`, `tone`; `kicker` |
| `wtimeline` | template-specific timeline fields | inspect implementation before use |
| `wstatement` | `title` | `eyebrow`, `subtitle` |

Advanced ultrawide types: `wbigtri`, `wbrandcover`, `wchain`, `wconstel`, `wday`, `wdolly`, `wfilmstrip`, `wforces`, `wgutpunch`, `whub`, `wiris`, `wleak`, `wpersona`, `wpitchcanvas`, `wramp`, `wriver`, `wroad`, `wsection`, `wshots`, `wshutter`, `wstair`, `wswim`, `wtript`, `wtypewriter`, `wzipper`.

Ultrawide fields are escaped as plain text. Use the panorama for sequence and spatial relationships rather than HTML formatting.

## Bundled icons

`bank`, `bot`, `brain`, `code`, `database`, `docdata`, `flowchart`, `globe`, `image_add`, `layer`, `people`, `product`, `rocket`, `shield`, `shieldcheck`, `slide_layout`, `sparkle`, `trending`, `window`.

## Bundled image keys

`building`, `office`, `datacenter`, `meeting`, `globe`, `advisory`, `fintech`, `analytics`, `manila`, `laptop`.

These resolve to original local SVG backgrounds and are safe for the strict portable exporter.
