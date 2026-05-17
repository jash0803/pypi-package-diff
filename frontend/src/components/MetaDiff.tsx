import { MetadataDiff, DepInfo, DepChange, FieldDiff } from "../types";

interface Props {
  metadata: MetadataDiff;
  v1: string;
  v2: string;
}

function FieldRow({ label, diff }: { label: string; diff: FieldDiff }) {
  return (
    <div className="meta-field-row">
      <span className="meta-field-label">{label}</span>
      <span className="meta-field-old">{diff.old ?? <em className="meta-none">none</em>}</span>
      <span className="meta-field-arrow">→</span>
      <span className="meta-field-new">{diff.new ?? <em className="meta-none">none</em>}</span>
    </div>
  );
}

function DepRow({ dep, badge }: { dep: DepInfo | DepChange; badge: "added" | "removed" | "changed" }) {
  const isChange = badge === "changed";
  const d = dep as DepChange;
  const a = dep as DepInfo;
  return (
    <div className="dep-row">
      <span className={`dep-badge dep-badge-${badge}`}>{badge}</span>
      {isChange ? (
        <>
          <code className="dep-name">{d.name}</code>
          <span className="dep-old">{d.old}</span>
          <span className="dep-arrow">→</span>
          <code className="dep-new">{d.new}</code>
        </>
      ) : (
        <code className="dep-raw">{a.raw}</code>
      )}
    </div>
  );
}

function MetaSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="cl-section">
      <div className="cl-section-header cl-header-neutral">
        <span className="cl-section-icon">{icon}</span>
        <span className="cl-section-title">{title}</span>
      </div>
      <div className="cl-section-body meta-section-body">{children}</div>
    </div>
  );
}

export default function MetaDiffView({ metadata, v1, v2 }: Props) {
  const hasFields = metadata.requires_python || metadata.license || metadata.summary || metadata.home_page;
  const deps = metadata.dependencies;
  const clf = metadata.classifiers;
  const hasDepsChanges = deps && (deps.added.length + deps.removed.length + deps.changed.length > 0);
  const hasClfChanges = clf && (clf.added.length + clf.removed.length > 0);

  if (!hasFields && !hasDepsChanges && !hasClfChanges) {
    return (
      <div className="changelog-view">
        <div className="security-clean">
          <div className="security-clean-icon">≡</div>
          <div className="security-clean-title">No metadata changes</div>
          <div className="security-clean-sub">
            Package metadata is identical between {v1} and {v2}.
          </div>
        </div>
        <p className="cl-note">Powered by <strong>pkginfo</strong>.</p>
      </div>
    );
  }

  return (
    <div className="changelog-view">
      {hasFields && (
        <MetaSection title="Package Fields" icon="≡">
          {metadata.requires_python && (
            <FieldRow label="Python requirement" diff={metadata.requires_python} />
          )}
          {metadata.license && <FieldRow label="License" diff={metadata.license} />}
          {metadata.summary && <FieldRow label="Summary" diff={metadata.summary} />}
          {metadata.home_page && <FieldRow label="Home page" diff={metadata.home_page} />}
        </MetaSection>
      )}

      {deps && (
        <MetaSection
          title={`Dependencies  (${v1}: ${deps.v1_total}  →  ${v2}: ${deps.v2_total})`}
          icon="⬡"
        >
          {!hasDepsChanges ? (
            <div className="cl-empty">No dependency changes.</div>
          ) : (
            <>
              {deps.added.map((d) => <DepRow key={d.name} dep={d} badge="added" />)}
              {deps.removed.map((d) => <DepRow key={d.name} dep={d} badge="removed" />)}
              {deps.changed.map((d) => <DepRow key={d.name} dep={d} badge="changed" />)}
            </>
          )}
        </MetaSection>
      )}

      {clf && hasClfChanges && (
        <MetaSection title="Classifiers" icon="⊞">
          {clf.added.map((c) => (
            <div key={c} className="clf-row">
              <span className="dep-badge dep-badge-added">added</span>
              <span className="clf-text">{c}</span>
            </div>
          ))}
          {clf.removed.map((c) => (
            <div key={c} className="clf-row">
              <span className="dep-badge dep-badge-removed">removed</span>
              <span className="clf-text">{c}</span>
            </div>
          ))}
        </MetaSection>
      )}

      <p className="cl-note">Powered by <strong>pkginfo</strong>.</p>
    </div>
  );
}
