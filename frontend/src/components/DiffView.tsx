import { useState } from "react";
import { DiffResult } from "../types";
import SummaryBar from "./SummaryBar";
import FileSidebar from "./FileSidebar";
import DiffPanel from "./DiffPanel";
import ChangelogView from "./Changelog";
import SecurityView from "./Security";
import MetaDiffView from "./MetaDiff";

interface Props {
  result: DiffResult;
}

type Tab = "changelog" | "security" | "metadata" | "files";

function defaultTab(result: DiffResult): Tab {
  if (result.security.introduced.length > 0) return "security";
  if (
    result.changelog.breaking_changes.length > 0 ||
    result.changelog.new_features.length > 0
  )
    return "changelog";
  return "files";
}

export default function DiffView({ result }: Props) {
  const [tab, setTab] = useState<Tab>(() => defaultTab(result));
  const [selected, setSelected] = useState<string | null>(
    result.files.length > 0 ? result.files[0].path : null
  );

  const selectedFile = result.files.find((f) => f.path === selected) ?? null;
  const { breaking_changes, new_features } = result.changelog;
  const { introduced, v2_total } = result.security;
  const totalVulns = v2_total;

  if (result.files.length === 0) {
    return (
      <div className="empty-result">
        <div className="empty-result-icon">✓</div>
        <div className="empty-result-title">No differences found</div>
        <div className="empty-result-sub">
          {result.package} {result.v1} and {result.v2} are identical.
        </div>
      </div>
    );
  }

  return (
    <>
      <SummaryBar result={result} />

      <div className="tab-bar">
        {/* Changelog tab */}
        <button
          className={`tab-btn ${tab === "changelog" ? "active" : ""}`}
          onClick={() => setTab("changelog")}
        >
          Changelog
          {breaking_changes.length > 0 ? (
            <span className="tab-count tab-count-breaking">{breaking_changes.length} breaking</span>
          ) : new_features.length > 0 ? (
            <span className="tab-count tab-count-new">{new_features.length} new</span>
          ) : (
            <span className="tab-count">0</span>
          )}
        </button>

        {/* Security tab */}
        <button
          className={`tab-btn ${tab === "security" ? "active" : ""}`}
          onClick={() => setTab("security")}
        >
          Security
          {introduced.length > 0 ? (
            <span className="tab-count tab-count-breaking">{introduced.length} new</span>
          ) : totalVulns > 0 ? (
            <span className="tab-count tab-count-warn">{totalVulns} known</span>
          ) : (
            <span className="tab-count tab-count-new">✓ clean</span>
          )}
        </button>

        {/* Metadata tab */}
        <button
          className={`tab-btn ${tab === "metadata" ? "active" : ""}`}
          onClick={() => setTab("metadata")}
        >
          Metadata
        </button>

        {/* Files tab */}
        <button
          className={`tab-btn ${tab === "files" ? "active" : ""}`}
          onClick={() => setTab("files")}
        >
          Files
          <span className="tab-count">{result.files.length}</span>
        </button>
      </div>

      {tab === "changelog" && (
        <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          <ChangelogView changelog={result.changelog} />
        </div>
      )}

      {tab === "security" && (
        <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          <SecurityView security={result.security} v1={result.v1} v2={result.v2} />
        </div>
      )}

      {tab === "metadata" && (
        <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          <MetaDiffView metadata={result.metadata} v1={result.v1} v2={result.v2} />
        </div>
      )}

      {tab === "files" && (
        <div className="diff-layout">
          <FileSidebar
            files={result.files}
            selected={selected}
            onSelect={setSelected}
          />
          <DiffPanel file={selectedFile} />
        </div>
      )}
    </>
  );
}
