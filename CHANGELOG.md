# Change Log

All notable changes to the "hog" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added
- Separate grammars for list files and `hog.conf`; `.ipb` and `.sub` list files
- Hog sidebar with projects, list files and referenced files, using the official Hog logo
- Commands: Run Workflow, Synthesis, Implementation, Simulation, Check Syntax, Check List Files, Stop
- Hierarchy view built from `Hog/Do TREE`
- Status bar item showing the state of the running command
- Hover, completion, document links, outline and diagnostics for list files and `hog.conf`
- Settings `hog.doScript`, `hog.vivadoPath`, `hog.quartusPath`, `hog.diagnostics.enable`

### Changed
- Create / Open project share one runner and one output channel
- Open Project now supports Quartus (`.qpf`) as well as Vivado (`.xpr`)

### Fixed
- Keyword regex that swallowed the preceding character and never matched

## 0.5.0

- Initial release