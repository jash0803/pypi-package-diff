"""Security vulnerability lookup via the OSV API (same database as pip-audit)."""
import httpx

_OSV_QUERY = "https://api.osv.dev/v1/query"
_SEV_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "UNKNOWN": 4}


def _extract_severity(v: dict) -> str:
    # GitHub Advisory Database exposes severity in database_specific
    db = v.get("database_specific", {})
    if sev := db.get("severity"):
        s = sev.upper()
        return "MEDIUM" if s == "MODERATE" else s
    # Some ecosystems use ecosystem_specific
    for affected in v.get("affected", []):
        es = affected.get("ecosystem_specific", {})
        if sev := es.get("severity"):
            s = sev.upper()
            return "MEDIUM" if s == "MODERATE" else s
    return "UNKNOWN"


def _extract_fixed_versions(v: dict, package: str) -> list[str]:
    fixed: list[str] = []
    for affected in v.get("affected", []):
        pkg = affected.get("package", {})
        if pkg.get("ecosystem") != "PyPI":
            continue
        if pkg.get("name", "").lower() != package.lower():
            continue
        for rng in affected.get("ranges", []):
            for event in rng.get("events", []):
                if "fixed" in event:
                    fixed.append(event["fixed"])
    return fixed


async def query_vulnerabilities(package: str, version: str) -> list[dict]:
    payload = {
        "package": {"name": package, "ecosystem": "PyPI"},
        "version": version,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(_OSV_QUERY, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    vulns: list[dict] = []
    for v in data.get("vulns", []):
        vid = v.get("id", "")
        vulns.append({
            "id": vid,
            "summary": (v.get("summary") or v.get("details") or "")[:200],
            "aliases": sorted(v.get("aliases") or []),
            "severity": _extract_severity(v),
            "fixed_versions": _extract_fixed_versions(v, package),
            "url": f"https://osv.dev/vulnerability/{vid}",
            "published": (v.get("published") or "")[:10],
        })

    return vulns


def compute_security_diff(v1_vulns: list[dict], v2_vulns: list[dict]) -> dict:
    v1_ids = {v["id"] for v in v1_vulns}
    v2_ids = {v["id"] for v in v2_vulns}
    v1_by_id = {v["id"]: v for v in v1_vulns}
    v2_by_id = {v["id"]: v for v in v2_vulns}

    _sev = lambda v: _SEV_ORDER.get(v.get("severity", "UNKNOWN"), 4)
    return {
        "v1_total": len(v1_vulns),
        "v2_total": len(v2_vulns),
        "fixed":      sorted([v1_by_id[i] for i in v1_ids - v2_ids], key=_sev),
        "introduced": sorted([v2_by_id[i] for i in v2_ids - v1_ids], key=_sev),
        "persisting": sorted([v2_by_id[i] for i in v1_ids & v2_ids], key=_sev),
    }
