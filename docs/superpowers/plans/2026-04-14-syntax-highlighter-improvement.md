# Syntax Highlighter Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken single-grammar syntax highlighter with two precise grammars — one for Hog list files and one for `hog.conf` — and register both correctly in `package.json`.

**Architecture:** Two new tmLanguage JSON files (`syntaxes/hog-list.tmLanguage.json`, `syntaxes/hog-conf.tmLanguage.json`) replace the existing `syntaxes/hog.tmLanguage.json`. Each grammar targets its own language ID with distinct patterns. `package.json` is updated to register `hog-conf` by filename and add the `.ipb` extension to the list file language.

**Tech Stack:** VS Code tmLanguage grammar (JSON), TypeScript extension host.

**Working directory for all commands:** `/home/dcieri/Work/Hog/HogVSCode` (the extension root, one level above `data/`)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `package.json` | Add `hog-conf` language + grammar, add `.ipb`, update grammar paths |
| Create | `syntaxes/hog-list.tmLanguage.json` | Grammar for `.src`, `.sim`, `.con`, `.lst`, `.ext`, `.ipb` |
| Create | `syntaxes/hog-conf.tmLanguage.json` | Grammar for `hog.conf` |
| Delete | `syntaxes/hog.tmLanguage.json` | Old broken grammar — remove after new files are in place |

---

## Task 1: Update package.json

**Files:**
- Modify: `package.json` (lines 51–74)

- [ ] **Step 1: Update the `languages` array**

Replace the existing `languages` block with:

```json
"languages": [
  {
    "id": "hog",
    "aliases": [
      "Hog",
      "hog"
    ],
    "extensions": [
      ".src",
      ".sim",
      ".con",
      ".lst",
      ".ext",
      ".ipb"
    ],
    "configuration": "./language-configuration.json"
  },
  {
    "id": "hog-conf",
    "aliases": [
      "Hog Configuration",
      "hog-conf"
    ],
    "filenames": [
      "hog.conf"
    ],
    "configuration": "./language-configuration.json"
  }
],
```

- [ ] **Step 2: Update the `grammars` array**

Replace the existing `grammars` block with:

```json
"grammars": [
  {
    "language": "hog",
    "scopeName": "source.hog-list",
    "path": "./syntaxes/hog-list.tmLanguage.json"
  },
  {
    "language": "hog-conf",
    "scopeName": "source.hog-conf",
    "path": "./syntaxes/hog-conf.tmLanguage.json"
  }
]
```

- [ ] **Step 3: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat: register hog-conf language and add .ipb extension"
```

---

## Task 2: Create `hog-conf` grammar

**Files:**
- Create: `syntaxes/hog-conf.tmLanguage.json`

This grammar covers INI-style `hog.conf` files. Pattern order matters — comments are matched first so `#` lines are never misread as properties.

- [ ] **Step 1: Create the file**

Write `syntaxes/hog-conf.tmLanguage.json` with this exact content:

```json
{
	"$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
	"name": "Hog Configuration",
	"scopeName": "source.hog-conf",
	"patterns": [
		{"include": "#comment"},
		{"include": "#section"},
		{"include": "#property"}
	],
	"repository": {
		"comment": {
			"name": "comment.line.number-sign.hog-conf",
			"match": "#.*$"
		},
		"section": {
			"name": "entity.name.section.hog-conf",
			"match": "^\\[[\\w]+\\]\\s*$"
		},
		"property": {
			"match": "^([A-Z][A-Z0-9._]*)(=)(.*)",
			"captures": {
				"1": {"name": "variable.other.hog-conf"},
				"2": {"name": "keyword.operator.hog-conf"},
				"3": {"name": "string.unquoted.hog-conf"}
			}
		}
	}
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('syntaxes/hog-conf.tmLanguage.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Verify coverage against `data/hog.conf`**

Open `data/hog.conf` in VS Code. Expected highlighting:

| Line | Expected colour |
|---|---|
| `# vivado 2020.2` | comment (grey/green) |
| `[generics]` | section name (yellow/orange) |
| `DATA_WIDTH` | variable (teal/blue) |
| `=` | operator |
| `16` | unquoted string |
| `[main]` | section name |
| `IP_REPO_PATHS` | variable |
| `IP_repository` | unquoted string |
| `STEPS.PHYS_OPT_DESIGN.IS_ENABLED` | variable (dot-separated key) |

- [ ] **Step 4: Commit**

```bash
git add syntaxes/hog-conf.tmLanguage.json
git commit -m "feat: add hog-conf syntax grammar"
```

---

## Task 3: Create `hog-list` grammar

**Files:**
- Create: `syntaxes/hog-list.tmLanguage.json`

Pattern order is critical here. `property` must come before `filepath` so that uppercase `KEY=VALUE` lines at line start are not partially matched as file paths. `modifier-kv` must come before `boolean-modifier` so `lib=` and `top=` are not split.

- [ ] **Step 1: Create the file**

Write `syntaxes/hog-list.tmLanguage.json` with this exact content:

```json
{
	"$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
	"name": "Hog List",
	"scopeName": "source.hog-list",
	"patterns": [
		{"include": "#comment"},
		{"include": "#section"},
		{"include": "#property"},
		{"include": "#modifier-kv"},
		{"include": "#boolean-modifier"},
		{"include": "#filepath"},
		{"include": "#version-number"}
	],
	"repository": {
		"comment": {
			"name": "comment.line.number-sign.hog-list",
			"match": "#.*$"
		},
		"section": {
			"name": "entity.name.section.hog-list",
			"match": "^\\[[\\w]+\\]\\s*$"
		},
		"property": {
			"match": "^([A-Z][A-Z0-9._]+)(=)(.*)",
			"captures": {
				"1": {"name": "variable.other.hog-list"},
				"2": {"name": "keyword.operator.hog-list"},
				"3": {"name": "string.unquoted.hog-list"}
			}
		},
		"modifier-kv": {
			"match": "\\b(lib|top)=(\\S+)",
			"captures": {
				"1": {"name": "keyword.other.hog-list"},
				"2": {"name": "string.unquoted.hog-list"}
			}
		},
		"boolean-modifier": {
			"name": "keyword.other.hog-list",
			"match": "\\b(nosim|nosynth|noimpl|noadd|nogenerate|notiming|noconstraints|locked|topsim|SystemVerilog|XDC|verilog_header|wavefile|dofile|source|qsys|runtime)\\b"
		},
		"filepath": {
			"name": "entity.name.filename.hog-list",
			"match": "[\\w.\\-]+(?:/[\\w.\\-]+)+"
		},
		"version-number": {
			"name": "constant.numeric.hog-list",
			"match": "\\b\\d+\\b"
		}
	}
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('syntaxes/hog-list.tmLanguage.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Verify coverage against `data/list/example.src`**

Open `data/list/example.src` in VS Code. Expected highlighting:

| Line | Expected |
|---|---|
| `example/src/adder.vhd` | filename (path highlighted) |
| `example/top/top_example.vhd` | filename |
| `top=top_example` | `top` as keyword.other, `top_example` as string |
| `93` (version number) | constant.numeric |
| `IP/fifo_generator_1/fifo_generator_1.xci` | filename |

- [ ] **Step 4: Verify coverage against `data/list/example.sim`**

Open `data/list/example.sim` in VS Code. Expected highlighting:

| Line | Expected |
|---|---|
| `#Simulator xsim` | comment |
| `[files]` | section header |
| `example/sim/tb_example.vhd` | filename |
| `lib=test` | `lib` as keyword.other, `test` as string |
| `[properties]` | section header |
| `MODELSIM.SIMULATE.CUSTOM_UDO` | variable.other |
| `TB_example.udo` | string.unquoted |
| `TOP=TB_example` | variable + string |
| `ACTIVE=1` | variable + constant |

- [ ] **Step 5: Verify coverage against `data/list/ipbus.ipb`**

Open `data/list/ipbus.ipb` in VS Code. Expected highlighting:

| Line | Expected |
|---|---|
| `example/xml/common.xml` | filename |
| `example/ipbus/ipbus_decode_common.vhd` | filename (second path on same line also highlighted) |

- [ ] **Step 6: Commit**

```bash
git add syntaxes/hog-list.tmLanguage.json
git commit -m "feat: add hog-list syntax grammar"
```

---

## Task 4: Remove old grammar

**Files:**
- Delete: `syntaxes/hog.tmLanguage.json`

- [ ] **Step 1: Delete the old file**

```bash
git rm syntaxes/hog.tmLanguage.json
```

- [ ] **Step 2: Verify no remaining references**

```bash
grep -r "hog.tmLanguage" . --include="*.json" --include="*.ts"
```

Expected: no output.

- [ ] **Step 3: Compile the extension to confirm no TypeScript errors**

```bash
npm run compile
```

Expected: exits with code 0, no errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove old hog.tmLanguage.json"
```
