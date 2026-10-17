# Shipnote

Release notes from your commits.

Shipnote reads your conventional commits since the last tag, groups them by type and
writes a markdown changelog for the release.

## Install

```bash
npm install -g shipnote
```

## Usage

```bash
npx shipnote draft
npx shipnote draft --since v1.2.0
```

`draft` writes `CHANGELOG.md`. Commit types `feat`, `fix` and `perf` get their own sections.
