# Syntax Highlighter Improvement Design

**Date:** 2026-04-14  
**Scope:** Improve syntax highlighting for Hog list files and `hog.conf` configuration files in the HogVSCode extension.

---

## Background

The existing grammar (`syntaxes/hog.tmLanguage.json`) has several issues:

- Broken keyword regex (`\\b[^^](...)\\b`) eats a preceding character, so keywords never match correctly
- No section header highlighting (`[files]`, `[generics]`, etc.)
- No file path highlighting
- Modifiers on file lines (`lib=`, `top=`, boolean flags, version numbers) are not distinguished
- `.ipb` extension is not registered in `package.json`
- `hog.conf` has no language registration at all

---

## Architecture

Two separate grammar files replacing the current single grammar. Each has its own language ID, scopeName, and registration in `package.json`.

| File | Language ID | ScopeName | Matches |
|---|---|---|---|
| `syntaxes/hog-list.tmLanguage.json` | `hog` | `source.hog-list` | `.src`, `.sim`, `.con`, `.lst`, `.ext`, `.ipb` |
| `syntaxes/hog-conf.tmLanguage.json` | `hog-conf` | `source.hog-conf` | filename `hog.conf` only |

The old `syntaxes/hog.tmLanguage.json` is deleted.

---

## package.json Changes

1. Replace the existing `hog` language grammar path from `hog.tmLanguage.json` to `hog-list.tmLanguage.json`.
2. Add `.ipb` to the `hog` language extensions list.
3. Add a new `hog-conf` language entry using `"filenames": ["hog.conf"]` (not an extension match).
4. Add a new grammar entry for `hog-conf` pointing to `syntaxes/hog-conf.tmLanguage.json`.

---

## hog-conf Grammar

Targets INI-style `hog.conf` files with four token types:

| Token | Pattern | Scope |
|---|---|---|
| Comment | `# ...` to end of line | `comment.line.number-sign` |
| Section header | `[identifier]` on its own line | `entity.name.section` |
| Key | Word before `=` (may contain dots: `STEPS.PHYS_OPT_DESIGN.IS_ENABLED`) | `variable.other` |
| Operator | `=` | `keyword.operator` |
| Value | Everything after `=` to end of line | `string.unquoted` |

Section names may contain letters, digits, and underscores. Keys may contain uppercase letters, digits, dots, and underscores.

---

## hog-list Grammar

Targets line-based list files (`.src`, `.sim`, `.con`, `.lst`, `.ext`, `.ipb`) with the following token types:

| Token | Example | Scope |
|---|---|---|
| Comment | `# comment`, `#Simulator xsim` | `comment.line.number-sign` |
| Section header | `[files]`, `[properties]` | `entity.name.section` |
| File path | `example/src/adder.vhd`, `IP/fifo/fifo.xci` | `entity.name.filename` |
| Boolean modifier | `nosim`, `noimpl`, `locked`, `topsim`, `nosynth`, `noadd`, `nogenerate`, `notiming`, `noconstraints` | `keyword.other` |
| Key=value modifier key | `lib`, `top` (in `lib=xxx`, `top=xxx`) | `keyword.other` |
| Key=value modifier value | `xxx` after `lib=` or `top=` | `string.unquoted` |
| Property line key | `TOP`, `MODELSIM.SIMULATE.RUNTIME` (uppercase `KEY=VALUE` on its own line) | `variable.other` |
| Property line value | value after `=` on a property line | `string.unquoted` |
| Version number | `93` (standalone integer at end of a file path line) | `constant.numeric` |

**File path identification:** A line is treated as a file path if it starts with a non-`[`, non-`#` token containing `/` or ending in a known extension (`.vhd`, `.v`, `.sv`, `.xci`, `.xdc`, `.do`, `.udo`, `.xml`, `.ipb`). `.ipb` lines contain two space-separated paths; both are highlighted as `entity.name.filename`.

**Property line vs file modifier:** A property line is a line whose first token is all-uppercase (plus dots/underscores) followed by `=`. File-line modifiers (`lib=`, `top=`) are lowercase and appear after a file path on the same line.

---

## Files Changed

- `package.json` — language registrations and grammar paths
- `syntaxes/hog-list.tmLanguage.json` — new, replaces `hog.tmLanguage.json`
- `syntaxes/hog-conf.tmLanguage.json` — new
- `syntaxes/hog.tmLanguage.json` — deleted
