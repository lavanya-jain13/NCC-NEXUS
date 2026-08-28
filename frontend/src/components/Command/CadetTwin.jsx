// Responsibility: Cadet Digital Twin screen — displays the cadet's attendance
//   readiness snapshot (score, confidence, trend, explanation, evidence) from
//   /api/intel, with a manual recompute action.
// Layer: Command Center UI (Layer 4).
// Depends on: react-router-dom (useParams), api/intelApi, cadetTwin.css, lucide-react.
// Must never be depended on by: backend code or the Intelligence/Decision layers.
// Visuals use hand-rolled SVG/CSS only (ADL-008 — no charting library yet) and
// reuse the app design tokens from dashboard.css.

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Gauge,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarDays,
  RefreshCw,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { intelApi } from "../../api/intelApi";
import "./cadetTwin.css";

// Read the cadet's own regimental_no from the JWT (no auth state change needed).
function selfRegimentalNo() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return "";
    const payload = token.split(".")[1];
    if (!payload) return "";
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json?.regimental_no || "";
  } catch {
    return "";
  }
}

function band(score) {
  if (score == null) return "twin-none";
  if (score >= 75) return "twin-good";
  if (score >= 50) return "twin-warn";
  return "twin-bad";
}

function ringColor(score) {
  if (score == null) return "#8b90a8";
  if (score >= 75) return "#00897b";
  if (score >= 50) return "#ef6c00";
  return "#e53935";
}

const TREND = {
  improving: { label: "Improving", Icon: TrendingUp },
  declining: { label: "Declining", Icon: TrendingDown },
  stable: { label: "Stable", Icon: Minus },
  insufficient_data: { label: "Insufficient data", Icon: Minus },
};

function ScoreRing({ score }) {
  const r = 74;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const offset = c * (1 - pct / 100);
  return (
    <div className="twin-ring-wrap">
      <svg width="184" height="184" viewBox="0 0 184 184">
        <circle cx="92" cy="92" r={r} className="twin-ring-track" />
        <circle
          cx="92"
          cy="92"
          r={r}
          className="twin-ring-value"
          stroke={ringColor(score)}
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 92 92)"
        />
      </svg>
      <div className="twin-ring-center">
        <div className={`twin-ring-num ${band(score)}`}>
          {score == null ? "—" : Math.round(score)}
        </div>
        <div className="twin-ring-lbl">Readiness</div>
      </div>
    </div>
  );
}

function Meter({ value, note }) {
  const pct = Math.round((value ?? 0) * 100);
  return (
    <div className="twin-meter">
      <div className="twin-meter-head">
        <span>Confidence in this score</span>
        <span>{pct}%</span>
      </div>
      <div className="twin-meter-track">
        <div className="twin-meter-fill" style={{ width: `${pct}%` }} />
      </div>
      {note && <div className="twin-meter-note">{note}</div>}
    </div>
  );
}

export default function CadetTwin({ embedded = false }) {
  const params = useParams();
  const regimentalNo = params.regimentalNo || selfRegimentalNo();

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsCompute, setNeedsCompute] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const load = useCallback(async () => {
    if (!regimentalNo) {
      setLoading(false);
      setError("No regimental number found for this session.");
      return;
    }
    setLoading(true);
    setError("");
    setNeedsCompute(false);
    try {
      const res = await intelApi.getCadetReadiness(regimentalNo);
      setSnapshot(res.data);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        setNeedsCompute(true);
        setSnapshot(null);
      } else if (status === 403) {
        setError("You are not authorised to view this cadet's readiness.");
      } else {
        setError(err?.response?.data?.message || "Unable to load readiness data.");
      }
    } finally {
      setLoading(false);
    }
  }, [regimentalNo]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRecompute = async () => {
    setRecomputing(true);
    setError("");
    try {
      const res = await intelApi.recompute(regimentalNo);
      setSnapshot(res.data);
      setNeedsCompute(false);
    } catch (err) {
      setError(err?.response?.data?.message || "Recompute failed. Please try again.");
    } finally {
      setRecomputing(false);
    }
  };

  const attendance = snapshot?.pillars?.attendance;
  const ev = attendance?.evidence;
  const trendKey = attendance?.trend || "stable";
  const trend = TREND[trendKey] || TREND.stable;
  const TrendIcon = trend.Icon;
  const confidence = snapshot?.overall_confidence ?? 0;

  return (
    <div className={`twin-module ${embedded ? "" : "twin-standalone"}`}>
      {/* HERO */}
      <div className="twin-hero">
        <div>
          <h1 className="twin-hero-title">Cadet Digital Twin</h1>
          <p className="twin-hero-sub">
            Explainable readiness intelligence ·{" "}
            <span className="twin-regno">{regimentalNo || "—"}</span>
          </p>
        </div>
        <div className="twin-hero-actions">
          <button
            className="twin-btn"
            onClick={handleRecompute}
            disabled={recomputing || !regimentalNo}
          >
            <RefreshCw size={15} className={recomputing ? "twin-spin" : ""} />
            {recomputing ? "Computing…" : "Recompute"}
          </button>
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <>
          <div className="twin-skeleton" />
          <div className="twin-skeleton" style={{ height: 210 }} />
        </>
      )}

      {/* ERROR */}
      {!loading && error && (
        <div className="twin-state twin-state-error">
          <div className="twin-state-ic">
            <AlertTriangle size={26} />
          </div>
          <h4>Could not load readiness</h4>
          <p>{error}</p>
          <button className="twin-btn twin-btn-ghost" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {/* EMPTY */}
      {!loading && needsCompute && !error && (
        <div className="twin-state">
          <div className="twin-state-ic">
            <Sparkles size={26} />
          </div>
          <h4>No readiness snapshot yet</h4>
          <p>
            Generate the first snapshot to see attendance readiness, confidence and trend.
          </p>
          <button className="twin-btn" onClick={handleRecompute} disabled={recomputing}>
            <RefreshCw size={15} />
            {recomputing ? "Computing…" : "Compute readiness"}
          </button>
        </div>
      )}

      {/* DATA */}
      {!loading && snapshot && !error && (
        <>
          <div className="twin-stats">
            <div className="twin-stat">
              <div className="twin-stat-icon twin-ic-indigo">
                <Gauge size={20} />
              </div>
              <div className="twin-stat-info">
                <h3 className={band(snapshot.overall_score)}>
                  {snapshot.overall_score == null ? "—" : `${Math.round(snapshot.overall_score)}%`}
                </h3>
                <p>Overall Readiness</p>
              </div>
            </div>

            <div className="twin-stat">
              <div className="twin-stat-icon twin-ic-navy">
                <ShieldCheck size={20} />
              </div>
              <div className="twin-stat-info">
                <h3>{Math.round(confidence * 100)}%</h3>
                <p>Data Confidence</p>
              </div>
            </div>

            <div className="twin-stat">
              <div className="twin-stat-icon twin-ic-teal">
                <TrendIcon size={20} />
              </div>
              <div className="twin-stat-info">
                <h3>{trend.label}</h3>
                <p>Attendance Trend</p>
              </div>
            </div>

            <div className="twin-stat">
              <div className="twin-stat-icon twin-ic-red">
                <CalendarDays size={20} />
              </div>
              <div className="twin-stat-info">
                <h3>{ev?.scorableDrills ?? 0}</h3>
                <p>Drills Assessed</p>
              </div>
            </div>
          </div>

          <h2 className="twin-section-title">Readiness Overview</h2>
          <div className="twin-readiness">
            <ScoreRing score={snapshot.overall_score} />
            <div className="twin-readiness-body">
              <div className="twin-readiness-head">
                <h3>Overall Readiness</h3>
                <span className={`twin-trend twin-trend-${trendKey}`}>
                  <TrendIcon size={13} />
                  {trend.label}
                </span>
              </div>
              <p className="twin-explain">{attendance?.explanation}</p>
              <Meter
                value={confidence}
                note={
                  confidence < 1
                    ? "Confidence rises as more drills are recorded. A low score is never assumed from missing data."
                    : "Backed by sufficient drill history."
                }
              />
              <div className="twin-meter-note" style={{ marginTop: 12 }}>
                Computed:{" "}
                {snapshot.computed_at
                  ? new Date(snapshot.computed_at).toLocaleString()
                  : "—"}
              </div>
            </div>
          </div>

          <h2 className="twin-section-title">Pillar Breakdown</h2>
          <div className="twin-pillar">
            <div className="twin-pillar-head">
              <div className="twin-pillar-ic">
                <CalendarDays size={19} />
              </div>
              <div>
                <h3 className="twin-pillar-name">Attendance</h3>
                <p className="twin-pillar-sub">
                  Recency-weighted turnout · approved leave excluded
                </p>
              </div>
              <div className={`twin-pillar-score ${band(attendance?.score)}`}>
                {attendance?.score == null ? "—" : Math.round(attendance.score)}
                <small> / 100</small>
              </div>
            </div>

            <p className="twin-explain">{attendance?.explanation}</p>

            {ev && (
              <div className="twin-evidence">
                <div className="twin-ev">
                  <span>Present</span>
                  <strong>{ev.presentCount}</strong>
                </div>
                <div className="twin-ev">
                  <span>Absent</span>
                  <strong>{ev.absentCount}</strong>
                </div>
                <div className="twin-ev">
                  <span>Drills assessed</span>
                  <strong>{ev.scorableDrills}</strong>
                </div>
                <div className="twin-ev">
                  <span>Excused leave</span>
                  <strong>{ev.excusedLeaves}</strong>
                </div>
                <div className="twin-ev">
                  <span>Raw rate</span>
                  <strong>
                    {ev.rawPresentRate == null
                      ? "—"
                      : `${Math.round(ev.rawPresentRate * 100)}%`}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
