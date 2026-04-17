# Contributing

## Local setup

Requires Node.js 18+ (LTS recommended).

```bash
git clone https://github.com/syi-stackure/sdk-js.git
cd sdk-js
npm ci
npm run ci
```

`npm run ci` runs ESLint, Prettier check, `tsc --noEmit`, and the tsup build. It must pass before a PR is opened.

## Commit message format

This repository uses [Conventional Commits](https://www.conventionalcommits.org/). Release Please parses commit messages to generate the changelog and bump versions.

Allowed types:

- `feat:` a new user-facing capability (minor version bump)
- `fix:` a bug fix (patch version bump)
- `perf:` a performance improvement
- `refactor:` a code change that is neither a feature nor a fix
- `docs:` documentation only
- `chore:` tooling, infrastructure, dependencies (hidden from changelog)
- `test:` test changes only (hidden from changelog)
- `build:` build system changes (hidden from changelog)
- `ci:` CI configuration changes (hidden from changelog)

Breaking changes are indicated by `!` after the type (e.g. `feat!: drop Node 16 support`) or a `BREAKING CHANGE:` footer.

## PR flow

1. Fork, branch off `main`.
2. Make changes; run `npm run ci`.
3. Open PR. Title must follow the commit-message format above (release-please parses PR titles on squash-merge).
4. CI runs `lint`, `typecheck`, and `build` jobs on every PR.
5. On merge to `main`, release-please either opens a new release PR or updates the existing one.
6. Merging the release PR creates the tag and fires the signed-release workflow.

## Reporting security issues

See [SECURITY.md](./SECURITY.md).
