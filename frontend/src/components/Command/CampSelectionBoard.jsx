// Responsibility: ANO Camp Selection Board — set slots/reserves/profile, then run
//   a live, explainable selection over the college cohort. Renders the ranked tiers
//   (Selected / Standby / Not selected / Unranked) with each cadet's reasons and
//   caveats, and drills into a cadet's Digital Twin.
// Layer: Command Center UI (Layer 4).
// Depends on: react-router-dom (useNavigate), api/decisionApi (getCampSelection),
//   campSelectionBoard.css. Rendered in the ANO shell (/ano/command/camp-selection).
// Must never be depended on by: backend code or the Intelligence/Decision layers.
// Visuals use hand-rolled SVG/CSS only (ADL-008 — no charting library yet).
//
// The board never decides — it ranks and explains. Every cadet carries a reason
// and any caveats (limited data, outstanding fine, declining trend) so the officer
// makes the call. Nothing here is persisted (the endpoint is read-only).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  AlertTriangle,
  Play,
  ChevronRight,
  ShieldCheck,
  Users,
  Scale,
  HelpCircle,
} from "lucide-react";
import { decisionApi } from "../../api/decisionApi";
import "./campSelectionBoard.css";

const PROFILES = [
  { value: "rdc", label: "RDC (Republic Day Camp)" },
  { value: "promotion", label: "Promotion Board" },
  { value: "certificate", label: "Certificate Camp" },
  { value: "general", label: "General" },
];

function band(score) {
  if (score == null) return "csb-none";
  if (score >= 75) return "csb-good";
  if (score >= 50) return "csb-warn";
  return "csb-bad";
}

// One cadet card, shared across every tier.
function SelectionCard({ row, tierClass, onOpen }) {
  return (
    <div className={`csb-card ${tierClass}`}>
      <div className="csb-card-head">
        <div className="csb-rankcol">
          {row.rank != null ? (
            <span className="csb-rank">#{row.rank}</span>
          ) : (
            <span className="csb-rank csb-rank-none">—</span>
          )}
        </div>
        <div className="csb-idcol">
          <h4 className="csb-name">{row.full_name || row.regimental_no}</h4>
          <p className="csb-meta">
            <span className="csb-mono">{row.regimental_no}</span>
            {row.rank_name ? <> · {row.rank_name}</> : null}
          </p>
        </div>
        <div className="csb-scorecol">
          {row.overall_score == null ? (
            <span className="csb-score csb-none">—</span>
          ) : (
            <span className={`csb-score ${band(row.overall_score)}`}>
              {Math.round(row.overall_score)}
            </span>
          )}
          <span className="csb-conf">
            {row.overall_confidence == null
              ? "—"
              : `${Math.round(row.overall_confidence * 100)}% conf`}
          </span>
        </div>
      </div>

      {Array.isArray(row.strengths) && row.strengths.length > 0 && (
        <div className="csb-chips">
          {row.strengths.map((s, i) => (
            <span key={i} className="csb-chip csb-chip-strength">{s}</span>
          ))}
        </div>
      )}

      {Array.isArray(row.caveats) && row.caveats.length > 0 && (
        <div className="csb-chips">
          {row.caveats.map((c, i) => (
            <span key={i} className="csb-chip csb-chip-caveat" title={c.detail || ""}>
              {c.label}
            </span>
          ))}
        </div>
      )}

      {Array.isArray(row.reasons) && row.reasons.length > 0 && (
        <p className="csb-reason">{row.reasons[0]}</p>
      )}

      <button className="csb-link-btn" onClick={() => onOpen(row.regimental_no)}>
        View Digital Twin <ChevronRight size={14} />
      </button>
    </div>
  );
}

function Tier({ icon, title, tierClass, rows, onOpen, defaultOpen = true, collapsible = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!rows || rows.length === 0) return null;
  return (
    <section className={`csb-tier ${tierClass}`}>
      <header
        className={`csb-tier-head ${collapsible ? "csb-clickable" : ""}`}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <span className="csb-tier-title">
          {icon} {title}
        </span>
        <span className="csb-tier-count">{rows.length}</span>
      </header>
      {open && (
        <div className="csb-grid">
          {rows.map((r) => (
            <SelectionCard
              key={r.regimental_no}
              row={r}
              tierClass={tierClass}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function CampSelectionBoard() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState("rdc");
  const [slots, setSlots] = useState(5);
  const [reserves, setReserves] = useState(2);
  const [minReadiness, setMinReadiness] = useState("");

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(
    async (params) => {
      const slotsNum = Number(params.slots);
      if (!Number.isInteger(slotsNum) || slotsNum < 1) {
        setError("Slots must be a whole number of at least 1.");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const query = {
          slots: slotsNum,
          reserves: Math.max(0, Number(params.reserves) || 0),
          profile: params.profile,
        };
        if (params.minReadiness !== "" && params.minReadiness != null) {
          query.minReadiness = Number(params.minReadiness);
        }
        const res = await decisionApi.getCampSelection(query);
        setResult(res.data || null);
      } catch (err) {
        if (err?.response?.status === 403) {
          setError("Only officers (ANO/SUO) can run the Camp Selection Board.");
        } else {
          setError(err?.response?.data?.message || "Failed to run the selection.");
        }
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Auto-run once with sensible defaults so the board isn't empty on arrival.
  useEffect(() => {
    run({ slots: 5, reserves: 2, profile: "rdc", minReadiness: "" });
  }, [run]);

  const handleSubmit = (e) => {
    e.preventDefault();
    run({ profile, slots, reserves, minReadiness });
  };

  const summary = result?.summary;
  const profileLabel = useMemo(
    () => PROFILES.find((p) => p.value === (result?.profile || profile))?.label || profile,
    [result, profile]
  );

  return (
    <div className="csb-page">
      {/* HERO + CONTROLS */}
      <div className="csb-hero">
        <div className="csb-hero-top">
          <div>
            <h1 className="csb-title">Camp Selection Board</h1>
            <p className="csb-sub">
              Rank the unit for a camp on readiness — every pick is explained, the board decides
            </p>
          </div>
          <div className="csb-badge"><Award size={16} /> {profileLabel}</div>
        </div>

        <form className="csb-controls" onSubmit={handleSubmit}>
          <label className="csb-field">
            <span>Profile</span>
            <select value={profile} onChange={(e) => setProfile(e.target.value)}>
              {PROFILES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="csb-field csb-field-sm">
            <span>Slots</span>
            <input
              type="number"
              min="1"
              value={slots}
              onChange={(e) => setSlots(e.target.value)}
            />
          </label>
          <label className="csb-field csb-field-sm">
            <span>Reserves</span>
            <input
              type="number"
              min="0"
              value={reserves}
              onChange={(e) => setReserves(e.target.value)}
            />
          </label>
          <label className="csb-field csb-field-sm">
            <span>Min readiness</span>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="none"
              value={minReadiness}
              onChange={(e) => setMinReadiness(e.target.value)}
            />
          </label>
          <button className="csb-btn" type="submit" disabled={loading}>
            <Play size={15} /> {loading ? "Running…" : "Run selection"}
          </button>
        </form>
      </div>

      {error && (
        <div className="csb-state csb-state-error">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* SUMMARY STRIP */}
      {summary && (
        <div className="csb-summary">
          <div className="csb-sum">
            <Users size={16} />
            <b>{summary.eligibleCount}</b> eligible
            {summary.unrankedCount ? <em> · {summary.unrankedCount} unranked</em> : null}
          </div>
          <div className="csb-sum">
            <ShieldCheck size={16} />
            <b>{summary.selectedCount}</b> selected · {summary.standbyCount} standby
          </div>
          <div className="csb-sum">
            <Scale size={16} />
            Cutoff <b>{summary.cutoffScore == null ? "—" : summary.cutoffScore}</b>
            {summary.averageSelectedScore != null ? (
              <em> · avg {summary.averageSelectedScore}</em>
            ) : null}
          </div>
          {summary.minReadiness != null && (
            <div className="csb-sum csb-sum-gate">
              Min readiness gate: <b>{summary.minReadiness}</b>
            </div>
          )}
        </div>
      )}

      {/* TIERS */}
      {loading && !result ? (
        <div className="csb-skeleton" />
      ) : result ? (
        result.summary.eligibleCount === 0 && result.unranked.length === 0 ? (
          <div className="csb-state csb-empty">No cadets found for your college.</div>
        ) : (
          <>
            <Tier
              icon={<ShieldCheck size={16} />}
              title="Selected"
              tierClass="csb-selected"
              rows={result.selected}
              onOpen={(reg) => navigate(`/ano/command/cadet/${encodeURIComponent(reg)}`)}
            />
            <Tier
              icon={<Award size={16} />}
              title="Standby / Reserve"
              tierClass="csb-standby"
              rows={result.standby}
              onOpen={(reg) => navigate(`/ano/command/cadet/${encodeURIComponent(reg)}`)}
            />
            <Tier
              icon={<Users size={16} />}
              title="Not selected"
              tierClass="csb-notsel"
              rows={result.notSelected}
              onOpen={(reg) => navigate(`/ano/command/cadet/${encodeURIComponent(reg)}`)}
              collapsible
              defaultOpen={false}
            />
            <Tier
              icon={<HelpCircle size={16} />}
              title="Unranked — needs a snapshot"
              tierClass="csb-unranked"
              rows={result.unranked}
              onOpen={(reg) => navigate(`/ano/command/cadet/${encodeURIComponent(reg)}`)}
              collapsible
              defaultOpen={false}
            />
          </>
        )
      ) : null}
    </div>
  );
}
