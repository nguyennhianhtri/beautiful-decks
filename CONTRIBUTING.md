# Contributing

1. Create a focused branch.
2. Add or update a regression before changing engine behavior.
3. Run `npm test`.
4. Run `npm run build:examples` and `npm run qa:examples`.
5. Inspect the generated PNGs for any changed template or motion state.
6. Run `npm run safety` before opening a pull request.

Do not commit generated decks, PDFs, render folders, customer logos, credentials, absolute home paths, or third-party assets without an explicit redistribution license.

When adding a template, document its required fields in `docs/TEMPLATES.md` and add a safe example or fixture.
