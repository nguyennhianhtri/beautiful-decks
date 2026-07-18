# Security

Beautiful Decks is a local build tool. Deck specs are CommonJS modules and therefore executable JavaScript.

- Run only specs you trust.
- Do not insert unsanitized external input into standard-template HTML fields.
- Keep credentials, customer data, licensed/private assets, and absolute local paths out of public deck specs.
- Use `npm run safety` before publishing changes.
- Use `beautiful-decks portable ... --strict` when you need a self-contained artifact with no remote dependencies.

To report a vulnerability, open a private security advisory on the GitHub repository rather than a public issue.
