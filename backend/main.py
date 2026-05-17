"""PyPI Package Diff — FastAPI backend."""
import asyncio
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import analyzer
import differ
import meta_diff
import pypi_client
import security

app = FastAPI(title="PyPI Package Diff")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/packages/{package}/versions")
async def get_versions(package: str):
    try:
        versions = await pypi_client.get_versions(package)
    except Exception as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status == 404:
            raise HTTPException(404, f"Package '{package}' not found on PyPI")
        raise HTTPException(502, f"PyPI error: {exc}")
    return {"package": package, "versions": versions}


@app.get("/api/packages/{package}/diff/{v1}/{v2}")
async def get_diff(package: str, v1: str, v2: str):
    try:
        (path1, art1), (path2, art2) = await asyncio.gather(
            pypi_client.download_package(package, v1),
            pypi_client.download_package(package, v2),
        )
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    except Exception as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status == 404:
            raise HTTPException(404, f"Package '{package}' or one of its versions not found")
        raise HTTPException(502, f"Download error: {exc}")

    files1 = pypi_client.extract_package(path1)
    files2 = pypi_client.extract_package(path2)

    changes = differ.compare_packages(files1, files2)

    changelog, vulns1, vulns2, metadata = await asyncio.gather(
        asyncio.to_thread(analyzer.analyze_api_changes, files1, files2),
        security.query_vulnerabilities(package, v1),
        security.query_vulnerabilities(package, v2),
        asyncio.to_thread(meta_diff.diff_metadata, path1, path2),
    )

    security_result = security.compute_security_diff(vulns1, vulns2)

    added   = sum(1 for f in changes if f["status"] == "added")
    removed = sum(1 for f in changes if f["status"] == "removed")
    modified = sum(1 for f in changes if f["status"] == "modified")

    return {
        "package": package,
        "v1": v1,
        "v2": v2,
        "artifact_v1": art1,
        "artifact_v2": art2,
        "summary": {
            "added": added,
            "removed": removed,
            "modified": modified,
            "total": len(changes),
        },
        "files": changes,
        "changelog": changelog,
        "security": security_result,
        "metadata": metadata,
    }


# Serve the built frontend in production
_frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if _frontend_dist.exists():
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file = _frontend_dist / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(_frontend_dist / "index.html")

    app.mount("/assets", StaticFiles(directory=_frontend_dist / "assets"), name="assets")
