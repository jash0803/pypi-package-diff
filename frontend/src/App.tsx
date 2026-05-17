import { useState, useEffect } from "react";
import { fetchDiff } from "./api";
import { DiffResult } from "./types";
import SearchForm from "./components/SearchForm";
import DiffView from "./components/DiffView";

type Theme = "dark" | "light";

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return [theme, toggle];
}

type State =
  | { phase: "home" }
  | { phase: "loading"; pkg: string; v1: string; v2: string }
  | { phase: "result"; result: DiffResult }
  | { phase: "error"; message: string; pkg: string; v1: string; v2: string };

function parseURL(): { pkg: string; v1: string; v2: string } | null {
  const p = new URLSearchParams(window.location.search);
  const pkg = p.get("pkg") ?? "";
  const v1 = p.get("v1") ?? "";
  const v2 = p.get("v2") ?? "";
  return pkg && v1 && v2 ? { pkg, v1, v2 } : null;
}

function pushURL(pkg: string, v1: string, v2: string) {
  const url = `?pkg=${encodeURIComponent(pkg)}&v1=${encodeURIComponent(v1)}&v2=${encodeURIComponent(v2)}`;
  window.history.pushState({}, "", url);
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [state, setState] = useState<State>({ phase: "home" });

  async function compare(pkg: string, v1: string, v2: string) {
    pushURL(pkg, v1, v2);
    setState({ phase: "loading", pkg, v1, v2 });
    try {
      const result = await fetchDiff(pkg, v1, v2);
      setState({ phase: "result", result });
    } catch (e) {
      setState({ phase: "error", message: (e as Error).message, pkg, v1, v2 });
    }
  }

  // Handle browser back/forward
  useEffect(() => {
    function onPop() {
      const parsed = parseURL();
      if (parsed) compare(parsed.pkg, parsed.v1, parsed.v2);
      else setState({ phase: "home" });
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load from URL on initial render
  useEffect(() => {
    const parsed = parseURL();
    if (parsed) compare(parsed.pkg, parsed.v1, parsed.v2);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isHome = state.phase === "home";

  function goHome() {
    window.history.pushState({}, "", "/");
    setState({ phase: "home" });
  }

  return (
    <div className="app">
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-logo" onClick={goHome}>
          <span className="topbar-logo-icon">📦</span>
          PyPI Diff
        </div>

        <div className="topbar-spacer" />

        {!isHome && (
          <button className="btn btn-ghost btn-sm" onClick={goHome}>
            ← Home
          </button>
        )}

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </header>

      {/* ── Content ── */}
      {state.phase === "home" && (
        <main className="hero">
          <div>
            <h1 className="hero-title">
              Compare <span>PyPI</span> packages
            </h1>
            <p className="hero-subtitle" style={{ marginTop: "12px" }}>
              Inspect what was actually shipped — not what's in the repo.
              Audit changes between any two published versions.
            </p>
          </div>

          <div className="hero-card">
            <SearchForm onCompare={compare} />
          </div>

          <div style={{ display: "flex", gap: "24px", color: "var(--text-muted)", fontSize: "13px", flexWrap: "wrap", justifyContent: "center" }}>
            <span>⚠ Breaking changes</span>
            <span>✦ What's new</span>
            <span>🛡 CVE scanning</span>
            <span>📦 Metadata diff</span>
            <span>🔍 File-by-file diff</span>
            <span>🔗 Shareable URLs</span>
          </div>
        </main>
      )}

      {state.phase === "loading" && (
        <div className="loading-wrap">
          <div className="spinner" />
          <div className="loading-text">
            Downloading {state.pkg} {state.v1} and {state.v2} from PyPI…
          </div>
        </div>
      )}

      {state.phase === "error" && (
        <div className="error-wrap">
          <div className="error-icon">⚠</div>
          <div className="error-msg">{state.message}</div>
          <div className="error-hint">
            Check that the package name and versions are correct, then try again.
          </div>
          <button
            className="btn btn-ghost"
            style={{ marginTop: "8px" }}
            onClick={() => compare(state.pkg, state.v1, state.v2)}
          >
            Retry
          </button>
        </div>
      )}

      {state.phase === "result" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <DiffView result={state.result} />
        </div>
      )}
    </div>
  );
}
