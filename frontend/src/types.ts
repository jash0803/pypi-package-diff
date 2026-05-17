export interface FileChange {
  path: string;
  status: "added" | "removed" | "modified";
  is_binary: boolean;
  diff: string | null;
  stats: {
    added_lines: number;
    removed_lines: number;
  };
}

// ── Changelog ──────────────────────────────────────────────────

export interface ParamInfo {
  name: string;
  annotation?: string;
  default?: string;
}

export interface ChangelogItem {
  kind: "function" | "class" | "method";
  name: string;
  module: string;
  parent: string | null;
  args: string[];
  params?: ParamInfo[];
  returns?: string | null;
  change?: "removed" | "signature_changed" | "return_type_changed";
  old_args?: string[];
  new_args?: string[];
  old_params?: ParamInfo[];
  new_params?: ParamInfo[];
  old_returns?: string | null;
  new_returns?: string | null;
}

export interface Changelog {
  new_features: ChangelogItem[];
  breaking_changes: ChangelogItem[];
}

// ── Security ───────────────────────────────────────────────────

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface Vulnerability {
  id: string;
  summary: string;
  aliases: string[];
  severity: Severity;
  fixed_versions: string[];
  url: string;
  published: string;
}

export interface SecurityDiff {
  v1_total: number;
  v2_total: number;
  fixed: Vulnerability[];
  introduced: Vulnerability[];
  persisting: Vulnerability[];
}

// ── Metadata ───────────────────────────────────────────────────

export interface DepInfo {
  name: string;
  raw: string;
  specifier: string;
  extras: string[];
  marker: string | null;
}

export interface DepChange {
  name: string;
  old: string;
  new: string;
}

export interface FieldDiff {
  old: string | null;
  new: string | null;
}

export interface MetadataDiff {
  requires_python?: FieldDiff;
  license?: FieldDiff;
  summary?: FieldDiff;
  home_page?: FieldDiff;
  dependencies?: {
    added: DepInfo[];
    removed: DepInfo[];
    changed: DepChange[];
    v1_total: number;
    v2_total: number;
  };
  classifiers?: {
    added: string[];
    removed: string[];
    unchanged: number;
  };
}

// ── Top-level diff result ──────────────────────────────────────

export interface DiffResult {
  package: string;
  v1: string;
  v2: string;
  artifact_v1: string;
  artifact_v2: string;
  summary: {
    added: number;
    removed: number;
    modified: number;
    total: number;
  };
  files: FileChange[];
  changelog: Changelog;
  security: SecurityDiff;
  metadata: MetadataDiff;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "remove" | "context" | "no-newline";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}
