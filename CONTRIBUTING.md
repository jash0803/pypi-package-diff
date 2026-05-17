# Contributing to PyPI Package Diff

Thanks for your interest in contributing! This document covers everything you need to get the project running locally, understand the codebase, and submit a pull request.

## Table of contents

- [Development setup](#development-setup)
- [Project structure](#project-structure)
- [Making changes](#making-changes)
- [Submitting a pull request](#submitting-a-pull-request)
- [Reporting issues](#reporting-issues)

---

## Development setup

### Prerequisites

- Python 3.11+
- Node.js 18+

### 1. Clone and start

```bash
git clone https://github.com/you/py-package-diff
cd py-package-diff
./start.sh
```

`start.sh` creates the Python venv, installs all dependencies, and starts both dev servers:

| Service | URL |
|---|---|
| Frontend (Vite, hot-reload) | http://localhost:5173 |
| Backend (FastAPI, auto-reload) | http://localhost:8000 |

The Vite dev server proxies `/api/*` to the backend automatically.

### 2. Manual setup (if you prefer)

```bash
# Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8000

# Frontend — separate terminal
cd frontend
npm install
npm run dev
```

### 3. Type-check the frontend

```bash
cd frontend
npm run build   # runs tsc then vite build — zero errors expected
```

---

## Project structure

```
py-package-diff/
├── backend/
│   ├── main.py          # FastAPI app and API endpoints
│   ├── pypi_client.py   # PyPI JSON API + artifact download/extraction
│   ├── differ.py        # File-by-file unified diff generation
│   ├── analyzer.py      # Python public API extraction via griffe
│   ├── security.py      # CVE lookup via the OSV REST API
│   ├── meta_diff.py     # Package metadata comparison via pkginfo
│   └── requirements.txt
└── frontend/
    └── src/
        ├── App.tsx              # Root component — URL state, theme, routing
        ├── api.ts               # Typed fetch helpers
        ├── types.ts             # Shared TypeScript interfaces
        └── components/
            ├── SearchForm.tsx   # Package name + version picker
            ├── DiffView.tsx     # Tab bar + view switching
            ├── SummaryBar.tsx   # Changed-file stats strip
            ├── FileSidebar.tsx  # File list with status groups
            ├── DiffPanel.tsx    # Unified diff renderer
            ├── Changelog.tsx    # API changelog (breaking changes + what's new)
            ├── Security.tsx     # CVE vulnerability view
            └── MetaDiff.tsx     # Package metadata diff
```

### Data flow

```
Browser → GET /api/packages/{pkg}/diff/{v1}/{v2}
            ↓
        pypi_client  — downloads & caches both artifacts from PyPI
            ↓
        differ       — file-by-file unified diff
        analyzer     — griffe-based public API comparison
        security     — OSV API query for both versions (async)
        meta_diff    — pkginfo metadata extraction & diff
            ↓
        JSON response → DiffView tabs (Changelog / Security / Metadata / Files)
```

---

## Making changes

### Backend

- **New analysis feature** — add a module alongside `analyzer.py`, call it in `main.py`'s `get_diff` handler, and include the result in the response dict.
- **Changing the API shape** — update `frontend/src/types.ts` to match.
- **Dependencies** — add to `backend/requirements.txt`. If it's a new library, mention it in the README tech stack table.

The backend uses standard Python type hints throughout. Keep new modules in the same style — no classes where a module with functions will do.

### Frontend

- **Styling** — all styles live in `frontend/src/App.css` using CSS custom properties (`--bg`, `--accent`, `--green`, etc.). Dark and light themes are handled via `[data-theme="light"]` overrides at the top of the file. Avoid inline styles except for one-off layout values.
- **New tab** — add a component, import it in `DiffView.tsx`, add a `Tab` type value, a tab button, and a conditional render block.
- **Types** — keep `types.ts` as the single source of truth. Don't duplicate interface definitions.

### Commit style

```
feat: add <thing>
fix: <what> was <wrong>
refactor: <what changed and why>
docs: update README / CONTRIBUTING
```

One logical change per commit. Keep commits small enough to review in one sitting.

---

## Submitting a pull request

1. Fork the repo and create a branch from `main`.
2. Make your changes and verify `npm run build` passes with zero TypeScript errors.
3. Open a PR against `main` with a clear description of **what** changed and **why**.
4. Keep PRs focused — one feature or fix per PR makes review much easier.

There are no automated tests yet — manual verification against a real package pair (e.g. `requests 2.28.0` vs `2.32.2`) is the current baseline. If you're adding a testable unit of logic, a test alongside it is very welcome.

---

## Reporting issues

Please open a GitHub issue with:

- The package name and versions you were comparing
- What you expected to see
- What you actually saw (screenshot or error message)
- Browser + OS if it's a UI issue

---

Thanks for contributing!
