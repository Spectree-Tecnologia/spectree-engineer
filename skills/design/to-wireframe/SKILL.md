---
name: to-wireframe
user-invocable: false
description: >-
  Creates a typed, nested wireframe from a screen image or brief, in ASCII
  or SVG according to the format=ascii|svg given by the user. Use when the user
  mentions to-wireframe or asks for a typed UI wireframe.
---

# To Wireframe

> Vendored from [rtadewald/skills](https://github.com/rtadewald/skills/tree/main/to-wireframe) (commit 82fe5ed, 2026-10-30), with `disable-model-invocation` removed so the `ui-ux-designer` can call it. See `THIRD-PARTY-LICENSES.md`.

Create a typed wireframe that describes the structure, components and visible content of a screen. Use [`references/wireframe.example.svg`](references/wireframe.example.svg) as the canonical reference for density and markup.

## Mandatory call

The user must give the format on every call: `format=svg` or `format=ascii`. If it is missing, ask which format they want; do not pick a default.

Also accept a single source:

- `image=<path>` or an attached image: extract the structure of the existing screen;
- `brief=<screen description>`: build the blueprint from the brief, proposal or specification received.

`output=<path>` is optional for an image and mandatory for a brief. When the input is an image and there is no `output`, save next to it:

```text
image=mocks/dashboard.png format=svg    → mocks/dashboard.wireframe.svg
image=mocks/dashboard.png format=ascii  → mocks/dashboard.wireframe.txt
```

Call examples:

```text
Use $to-wireframe: format=svg image=mocks/dashboard.png
Use $to-wireframe: format=ascii image=mocks/dashboard.png
Use $to-wireframe: format=svg brief="Projects dashboard with sidebar, KPIs and activity" output=mocks/12-wire-a.svg
```

Show the resulting path. Open the SVG when it makes sense. The skill ends when it delivers the wireframe: do not implement HTML/CSS, assets, a final image, a step plan or approval gates.

## What the wireframe represents

The wireframe is a structural blueprint, not a pixel-perfect visual recreation. Each surface or component with its own style gets a labeled region: `nav`, `hero`, `media`, `card`, `card2`, `card3`, `form`, `rail`, `quote` or `section`.

- The same look uses the same id; a visual variation gets the next id (`card`, `card2`, `card3`).
- Regions nest when the screen shows a surface of its own inside another, such as list cards, a floating tooltip, a controls dock or a chart panel.
- Every drawn box needs a label. Do not flatten a component into loose text in its parent.

## Typed tags

All visible text and controls go into a tag; leave no loose content. Use this closed vocabulary:

| Tag | Use |
|---|---|
| `[h1:]`, `[h2:]`, `[h3:]` | Headings |
| `[t1:]`, `[t2:]`, `[t3:]` | Body, meta and microtext |
| `[btn:]`, `[btn2:]`, `[btn3:]` | Buttons with distinct styles |
| `[lnk:]` | Inactive navigation link |
| `[in:]` | Placeholder or input text |
| `[ico:]` | Icon |
| `[img:]` | Image, raster or 3D |
| `[av:]` | Avatar |
| `[chart:]` | Chart |

The same tag id represents the same style. Visually different buttons use different ids. Active nav is `[btn:]`; inactive nav is `[lnk:]`. A button with an icon can be `[btn: [ico:plus] Add project]`. Write one tag per visual line: a headline on three lines becomes three `[h1:]` tags.

For image input, use the essential text that is legible. When it cannot be read reliably, write the appropriate tag with `...`; do not invent text. For brief input, use only content the brief provides or that is needed to explain the screen's stated function.

## Process

1. Read the image or the brief and define the regions, their states and the typed content.
2. In one pass, draw the blueprint in the requested format.
3. Do a single review: every surface is labeled; all text is in a tag; inner components are nested; and active/inactive nav is typed correctly.
4. Write to the given `output` or to the image's default path.

Do not measure pixels, run OCR, crop, use an eyedropper or simulate the final look. Estimate positions and sizes when working from an image; when working from a brief, prioritize the described hierarchy.

## SVG rendering

For `format=svg`:

- Start with `<?xml version="1.0" encoding="UTF-8"?>`.
- Use a `viewBox` proportional to the image canvas; for a brief with no defined proportion, use `0 0 1440 810`.
- Draw only `rect` and `text`, in gray, with simple strokes and labels.
- Do not use product colors, premium typography, shadows, gradients, curves, icons or simulated charts.
- Use labels with basic letters and numbers to avoid invalid XML.

## ASCII rendering

For `format=ascii`:

- Use only `+`, `-` and `|` as borders, so it works in any terminal.
- Put each region's label on the first line of its box and keep the typed tags inside it.
- Represent nested regions with nested boxes and leave visual space between columns and sections.
- Do not use colors, shadows, gradients, drawn icons, simulated charts or pixel-perfect measurements.

```text
+------------------------------------------------------------------------+
| nav                                                                    |
| [ico:logo] [t1: Orbit]          [lnk: Explore] [btn: [av:] Profile]  |
+------------------------------------------------------------------------+
| hero                                                                   |
| [h1: Build your next project]                                          |
| [t2: Keep the team aligned from one place]          [btn2: Create]    |
+-----------------------------------+  +---------------------------------+
| card                              |  | card2                           |
| [h2: 24] [t2: Open projects]      |  | [h3: Activity]                  |
| [chart: sparkline]                |  | +-----------------------------+ |
|                                   |  | | card3                       | |
|                                   |  | | [av:] [t1: New comment]    | |
+-----------------------------------+  | +-----------------------------+ |
                                       +---------------------------------+
```
