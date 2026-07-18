# PyPI Diff — is it safe to upgrade?

A Dependabot PR bumps `litellm 1.84.0 → 1.85.0`. The changelog is missing, vague, or a wall of merged-PR titles. Do you rubber-stamp it, or spend twenty minutes spelunking through GitHub compare views?

**PyPI Diff answers the question in one screen:** exactly which public functions, classes, and methods were removed or changed signature, what's new, which CVEs the bump fixes or introduces, and how the dependency tree moved.

And it answers it from the **real artifacts published to PyPI** — not the source repo. Build steps, `.gitignore` entries, and last-minute edits mean the published package can differ from the tagged commit (ask anyone who audited the `xz` or `ultralytics` incidents). PyPI Diff downloads both versions and diffs what you'd actually install.

![PyPI Package Diff screenshot](/public/images/dashboard.png)

## What you get

- **Breaking changes** — removed public functions, classes, and methods; signature changes with added/removed parameters highlighted inline; return type changes. Powered by **griffe** with full type annotation support.
- **What's New** — every new public API across all modules, so you know what the upgrade buys you
- **CVE scanning** — queries the [OSV advisory database](https://osv.dev) (same source as `pip-audit`) for both versions; shows vulnerabilities fixed, introduced, and persisting
- **Metadata diff** — dependency changes, `requires_python`, license, and classifier diffs powered by **pkginfo**
- **File-by-file diff** — unified diff view with line numbers, add/remove highlighting, and a change navigator grouping files into Added / Removed / Modified
- **Shareable URLs** — every comparison is a link you can drop in a PR review (`?pkg=requests&v1=2.28.0&v2=2.29.0`)
- **CLI with CI mode** — the same report in your terminal; `--check` exits non-zero on breaking changes or newly introduced CVEs
- **Fast repeats** — downloads are cached at `~/.cache/pypi-diff/`, and the UI has dark/light mode

## CLI

```bash
pipx install ./backend      # or: pip install ./backend

pypi-diff requests 2.31.0 2.32.0     # full upgrade report in the terminal
pypi-diff litellm                    # compares the two latest versions
pypi-diff litellm 1.84.0             # compares 1.84.0 against the latest
pypi-diff numpy --json               # full structured diff as JSON
pypi-diff litellm 1.84.0 1.85.0 --check   # CI gate: exit 1 on breaking changes / new CVEs
```

```
requests 2.31.0 → 2.32.0 (wheel vs wheel)
13 files changed: +0 added, -0 removed, ~13 modified

Breaking changes none detected

Security (OSV)
  GHSA-9wx4-h78v-vm56 [MEDIUM] fixed by upgrading https://osv.dev/vulnerability/GHSA-9wx4-h78v-vm56
  ...

requires-python  >=3.7 → >=3.8
```

Flags: `--json` (structured output), `--files` (list every changed file), `--check` (CI exit code), `--no-color`.

## Tech stack

| Layer | Stack |
|---|---|
| Backend | Python · FastAPI · uvicorn |
| Package data | PyPI JSON API · `httpx` |
| API analysis | `griffe` (type-aware AST extraction) |
| Security | OSV REST API (same database as `pip-audit`) |
| Metadata | `pkginfo` |
| File diffing | Python `difflib` (unified diff) |
| Frontend | React 18 · TypeScript · Vite |
| Styling | Plain CSS with CSS custom properties |

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+

### Run locally

```bash
git clone https://github.com/you/pypi-package-diff
cd pypi-package-diff
./start.sh
```

The script creates the Python venv and installs npm packages on first run, then starts both servers:

| Service | URL |
|---|---|
| Frontend (Vite dev server) | http://localhost:5173 |
| Backend (FastAPI) | http://localhost:8000 |

The Vite dev server proxies `/api` requests to the backend, so the frontend just works.

### Manual setup

```bash
# Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Run with Docker

```bash
docker build -t py-package-diff .
docker run -p 8000:8000 py-package-diff
```

The image builds the frontend, copies the static bundle into the Python image, and serves both the API and the built UI from FastAPI on http://localhost:8000. Any non-`/api` path falls back to `index.html` (SPA routing).

## API

```
GET /api/packages/{package}/versions
```
Returns the list of published versions for a package, oldest-first.

```
GET /api/packages/{package}/diff/{v1}/{v2}
```
Downloads both versions (cached), extracts them, and returns a structured diff including file changes, API changelog, security advisories, and metadata diffs.

## Artifact preference

For each version the backend prefers:
1. Pure-Python wheel (`*-none-any.whl`) — what most users actually install
2. Any wheel
3. Source distribution (sdist)

The artifact type used for each version is returned in the response and shown in the UI summary bar.

## Project structure

```
py-package-diff/
├── backend/
│   ├── main.py          # FastAPI app, API endpoints
│   ├── cli.py           # pypi-diff terminal command
│   ├── pyproject.toml   # pip/pipx-installable CLI packaging
│   ├── pypi_client.py   # PyPI download + extraction
│   ├── differ.py        # File comparison + diff generation
│   ├── analyzer.py      # Python API analysis via griffe
│   ├── security.py      # CVE lookup via OSV API
│   ├── meta_diff.py     # Package metadata diff via pkginfo
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.tsx                     # React entry point
│   │   ├── App.tsx                      # Root — routing, theme, URL state
│   │   ├── App.css                      # All styles (CSS custom properties)
│   │   ├── api.ts                       # Typed fetch wrappers
│   │   ├── types.ts                     # Shared TypeScript types
│   │   └── components/
│   │       ├── SearchForm.tsx           # Package + version input
│   │       ├── DiffView.tsx             # Tabbed result layout
│   │       ├── SummaryBar.tsx           # Stats strip
│   │       ├── FileSidebar.tsx          # Changed files list
│   │       ├── DiffPanel.tsx            # Unified diff renderer
│   │       ├── Changelog.tsx            # API changelog (breaking + new)
│   │       ├── Security.tsx             # CVE vulnerability view
│   │       └── MetaDiff.tsx             # Package metadata diff
│   └── vite.config.ts
├── Dockerfile           # Multi-stage build (frontend → FastAPI static serving)
└── start.sh             # One-command local dev startup
```

## Why not just diff the GitHub tags?

Source repositories are not always an accurate representation of what gets published:

- **Build steps** can generate or transform files (compiled extensions, vendored deps, minified assets)
- **`.gitignore`** may exclude files that are deliberately included in the package
- **Last-minute edits** before `twine upload` never make it back to the repo
- **Automation scripts** may modify files as part of the release pipeline

PyPI Package Diff treats the published artifact as the single source of truth.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the [MIT License](LICENSE).
