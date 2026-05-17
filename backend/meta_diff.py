"""Package metadata comparison using pkginfo."""
from pathlib import Path
from typing import Optional

import pkginfo
from packaging.requirements import InvalidRequirement, Requirement


def _get_metadata(path: Path) -> Optional[pkginfo.Distribution]:
    name = path.name
    try:
        if name.endswith(".whl"):
            return pkginfo.Wheel(str(path))
        elif name.endswith((".tar.gz", ".tgz", ".zip")):
            return pkginfo.SDist(str(path))
    except Exception:
        return None


def _parse_deps(requires: tuple | None) -> dict[str, dict]:
    deps: dict[str, dict] = {}
    for req_str in (requires or []):
        try:
            req = Requirement(req_str)
            key = req.name.lower().replace("-", "_").replace(".", "_")
            deps[key] = {
                "raw": req_str,
                "name": req.name,
                "specifier": str(req.specifier),
                "extras": sorted(req.extras),
                "marker": str(req.marker) if req.marker else None,
            }
        except InvalidRequirement:
            pass
    return deps


def _field_diff(a, b) -> Optional[dict]:
    old = (a or "").strip()
    new = (b or "").strip()
    if old == new:
        return None
    return {"old": old or None, "new": new or None}


def diff_metadata(path1: Path, path2: Path) -> dict:
    m1 = _get_metadata(path1)
    m2 = _get_metadata(path2)
    if not m1 or not m2:
        return {}

    deps1 = _parse_deps(m1.requires_dist)
    deps2 = _parse_deps(m2.requires_dist)
    all_names = set(deps1) | set(deps2)

    added_deps, removed_deps, changed_deps = [], [], []
    for name in sorted(all_names):
        if name not in deps1:
            added_deps.append(deps2[name])
        elif name not in deps2:
            removed_deps.append(deps1[name])
        elif (deps1[name]["specifier"] != deps2[name]["specifier"] or
              deps1[name]["extras"] != deps2[name]["extras"]):
            changed_deps.append({
                "name": deps1[name]["name"],
                "old": deps1[name]["raw"],
                "new": deps2[name]["raw"],
            })

    clf1 = set(m1.classifiers or [])
    clf2 = set(m2.classifiers or [])

    result: dict = {
        "dependencies": {
            "added":   added_deps,
            "removed": removed_deps,
            "changed": changed_deps,
            "v1_total": len(deps1),
            "v2_total": len(deps2),
        },
        "classifiers": {
            "added":     sorted(clf2 - clf1),
            "removed":   sorted(clf1 - clf2),
            "unchanged": len(clf1 & clf2),
        },
    }

    for field_name, attr in [
        ("requires_python", "requires_python"),
        ("license", "license"),
        ("summary", "summary"),
        ("home_page", "home_page"),
    ]:
        diff = _field_diff(getattr(m1, attr, None), getattr(m2, attr, None))
        if diff:
            result[field_name] = diff

    return result
