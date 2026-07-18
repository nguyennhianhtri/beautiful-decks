# AGENTS.md

Read `llms.txt` before changing or using this repository.

Rules:

- Treat `standard` as normal 16:9 (1280×720).
- Treat `ultrawide` as 48:9 (3840×720), not as a synonym for widescreen 16:9.
- Start from `examples/`; do not invent a parallel build path.
- Run the artifact: build → QA → render → visual inspection.
- Do not claim completion from source-only checks.
- Add a regression for engine behavior changes.
- Do not add customer data, absolute home paths, remote dependencies, or unlicensed assets.
- Keep official product/customer logos optional and unmodified.
- Run `npm test` and `npm run safety` before committing.
