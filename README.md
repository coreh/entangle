# entangle(1)

## Description

`entangle(1)` is a tool for synchronizing source code lines across files in a project. It uses emoji as metasyntactic markers to delimit ‘entangled’ regions of source code, which it then keeps synchronized.

Useful for:
- Splitting larger classes over several files
- Injecting code for cross cutting concerns

## Features

- Able to operate as a traditional build tool or as an interactive file watcher
- Language/editor agnostic: As long as the language/editor supports unicode in comments and is able to properly render emoji, it should work out-of-the-box.
- Indentation aware
- Uses `ripgrep` for file matching, so you'll benefit from its performance plus other goodies like `.gitignore` support
- Indempotent (Running the tool again will preserve the same final result)
- Atomic file writes

## Markers

- 🚧 - Target (unidirectional)
- 🔨 - Source (unidirectional)
- 💫 - Bidirectional sync

## License

MIT
