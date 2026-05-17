import { Changelog, ChangelogItem, ParamInfo } from "../types";

interface Props {
  changelog: Changelog;
}

function kindLabel(kind: ChangelogItem["kind"]) {
  return kind === "function" ? "fn" : kind === "class" ? "cls" : "mth";
}

function fmtParam(p: ParamInfo): string {
  let s = p.name;
  if (p.annotation) s += `: ${p.annotation}`;
  if (p.default) s += ` = ${p.default}`;
  return s;
}

// Align old/new params: walk both lists by name, inserting removals in-place.
type DiffedParam = ParamInfo & { status: "added" | "removed" | "changed" | "same" };

function diffParams(oldParams: ParamInfo[], newParams: ParamInfo[]): DiffedParam[] {
  const newByName = new Map(newParams.map((p) => [p.name, p]));
  const oldByName = new Map(oldParams.map((p) => [p.name, p]));
  const result: DiffedParam[] = [];
  let oldIdx = 0;

  for (const newP of newParams) {
    // Flush any old params before this one that were removed
    while (oldIdx < oldParams.length && oldParams[oldIdx].name !== newP.name) {
      if (!newByName.has(oldParams[oldIdx].name)) {
        result.push({ ...oldParams[oldIdx], status: "removed" });
      }
      oldIdx++;
    }
    if (oldIdx < oldParams.length) oldIdx++;

    if (oldByName.has(newP.name)) {
      const oldP = oldByName.get(newP.name)!;
      const changed = oldP.annotation !== newP.annotation || oldP.default !== newP.default;
      result.push({ ...newP, status: changed ? "changed" : "same" });
    } else {
      result.push({ ...newP, status: "added" });
    }
  }

  // Trailing removals
  for (; oldIdx < oldParams.length; oldIdx++) {
    if (!newByName.has(oldParams[oldIdx].name)) {
      result.push({ ...oldParams[oldIdx], status: "removed" });
    }
  }

  return result;
}

function DiffedSignature({ item }: { item: ChangelogItem }) {
  const sym = item.parent ? `${item.parent}.${item.name}` : item.name;
  const diffed = diffParams(item.old_params || [], item.new_params || []);

  return (
    <span className="cl-entry-name">
      <span className="cl-module">{item.module}</span>
      <span className="cl-sep"> › </span>
      <span className="cl-sym">{sym}</span>
      <span className="cl-args">
        {"("}
        {diffed.map((p, i) => (
          <span key={`${p.name}-${i}`} className={`cl-param-${p.status}`}>
            {fmtParam(p)}
            {i < diffed.length - 1 ? ", " : ""}
          </span>
        ))}
        {")"}
        {item.new_returns ? <span> → {item.new_returns}</span> : null}
      </span>
    </span>
  );
}

function PlainSignature({ item }: { item: ChangelogItem }) {
  const sym = item.parent ? `${item.parent}.${item.name}` : item.name;
  if (item.kind === "class") {
    return (
      <span className="cl-entry-name">
        <span className="cl-module">{item.module}</span>
        <span className="cl-sep"> › </span>
        <span className="cl-sym">{sym}</span>
      </span>
    );
  }
  const params = (item.params || []).map(fmtParam).join(", ")
    || (item.args || []).join(", ");
  const ret = item.returns ? ` → ${item.returns}` : "";
  return (
    <span className="cl-entry-name">
      <span className="cl-module">{item.module}</span>
      <span className="cl-sep"> › </span>
      <span className="cl-sym">{sym}</span>
      <span className="cl-args">({params}){ret}</span>
    </span>
  );
}

function ChangelogEntry({ item, type }: { item: ChangelogItem; type: "new" | "breaking" }) {
  return (
    <div className={`cl-entry cl-entry-${type}`}>
      <span className={`cl-kind-badge cl-kind-${item.kind}`}>{kindLabel(item.kind)}</span>
      <div className="cl-entry-body">
        {item.change === "signature_changed"
          ? <DiffedSignature item={item} />
          : <PlainSignature item={item} />}

        {item.change === "return_type_changed" && (
          <div className="cl-sig-row">
            <span className="cl-sig-label">returns</span>
            <span className="cl-sig-old">{item.old_returns || "none"}</span>
            <span className="cl-sig-arrow">→</span>
            <span className="cl-sig-new">{item.new_returns || "none"}</span>
          </div>
        )}
      </div>
      {item.change === "removed" && <span className="cl-pill cl-pill-removed">removed</span>}
      {item.change === "signature_changed" && <span className="cl-pill cl-pill-changed">sig changed</span>}
      {item.change === "return_type_changed" && <span className="cl-pill cl-pill-changed">return type</span>}
    </div>
  );
}

function Section({
  title, icon, colorClass, items, type, emptyText,
}: {
  title: string; icon: string; colorClass: string;
  items: ChangelogItem[]; type: "new" | "breaking"; emptyText: string;
}) {
  return (
    <div className="cl-section">
      <div className={`cl-section-header ${colorClass}`}>
        <span className="cl-section-icon">{icon}</span>
        <span className="cl-section-title">{title}</span>
        <span className={`cl-section-count ${items.length > 0 ? `cl-count-${type}` : ""}`}>
          {items.length}
        </span>
      </div>
      <div className="cl-section-body">
        {items.length === 0 ? (
          <div className="cl-empty">{emptyText}</div>
        ) : (
          items.map((item, i) => <ChangelogEntry key={i} item={item} type={type} />)
        )}
      </div>
    </div>
  );
}

export default function ChangelogView({ changelog }: Props) {
  const { breaking_changes, new_features } = changelog;
  return (
    <div className="changelog-view">
      <Section
        title="Breaking Changes" icon="⚠"
        colorClass={breaking_changes.length > 0 ? "cl-header-breaking" : "cl-header-neutral"}
        items={breaking_changes} type="breaking"
        emptyText="No breaking changes detected in the public Python API."
      />
      <Section
        title="What's New" icon="✦"
        colorClass={new_features.length > 0 ? "cl-header-new" : "cl-header-neutral"}
        items={new_features} type="new"
        emptyText="No new public API additions detected."
      />
      <p className="cl-note">
        Powered by <strong>griffe</strong>. Covers public symbols in <code>.py</code> files —
        private names (prefixed <code>_</code>) are excluded. Includes type annotations when present.
      </p>
    </div>
  );
}
