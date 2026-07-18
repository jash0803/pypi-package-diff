"""pypi-diff — terminal upgrade report for PyPI packages.

Usage:
    pypi-diff requests 2.28.0 2.29.0
    pypi-diff litellm                  # compares the two latest versions
    pypi-diff litellm 1.84.0           # compares 1.84.0 against the latest
    pypi-diff litellm 1.84.0 1.85.0 --check   # exit 1 on breaking changes / new CVEs
"""
import argparse
import asyncio
import json
import os
import sys

import analyzer
import differ
import meta_diff
import pypi_client
import security


# ── ANSI helpers ──────────────────────────────────────────────────────

def _use_color(no_color_flag: bool) -> bool:
    if no_color_flag or os.environ.get("NO_COLOR"):
        return False
    return sys.stdout.isatty()


class C:
    """Color codes, blanked out when color is disabled."""
    def __init__(self, enabled: bool):
        self.bold = "\033[1m" if enabled else ""
        self.dim = "\033[2m" if enabled else ""
        self.red = "\033[31m" if enabled else ""
        self.green = "\033[32m" if enabled else ""
        self.yellow = "\033[33m" if enabled else ""
        self.blue = "\033[34m" if enabled else ""
        self.reset = "\033[0m" if enabled else ""


def _sig(params: list[dict], returns: str | None) -> str:
    parts = []
    for p in params:
        s = p["name"]
        if p.get("annotation"):
            s += f": {p['annotation']}"
        if p.get("default"):
            s += f" = {p['default']}"
        parts.append(s)
    sig = f"({', '.join(parts)})"
    if returns:
        sig += f" -> {returns}"
    return sig


def _qualname(item: dict) -> str:
    name = f"{item['parent']}.{item['name']}" if item.get("parent") else item["name"]
    return f"{item['module']}.{name}"


# ── report rendering ─────────────────────────────────────────────────

def _print_report(result: dict, c: C, show_files: bool):
    pkg, v1, v2 = result["package"], result["v1"], result["v2"]
    s = result["summary"]

    print(f"\n{c.bold}{pkg}{c.reset} {v1} → {v2} "
          f"{c.dim}({result['artifact_v1']} vs {result['artifact_v2']}){c.reset}")
    print(f"{s['total']} files changed: "
          f"{c.green}+{s['added']}{c.reset} added, "
          f"{c.red}-{s['removed']}{c.reset} removed, "
          f"{c.yellow}~{s['modified']}{c.reset} modified\n")

    # Breaking changes
    breaking = result["changelog"]["breaking_changes"]
    header = f"{c.bold}Breaking changes{c.reset}"
    if breaking:
        print(f"{header} {c.red}({len(breaking)}){c.reset}")
        for b in breaking:
            kind = b["kind"][:3]
            if b["change"] == "removed":
                print(f"  {c.red}✖ removed{c.reset}  {c.dim}{kind}{c.reset} {_qualname(b)}")
            elif b["change"] == "signature_changed":
                print(f"  {c.yellow}~ signature{c.reset} {c.dim}{kind}{c.reset} {_qualname(b)}")
                print(f"      {c.red}- {_sig(b['old_params'], b.get('old_returns'))}{c.reset}")
                print(f"      {c.green}+ {_sig(b['new_params'], b.get('new_returns'))}{c.reset}")
            else:
                print(f"  {c.yellow}~ returns{c.reset}   {c.dim}{kind}{c.reset} {_qualname(b)}"
                      f"  {c.red}{b.get('old_returns')}{c.reset} → {c.green}{b.get('new_returns')}{c.reset}")
    else:
        print(f"{header} {c.green}none detected{c.reset}")

    # New API
    new = result["changelog"]["new_features"]
    if new:
        print(f"\n{c.bold}New public API{c.reset} {c.green}({len(new)}){c.reset}")
        for n in new[:20]:
            print(f"  {c.green}+{c.reset} {c.dim}{n['kind'][:3]}{c.reset} {_qualname(n)}")
        if len(new) > 20:
            print(f"  {c.dim}… and {len(new) - 20} more{c.reset}")

    # Security
    sec = result["security"]
    print(f"\n{c.bold}Security (OSV){c.reset}")
    if not (sec["fixed"] or sec["introduced"] or sec["persisting"]):
        print(f"  {c.green}✔ no known vulnerabilities in either version{c.reset}")
    else:
        for label, vulns, color in [
            ("fixed by upgrading", sec["fixed"], c.green),
            ("introduced", sec["introduced"], c.red),
            ("persisting", sec["persisting"], c.yellow),
        ]:
            for v in vulns:
                print(f"  {color}{v['id']}{c.reset} [{v.get('severity', 'UNKNOWN')}] "
                      f"{label} {c.dim}{v['url']}{c.reset}")

    # Metadata / dependencies
    meta = result.get("metadata") or {}
    deps = meta.get("dependencies")
    if deps and (deps["added"] or deps["removed"] or deps["changed"]):
        print(f"\n{c.bold}Dependencies{c.reset} "
              f"{c.dim}({deps['v1_total']} → {deps['v2_total']}){c.reset}")
        for d in deps["added"]:
            print(f"  {c.green}+ {d['raw']}{c.reset}")
        for d in deps["removed"]:
            print(f"  {c.red}- {d['raw']}{c.reset}")
        for d in deps["changed"]:
            print(f"  {c.yellow}~ {d['name']}{c.reset}  {c.dim}{d['old']} → {d['new']}{c.reset}")
    if meta.get("requires_python"):
        rp = meta["requires_python"]
        print(f"\n{c.bold}requires-python{c.reset}  {rp['old']} → {rp['new']}")

    if show_files:
        print(f"\n{c.bold}Files{c.reset}")
        for f in result["files"]:
            mark = {"added": f"{c.green}A", "removed": f"{c.red}D", "modified": f"{c.yellow}M"}[f["status"]]
            stats = f.get("stats") or {}
            print(f"  {mark}{c.reset} {f['path']} "
                  f"{c.dim}+{stats.get('additions', 0)} -{stats.get('deletions', 0)}{c.reset}")
    print()


# ── pipeline (mirrors the API endpoint) ──────────────────────────────

async def _run_diff(package: str, v1: str, v2: str) -> dict:
    (path1, art1), (path2, art2) = await asyncio.gather(
        pypi_client.download_package(package, v1),
        pypi_client.download_package(package, v2),
    )
    files1 = pypi_client.extract_package(path1)
    files2 = pypi_client.extract_package(path2)
    changes = differ.compare_packages(files1, files2)

    changelog, vulns1, vulns2, metadata = await asyncio.gather(
        asyncio.to_thread(analyzer.analyze_api_changes, files1, files2),
        security.query_vulnerabilities(package, v1),
        security.query_vulnerabilities(package, v2),
        asyncio.to_thread(meta_diff.diff_metadata, path1, path2),
    )

    return {
        "package": package,
        "v1": v1,
        "v2": v2,
        "artifact_v1": art1,
        "artifact_v2": art2,
        "summary": {
            "added": sum(1 for f in changes if f["status"] == "added"),
            "removed": sum(1 for f in changes if f["status"] == "removed"),
            "modified": sum(1 for f in changes if f["status"] == "modified"),
            "total": len(changes),
        },
        "files": changes,
        "changelog": changelog,
        "security": security.compute_security_diff(vulns1, vulns2),
        "metadata": metadata,
    }


async def _resolve_versions(package: str, v1: str | None, v2: str | None) -> tuple[str, str]:
    if v1 and v2:
        return v1, v2
    versions = await pypi_client.get_versions(package)
    if v1:
        if not versions:
            raise SystemExit(f"error: no published versions found for '{package}'")
        return v1, versions[-1]
    if len(versions) < 2:
        raise SystemExit(f"error: '{package}' has fewer than two published versions")
    return versions[-2], versions[-1]


def main():
    parser = argparse.ArgumentParser(
        prog="pypi-diff",
        description="Diff two published PyPI versions: breaking API changes, "
                    "new APIs, CVEs, dependencies, and file changes — "
                    "from the real uploaded artifacts.",
    )
    parser.add_argument("package", help="package name on PyPI")
    parser.add_argument("v1", nargs="?", help="from version (default: second-latest)")
    parser.add_argument("v2", nargs="?", help="to version (default: latest)")
    parser.add_argument("--json", action="store_true", help="emit the full diff as JSON")
    parser.add_argument("--files", action="store_true", help="also list every changed file")
    parser.add_argument("--check", action="store_true",
                        help="exit 1 if breaking changes or newly introduced CVEs are found")
    parser.add_argument("--no-color", action="store_true", help="disable colored output")
    args = parser.parse_args()

    async def run():
        v1, v2 = await _resolve_versions(args.package, args.v1, args.v2)
        if v1 == v2:
            raise SystemExit(f"error: both versions resolve to {v1}")
        return await _run_diff(args.package, v1, v2)

    try:
        result = asyncio.run(run())
    except SystemExit:
        raise
    except Exception as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status == 404:
            raise SystemExit(f"error: package '{args.package}' or one of its versions not found on PyPI")
        raise SystemExit(f"error: {exc}")

    if args.json:
        json.dump(result, sys.stdout, indent=2)
        print()
    else:
        _print_report(result, C(_use_color(args.no_color)), args.files)

    if args.check:
        failures = len(result["changelog"]["breaking_changes"]) + len(result["security"]["introduced"])
        if failures:
            sys.exit(1)


if __name__ == "__main__":
    main()
