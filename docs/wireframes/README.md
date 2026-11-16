# Wireframes

PNG mockups for each phase, linked from the phase proposals in `../proposals/`.

They are generated from HTML so they're easy to edit:

- `source/screens.cjs` defines each screen (one function per image).
- `source/wireframe.css` holds the shared styles.
- Re-render with `node docs/wireframes/source/render-wireframes.cjs` (all screens) or pass screen names to render only some, e.g. `... render-wireframes.cjs phase-2-editor`.
