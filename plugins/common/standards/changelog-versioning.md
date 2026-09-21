## Changelog & versioning (universal)

Three things must ALWAYS stay in sync after any functional change: the
stack's version source, `CHANGELOG.md`, and `README.md`. Never update one
without updating the others.

**IMPORTANT**: Always propose `README.md` changes to the developer for
approval BEFORE applying them. `CHANGELOG.md` and the version file can be
updated directly.

### Semantic Versioning

Follow [Semantic Versioning 2.0.0](https://semver.org/):

| Change type | Version bump | Examples |
|-------------|-------------|----------|
| Breaking changes | MAJOR (X.0.0) | Removing endpoints, changing response structure, restructuring routes |
| New functionality | MINOR (x.Y.0) | New endpoints, new pages, new features |
| Bug fixes | PATCH (x.y.Z) | Fixing validation, correcting logic, fixing UI bugs |

### Version source — detect the stack first

1. `*.csproj` / `Directory.Build.props` / `*.sln` → **C# / .NET**. Prefer
   `<Version>` in `Directory.Build.props` (multi-project solutions) or the
   API's `*.csproj`. **Gotcha**: in SDK-style projects, `AssemblyInfo.cs` is
   auto-generated from `<Version>` at build time — never hand-edit it unless
   `<GenerateAssemblyInfo>false</GenerateAssemblyInfo>` is set.
2. `pyproject.toml` / `setup.cfg` / `setup.py` → **Python**. Prefer the
   Poetry-style `[tool.poetry] version` (or PEP 621 `[project] version`).
   **Gotcha — dynamic version**: if `pyproject.toml` declares
   `dynamic = ["version"]`, the real version lives in code (usually
   `src/<package>/__init__.py`'s `__version__`, or `_version.py`) — edit that,
   not the toml. Keep both in sync if both exist.
3. `package.json` → **Node.js or React (JS)**. For monorepos with workspaces,
   bump the affected package's `package.json`, not the root, unless the
   change is repo-wide.
4. `composer.json` → **PHP (Laravel, Symfony, or plain PHP)**. **Gotcha — an
   application usually has NO `version` field**: Composer itself discourages one
   for applications (it is meant for published packages, where the VCS tag is the
   source of truth). So detect, in order: a `version` key in `composer.json` →
   bump it; otherwise the version source is the **git tag**, and the release step
   is `git tag vX.Y.Z`, not a file edit. Never ADD a `version` key to an
   application's `composer.json` just to have something to bump — propose the tag
   instead. If the team keeps its own version constant (e.g. a `config/*.php`
   entry or an `APP_VERSION` env var), that is the source — find it before
   assuming there is none.

5. `pom.xml` → **Java / Maven**. The `<version>` of the project itself, not the
   parent's. **Gotcha — a multi-module build**: the aggregator and the modules each
   carry a version, and a module may inherit the parent's via `${revision}` or omit
   it entirely. Bump the module whose code changed; if the build uses a
   `revision` property for a single coordinated version, bump that property once.
   `mvn versions:set` edits every module consistently — prefer it over hand-editing
   several POMs.
6. `build.gradle` / `build.gradle.kts` / `gradle.properties` → **Java / Gradle**.
   The `version` is often declared as a property in `gradle.properties` rather than
   in the build script; look there first. In a multi-project build, `settings.gradle`
   lists the subprojects and the root may set the version for all of them.
   **Gotcha**: a plugin such as `nebula-release` or `axion-release` can derive the
   version from the **git tag**, in which case there is no literal to edit — the
   release step is the tag, and hand-adding a `version =` line breaks it. Check the
   plugins block before assuming.

If multiple stacks coexist in one repo, each sub-project keeps its OWN
version source — bump the one whose code actually changed.

**Product version vs. API/endpoint version** — these are different things:
the product/application version (what this standard manages) drives
CHANGELOG and releases; the API endpoint version (`/api/v1`, `/api/v2`, or
header-based versioning) is a routing/contract concern — only bump it when
the API contract itself is restructured, never as a substitute for the
product version.

### `CHANGELOG.md` format

Follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/):

```markdown
# Changelog

## [x.y.z] - YYYY-MM-DD

### Added

- **Feature name**: short description
  - Sub-item with a specific detail
- **Other feature**: description

### Changed

- **What changed**: description and why

### Security

- Description of the security improvement

---

## [prev.version] - YYYY-MM-DD
```

Rules:
- Only include sections with entries: `### Added`, `### Changed`,
  `### Deprecated`, `### Removed`, `### Fixed`, `### Security`.
- **Bold** the feature/change name, use sub-items with indentation for
  technical detail (endpoints, config, specifics).
- No `[Unreleased]` section — go straight to versioned entries.
- Separate versions with a `---` horizontal rule.
- For endpoints, include the HTTP method and path:
  `` `POST /api/v1/auth/forgot-password` ``.

### `README.md` updates — always propose, never auto-apply

Update these sections as applicable, and always show the diff to the
developer before writing it:

- **Configuration** — new or changed environment variables.
- **Architecture** — the file tree, if new files/folders were added. Use
  tree-drawing characters (`├──`, `│`, `└──`) with an inline `#` comment
  after each **file** (not directory) explaining its purpose, aligned for
  readability.
- **Version** — update the version reference if the README shows one.
- For backend APIs: new endpoints with full request/response examples,
  security notes, and multi-step flows if applicable.
- For frontends: routes/pages table, new reusable components, changed auth
  flows.

### Checklist before finalizing

1. Correct stack detected and the RIGHT version source bumped
   (major/minor/patch).
2. For C#: edited `<Version>`, not the auto-generated `AssemblyInfo.cs`.
3. For Python: if `dynamic`, edited the real `__version__` source, not just
   the toml.
4. `CHANGELOG.md` has an entry under the correct version with today's date.
5. `README.md` changes proposed and approved by the developer.
6. No discrepancies between the version source, `CHANGELOG.md`, and
   `README.md`.
