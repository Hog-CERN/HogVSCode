# Change Log

All notable changes to the "hog" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## [Unreleased]

## [0.6.0] - 2026-10-10

### Added

**Sidebar**
- Hog activity bar view listing every `Top/**/hog.conf` project, whether it has been created, its list files and the files they reference (nested list files included). Missing files are flagged.
- Inline and context-menu actions on projects: Create, Run Workflow, Open in IDE, Show Design Hierarchy.
- Hierarchy view built from `Hog/Do TREE`: modules nested by instantiation with library and type, circular-reference warnings, a Packages group, and click-to-open source files. The last hierarchy is remembered per workspace.

**Commands**
- Run Workflow, Synthesis, Implementation, Simulation, Check Syntax, Check List Files, Show Design Hierarchy, Stop Running Command, Refresh Projects. All are available from the command palette under `Hog:`.
- Status bar item showing what Hog is running and whether it succeeded; click for a menu of commands.

**Language support**
- Separate grammars for list files and `hog.conf`, covering sections, file paths, modifiers (`nosynth`, `lib=`, `top=`, `topsim=`, `93`, ...), `KEY=VALUE` properties, strings, numbers and comments.
- `.ipb` and `.sub` list files are recognised, and `hog.conf` is its own language (`hog-conf`).
- Hover documentation for modifiers and `hog.conf` sections.
- Completion of the modifiers valid for each file type, `lib=` / `top=` snippets and section names.
- Ctrl/Cmd-click on file paths in list files.
- Outline of sections, properties and files.
- Diagnostics for files that do not exist and for unknown modifiers.

**Settings**
- `hog.doScript` (default `Hog/Do`), `hog.vivadoPath`, `hog.quartusPath`, `hog.diagnostics.enable`.

### Changed
- Create Project and Open Project share one runner and a single "Hog" output channel instead of creating a new channel on every run.
- Open Project supports Quartus (`.qpf`) as well as Vivado (`.xpr`); executables are configurable.
- Commands are grouped under the `Hog:` category.
- The extension now activates when a Hog list file or `Top/**/hog.conf` is present.

### Fixed
- Keyword highlighting never matched: the old regex consumed the preceding character.
- Use of the deprecated `workspace.rootPath`.
- Declared "Dependencies" and "Outline" views that were never populated have been replaced by working views.

## [0.5.0]

- Initial release
