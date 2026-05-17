# PyPI Package Diff

Compare what was **actually shipped** to PyPI — not what's in the source repository.

A build step, a forgotten `.gitignore` entry, or a last-minute change can mean the published package looks nothing like the tagged commit. This tool downloads both versions directly from PyPI and diffs them file-by-file, so you always see the real artifact.

![PyPI Package Diff screenshot](/public/images/dashboard.png)

## Features

- **Breaking changes** — detects removed public functions, classes, and methods; signature changes (added/removed parameters shown inline with green/red highlighting); return type changes
- **What's New** — surfaces new public API additions across all modules; powered by **griffe** with full type annotation support
- **CVE scanning** — queries the [OSV advisory database](https://osv.dev) (same source as `pip-audit`) for both versions; shows vulnerabilities fixed, introduced, and persisting
- **Metadata diff** — dependency changes, `requires_python`, license, and classifier diffs powered by **pkginfo**
- **File-by-file diff** — unified diff view with line numbers, add/remove highlighting, and hunk context
- **Change navigator** — sidebar groups files into Added / Removed / Modified with per-file `+N −N` stats
- **Summary bar** — instant overview of files changed and artifact type (wheel vs sdist)
- **Shareable URLs** — every comparison is encoded in the URL (`?pkg=requests&v1=2.28.0&v2=2.29.0`)
- **Download cache** — packages are cached at `~/.cache/pypi-diff/` so repeat comparisons are instant
- **Dark / light mode** — preference saved in `localStorage`, defaults to the OS setting

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
git clone https://github.com/you/py-package-diff
cd py-package-diff
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
│   ├── pypi_client.py   # PyPI download + extraction
│   ├── differ.py        # File comparison + diff generation
│   ├── analyzer.py      # Python API analysis via griffe
│   ├── security.py      # CVE lookup via OSV API
│   ├── meta_diff.py     # Package metadata diff via pkginfo
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx                     # Root — routing, theme, URL state
│   │   ├── api.ts                      # Typed fetch wrappers
│   │   ├── types.ts                    # Shared TypeScript types
│   │   └── components/
│   │       ├── SearchForm.tsx          # Package + version input
│   │       ├── DiffView.tsx            # Tabbed result layout
│   │       ├── SummaryBar.tsx          # Stats strip
│   │       ├── FileSidebar.tsx         # Changed files list
│   │       ├── DiffPanel.tsx           # Unified diff renderer
│   │       ├── Changelog.tsx           # API changelog (breaking + new)
│   │       ├── Security.tsx            # CVE vulnerability view
│   │       └── MetaDiff.tsx            # Package metadata diff
│   └── vite.config.ts
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

MIT
