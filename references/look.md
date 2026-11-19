# The look

These are the rules every Drawing page follows. The tokens are in `src/rig/rig.css` (solids) and `src/drawing/chrome.css` (page). Change a value there, not in an example's CSS, so every page moves together. Each rule gives its reason, so you can tell when an exception is justified.

## Restraint

- **One figure, one signal colour.** The followed part is `subject` (orange, the same hue as `--orange`). Everything else is a neutral metal or a material the real object is made of. *Why:* the eye goes to the only saturated thing on the stage. Two of them split the reader's attention.
- **Leave whitespace around the figure.** Don't fill an empty stage with legends or extra labels. Details belong in the Details drawer. *Why:* a calm stage reads as precise, and a crowded one reads as a dashboard.
- **Neutral paper, no tint.** The stage is `#fdfdfc` and the page is `#f2f2f0`. In dark mode they are `#141416` and `#0b0b0c`. *Why:* a cream or tinted ground makes light metals look the same as the ground, and it warms every colour placed on it.

## Materials

Pick the material the real part is made of. If the subject is abstract, pick the material its role suggests. Each material is a `lit`/`dark` pair, and the engine mixes between the two by how square the face stands to the key light.

| material | use for | why |
|---|---|---|
| `steel` | machined steel: axles, hangers, cases, cogs | cool, neutral grey with the widest range, so it carries the form |
| `alloy` | anodized aluminium: bridges, bolts, caps, small bright parts | bright satin with a grey side, so it reads as a lighter metal next to steel |
| `chain` | oiled or dark steel: chain, cable housing | low-key, so it recedes behind the mechanism |
| `slate` | painted or anodized bodies: knuckles, housings | blue-grey, a body colour that isn't the signal |
| `frame` | context the subject is mounted on: bike frame, mainplate, deck | neutral and recessive, but still with a real top-to-side step |
| `brass` / `gilt` | watch train wheels, barrels, gilt plates | warm gold, the honest material of a movement |
| `ruby` | jewels, pallet stones | deep, saturated red that reads as a stone, never a pink sticker |
| `blued` | heat-blued screws and hands | the real finish; use it sparingly, as an accent |
| `rhodium` | rhodium-plated bridges and plates | a cooler, brighter silver than `alloy` |
| `graphite` | dark coated parts, rubber, carbon | darker than `chain`, with a visible lit side |
| `alu` | bead-blasted aluminium enclosures | flatter and brighter than `steel`, with less range |
| `cobalt`, `teal`, `amber` | functional colour on concept parts (lanes, states) | each matches a page hue (`--blue`, `--teal`, amber) |
| `ceramic`, `cell`, `card`, `obsidian` | concept bodies: trays, bit cells, tags, hubs | neutral, so values and toned states carry the meaning |
| `subject` | the followed part only | the one signal colour (see Restraint) |

## Value contrast

- **The lit-to-dark span of each pair is wide, measured in OKLab lightness.** Metals and colours span at least 0.30: steel is 0.56, slate 0.46, brass 0.41 and subject 0.32. Neutral context and concept bodies (`frame`, `ceramic`, `cell`, `alu`) span at least 0.22. *Why:* the engine shades a face anywhere from 16% to 100% of the way to `lit`. A narrow pair, like the old `frame` (`#f3f0e8`/`#cbc5b8`, a span of 0.10), puts tops and sides on the same value, and the solid reads as a flat shape. Neutral bodies get a smaller span so they stay behind the subject.
- **The lit end stays off the stage white.** Metal lit ends sit at L ≤ 0.98 (steel is at 0.92), and `frame` at 0.93. Only `card` is pure white, because it carries printed values. *Why:* if a top face matches the ground, only its outline separates it, which is the cream-on-cream failure.
- **Dark mode keeps the same step.** Lift the lit end and keep the dark end near the stage. Don't invert the materials.
- **Don't force caps lighter than walls.** Use `rig-cap` and `rig-wall` to measure faces, not to reshade them. *Why:* a side-on figure such as the derailleur has caps that face away from the light, and its walls are correctly the lighter faces.
- **Measure it.** Read `getComputedStyle(face).fill` for `.rig-cap` and `.rig-wall` faces and convert to OKLab L. A material whose median cap and median wall differ by less than 0.08 needs a wider pair.

## Receding and shadows

- A receded part mixes 42% toward the stage (`.rig-part[data-recede]`). *Why:* at 50%, light metals dissolved into the ground and the context stopped reading as the same object.
- Contact shadows are a soft, neutral near-black (`--rig-contact`, `#16181c`) at 16% fill with a 7% feathered edge, laid toward the part behind. Never use a coloured shadow or a hard offset. *Why:* a believable shadow grounds the part without adding a second outline.

## Lines

- Silhouette 1.5px, creases 0.7px at 70% opacity, and a named part's silhouette 2.4px. A metal edge that catches the light gets a 1.1px white shine. *Why:* the weights rank the edges (outline over detail) without heavy ink.

## Type

- **One family, Manrope (OFL), for all UI text.** IBM Plex Mono (OFL) is for numbers and readouts only. No display serif. *Why:* a single family with a mono for figures is calm and precise, and a decorative display face dates the page.
- **Scale:** title 650 28px with -0.03em tracking. Step heading 500 21px with -0.025em. Body 14–15px at 1.5 line height. Labels and tabs 11–13px. Readout numbers 19px mono. *Why:* a few sizes with clear steps between them, and negative tracking only on the large sizes.
- **Ink:** `--ink` is `#1d1e21` and `--ink-2` is `#5f6167` (at least 6:1 on the stage). *Why:* a near-black that isn't pure black, and secondary text that stays readable.

## Spacing and controls

- The card has a 24px page gutter, 22px/28px padding, an 18px radius, a hairline border and one soft shadow (`0 18px 40px -24px`). The stage has a 12px radius and a hairline border. *Why:* the card sits on the page and the stage sits in the card. Only one surface is raised.
- Controls are 36px with a hairline border on the card colour. Only Play is filled with ink. *Why:* quiet controls leave the figure as the loudest thing on the page.
