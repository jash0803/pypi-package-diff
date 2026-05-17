"""Python API change analyzer using griffe for type-aware analysis."""
import logging
import shutil
import tempfile
from pathlib import Path

import griffe

logging.getLogger("griffe").setLevel(logging.ERROR)

_SKIP_PREFIXES = ("_", ".", "test", "setup", "conf")
_ALLOWED_DUNDER = {"__init__", "__call__", "__new__"}


def _write_tmpdir(files: dict[str, bytes]) -> Path:
    tmpdir = Path(tempfile.mkdtemp(prefix="pypi-diff-"))
    for rel_path, content in files.items():
        dest = tmpdir / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
    return tmpdir


def _fmt_param(p: griffe.Parameter) -> dict:
    d: dict = {"name": p.name}
    if p.annotation is not None:
        d["annotation"] = str(p.annotation)
    if p.default is not None:
        d["default"] = str(p.default)
    return d


def _collect(
    obj: griffe.Object,
    out: dict[str, dict],
    *,
    module_path: str = "",
    class_name: str | None = None,
):
    for name, member in obj.members.items():
        if isinstance(member, griffe.Alias):
            continue

        if isinstance(member, griffe.Module):
            sub = f"{module_path}.{name}" if module_path else name
            _collect(member, out, module_path=sub, class_name=None)

        elif isinstance(member, griffe.Class):
            if name.startswith("_"):
                continue
            key = f"{module_path}::{name}"
            out[key] = {
                "kind": "class",
                "name": name,
                "module": module_path,
                "parent": None,
                "args": [],
                "params": [],
                "returns": None,
            }
            _collect(member, out, module_path=module_path, class_name=name)

        elif isinstance(member, griffe.Function):
            if name.startswith("_") and name not in _ALLOWED_DUNDER:
                continue
            params = [
                _fmt_param(p) for p in member.parameters
                if p.name not in ("self", "cls")
            ]
            kind = "method" if class_name else "function"
            qualified = f"{class_name}.{name}" if class_name else name
            key = f"{module_path}::{qualified}"
            out[key] = {
                "kind": kind,
                "name": name,
                "module": module_path,
                "parent": class_name,
                "args": [p["name"] for p in params],
                "params": params,
                "returns": str(member.returns) if member.returns is not None else None,
            }


def _extract_api(files: dict[str, bytes]) -> dict[str, dict]:
    tmpdir = _write_tmpdir(files)
    out: dict[str, dict] = {}
    try:
        for entry in sorted(tmpdir.iterdir()):
            if any(entry.name.startswith(p) for p in _SKIP_PREFIXES):
                continue
            if entry.is_dir() and (entry / "__init__.py").exists():
                try:
                    pkg = griffe.load(entry.name, search_paths=[str(tmpdir)])
                    _collect(pkg, out, module_path=entry.name)
                except Exception:
                    pass
            elif entry.is_file() and entry.suffix == ".py":
                try:
                    mod = griffe.load(entry.stem, search_paths=[str(tmpdir)])
                    _collect(mod, out, module_path=entry.name)
                except Exception:
                    pass
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
    return out


def analyze_api_changes(files1: dict[str, bytes], files2: dict[str, bytes]) -> dict:
    api1 = _extract_api(files1)
    api2 = _extract_api(files2)

    new_features: list[dict] = []
    for key, item in api2.items():
        if key not in api1:
            new_features.append(item)

    breaking_changes: list[dict] = []
    for key, item in api1.items():
        if key not in api2:
            breaking_changes.append({**item, "change": "removed"})
        else:
            item2 = api2[key]
            if item["args"] != item2["args"]:
                breaking_changes.append({
                    **item,
                    "change": "signature_changed",
                    "old_args": item["args"],
                    "new_args": item2["args"],
                    "old_params": item.get("params", []),
                    "new_params": item2.get("params", []),
                    "old_returns": item.get("returns"),
                    "new_returns": item2.get("returns"),
                })
            elif item.get("returns") != item2.get("returns"):
                breaking_changes.append({
                    **item,
                    "change": "return_type_changed",
                    "old_returns": item.get("returns"),
                    "new_returns": item2.get("returns"),
                })

    _skey = lambda x: (x["module"], x.get("parent") or "", x["name"])
    new_features.sort(key=_skey)
    breaking_changes.sort(key=_skey)

    return {"new_features": new_features, "breaking_changes": breaking_changes}
