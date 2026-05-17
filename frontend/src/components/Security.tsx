import { SecurityDiff, Vulnerability, Severity } from "../types";

interface Props {
  security: SecurityDiff;
  v1: string;
  v2: string;
}

const SEV_CLASS: Record<Severity, string> = {
  CRITICAL: "sev-critical",
  HIGH:     "sev-high",
  MEDIUM:   "sev-medium",
  LOW:      "sev-low",
  UNKNOWN:  "sev-unknown",
};

function SeverityBadge({ sev }: { sev: Severity }) {
  return <span className={`sev-badge ${SEV_CLASS[sev]}`}>{sev}</span>;
}

function VulnCard({ vuln }: { vuln: Vulnerability }) {
  return (
    <div className="vuln-card">
      <div className="vuln-header">
        <SeverityBadge sev={vuln.severity} />
        <a className="vuln-id" href={vuln.url} target="_blank" rel="noreferrer">
          {vuln.id}
        </a>
        {vuln.aliases.length > 0 && (
          <span className="vuln-aliases">{vuln.aliases.join(" · ")}</span>
        )}
        {vuln.published && (
          <span className="vuln-date">{vuln.published}</span>
        )}
      </div>
      {vuln.summary && <p className="vuln-summary">{vuln.summary}</p>}
      {vuln.fixed_versions.length > 0 && (
        <div className="vuln-fixed">
          Fixed in: {vuln.fixed_versions.map((v) => (
            <code key={v} className="vuln-version">{v}</code>
          ))}
        </div>
      )}
    </div>
  );
}

function VulnSection({
  title, icon, colorClass, vulns, emptyText,
}: {
  title: string; icon: string; colorClass: string;
  vulns: Vulnerability[]; emptyText?: string;
}) {
  return (
    <div className="cl-section">
      <div className={`cl-section-header ${colorClass}`}>
        <span className="cl-section-icon">{icon}</span>
        <span className="cl-section-title">{title}</span>
        <span className="cl-section-count">{vulns.length}</span>
      </div>
      <div className="cl-section-body">
        {vulns.length === 0 ? (
          <div className="cl-empty">{emptyText}</div>
        ) : (
          vulns.map((v) => <VulnCard key={v.id} vuln={v} />)
        )}
      </div>
    </div>
  );
}

export default function SecurityView({ security, v1, v2 }: Props) {
  const { introduced, fixed, persisting, v1_total, v2_total } = security;

  if (v1_total === 0 && v2_total === 0) {
    return (
      <div className="changelog-view">
        <div className="security-clean">
          <div className="security-clean-icon">✓</div>
          <div className="security-clean-title">No known vulnerabilities</div>
          <div className="security-clean-sub">
            Neither {v1} nor {v2} has reported CVEs in the OSV advisory database.
          </div>
        </div>
        <p className="cl-note">
          Powered by the <strong>OSV</strong> advisory database — the same source used by{" "}
          <strong>pip-audit</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="changelog-view">
      {/* Summary strip */}
      <div className="security-summary">
        <span>
          {v1} had <strong>{v1_total}</strong> {v1_total === 1 ? "vulnerability" : "vulnerabilities"}
        </span>
        <span className="sec-arrow">→</span>
        <span>
          {v2} has <strong>{v2_total}</strong>
        </span>
        {introduced.length > 0 && (
          <span className="sec-stat sec-stat-bad">+{introduced.length} introduced</span>
        )}
        {fixed.length > 0 && (
          <span className="sec-stat sec-stat-good">−{fixed.length} fixed</span>
        )}
      </div>

      {introduced.length > 0 && (
        <VulnSection
          title="Introduced in this version" icon="↑"
          colorClass="cl-header-breaking" vulns={introduced}
        />
      )}
      {fixed.length > 0 && (
        <VulnSection
          title="Fixed in this version" icon="↓"
          colorClass="cl-header-new" vulns={fixed}
        />
      )}
      {persisting.length > 0 && (
        <VulnSection
          title="Persisting in both versions" icon="·"
          colorClass="cl-header-warning" vulns={persisting}
        />
      )}

      <p className="cl-note">
        Powered by the <strong>OSV</strong> advisory database — the same source used by{" "}
        <strong>pip-audit</strong>.
      </p>
    </div>
  );
}
