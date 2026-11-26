# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Angular: sources of truth

The Angular team's official context files are vendored in `docs/angular/` (provenance and hashes
in `docs/angular/SOURCE.md`). They are the source of truth for every line of Angular code here:
where anything else (habits, older docs, other projects) disagrees with them, they win.

- `docs/angular/best-practices.md` is always loaded, in full:

@docs/angular/best-practices.md

- `docs/angular/llms-full.txt` (the complete Angular documentation, ~865 KB) is the reference to
  consult whenever a question about Angular comes up: an API, a pattern, configuration, testing,
  the build. Don't load it in full; find the relevant sections and read them completely. Its
  headings work as an index: `grep -n "^#" docs/angular/llms-full.txt`.
