// Responsibility: ANO Risk Watchlist — surfaces at-risk cadets (live from the
//   Decision layer) with severity, explainable drivers, a recommended action, and
//   an acknowledge workflow over persisted flags. Drills into a cadet's Digital Twin.
// Layer: Command Center UI (Layer 4).
// Depends on: react-router-dom (useNavigate), api/decisionApi (at-risk + scan +
//   flags + acknowledge), riskWatchlist.css. Rendered in the ANO shell (/ano/command/risk).
// Must never be depended on by: backend code or the Intelligence/Decision layers.
// Visuals use hand-rolled SVG/CSS only (ADL-008 — no charting library yet).
//
// Data model: the live /at-risk list carries rich cadet info (name, rank, score,
// drivers) but no lifecycle; the /flags list carries the persisted flag id + status
// needed to acknowledge. We merge the two by regimental_no so each row shows both
// the current risk picture AND its lifecycle state. Acknowledge is only possible
// once a flag has been persisted by a scan (it needs a flag id).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Check,
  ChevronRight,
  Activity,
  ClipboardList,
} from "lucide-react";
import { decisionApi } from "../../api/decisionApi";
import "./riskWatchlist.css";

const SEV_META = {
  high: { label: "High", cls: "rw-sev-high" },
  medium: { label: "Medium", cls: "rw-sev-medium" },
  low: { label: "Low", cls: "rw-sev-low" },
  none: { label: "None", cls: "rw-sev-none" },
};

const SEV_RANK = { high: 0, medium: 1, low: 2, none: 3 };

function sevMeta(sev) {
  return SEV_META[sev] || SEV_META.none;
}

export default function RiskWatchlist() {
  const navigate = useNavigate();

  const [atRisk, setAtRisk] = useState([]);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scanning, setScanning] = useState(false);
  const [ackingReg, setAckingReg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [riskRes, flagRes] = await Promise.all([
        decisionApi.getAtRisk(),
        decisionApi.getFlags(),
      ]);
      setAtRisk(Array.isArray(riskRes.data) ? riskRes.data : []);
      setFlags(Array.isArray(flagRes.data) ? flagRes.data : []);
    } catch (err) {
      if (err?.response?.status === 403) {
        setError("Only officers (ANO/SUO) can view the Risk Watchlist.");
      } else {
        setError(err?.response?.data?.message || "Failed to load the risk watchlist.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleScan = async () => {
    setScanning(true);
    setError("");
    setNotice("");
    try {
      const res = await decisionApi.scan();
      const r = res.data || {};
      setNotice(
        `Scan complete — ${r.atRisk ?? 0} at risk · ${r.inserted ?? 0} new · ` +
          `${r.updated ?? 0} updated · ${r.resolved ?? 0} resolved.`
      );
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const handleAcknowledge = async (flagId, reg) => {
    setAckingReg(reg);
    setError("");
    try {
      await decisionApi.acknowledge(flagId);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Acknowledge failed.");
    } finally {
      setAckingReg(null);
    }
  };

  // ── Merge live at-risk (rich) with persisted flags (lifecycle) by reg. no ──
  const rows = useMemo(() => {
    const flagByReg = new Map(flags.map((f) => [f.regimental_no, f]));
    const liveRegs = new Set(atRisk.map((r) => r.regimental_no));

    // Currently at-risk cadets, enriched with lifecycle if a flag was persisted.
    const live = atRisk.map((r) => {
      const flag = flagByReg.get(r.regimental_no) || null;
      return {
        regimental_no: r.regimental_no,
        full_name: r.full_name,
        rank_name: r.rank_name,
        overall_score: r.overall_score,
        severity: r.severity,
        drivers: r.drivers || [],
        recommendedAction: r.recommendedAction,
        dataConfidence: r.dataConfidence,
        explanation: r.explanation,
        flagId: flag ? flag.id : null,
        status: flag ? flag.status : "unscanned",
        stale: false,
      };
    });

    // Persisted flags whose cadet is no longer at risk — will auto-resolve on scan.
    const stale = flags
      .filter((f) => !liveRegs.has(f.regimental_no))
      .map((f) => ({
        regimental_no: f.regimental_no,
        full_name: null,
        rank_name: null,
        overall_score: null,
        severity: f.severity,
        drivers: f.drivers || [],
        recommendedAction: f.recommended_action,
        dataConfidence: f.data_confidence,
        explanation: f.explanation,
        flagId: f.id,
        status: f.status,
        stale: true,
      }));

    return [...live, ...stale].sort(
      (a, b) =>
        (a.stale ? 1 : 0) - (b.stale ? 1 : 0) ||
        (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9) ||
        (a.overall_score ?? 101) - (b.overall_score ?? 101)
    );
  }, [atRisk, flags]);

  const summary = useMemo(() => {
    const high = atRisk.filter((r) => r.severity === "high").length;
    const medium = atRisk.filter((r) => r.severity === "medium").length;
    const low = atRisk.filter((r) => r.severity === "low").length;
    const acknowledged = flags.filter((f) => f.status === "acknowledged").length;
    return { total: atRisk.length, high, medium, low, acknowledged };
  }, [atRisk, flags]);

  return (
    <div className="rw-page">
      {/* HERO */}
      <div className="rw-hero">
        <div>
          <h1 className="rw-title">Risk Watchlist</h1>
          <p className="rw-sub">
            Cadets who need attention now — explainable drivers, from your unit's own data
          </p>
        </div>
        <button className="rw-btn" onClick={handleScan} disabled={scanning || loading}>
          <RefreshCw size={15} className={scanning ? "rw-spin" : ""} />
          {scanning ? "Scanning…" : "Scan now"}
        </button>
      </div>

      {error && (
        <div className="rw-state rw-state-error">
          <AlertTriangle size={18} /> {error}
        </div>
      )}
      {notice && (
        <div className="rw-state rw-state-notice">
          <CheckCircle2 size={18} /> {notice}
        </div>
      )}

      {/* SUMMARY STATS */}
      <div className="rw-stats">
        <div className="rw-stat">
          <div className="rw-stat-ic rw-ic-navy"><ShieldAlert size={20} /></div>
          <div>
            <h3>{summary.total}</h3>
            <p>At Risk</p>
          </div>
        </div>
        <div className="rw-stat">
          <div className="rw-stat-ic rw-ic-red"><AlertTriangle size={20} /></div>
          <div>
            <h3 className="rw-sev-high-text">{summary.high}</h3>
            <p>High severity</p>
          </div>
        </div>
        <div className="rw-stat">
          <div className="rw-stat-ic rw-ic-amber"><Activity size={20} /></div>
          <div>
            <h3 className="rw-sev-medium-text">{summary.medium}</h3>
            <p>Medium severity</p>
          </div>
        </div>
        <div className="rw-stat">
          <div className="rw-stat-ic rw-ic-teal"><ClipboardList size={20} /></div>
          <div>
            <h3>{summary.acknowledged}</h3>
            <p>Acknowledged</p>
          </div>
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="rw-skeleton" />
      ) : rows.length === 0 ? (
        <div className="rw-state rw-empty">
          <CheckCircle2 size={30} />
          <h3>No cadets at risk</h3>
          <p>Every cadet with a computed snapshot is currently within safe thresholds.</p>
        </div>
      ) : (
        <div className="rw-list">
          {rows.map((r) => {
            const meta = sevMeta(r.severity);
            const canAck = r.flagId != null && r.status === "open";
            return (
              <div key={`${r.regimental_no}-${r.flagId ?? "live"}`} className={`rw-card ${meta.cls}`}>
                <span className="rw-stripe" />

                {/* header row */}
                <div className="rw-card-head">
                  <div className="rw-who">
                    <span className={`rw-sev-badge ${meta.cls}`}>{meta.label}</span>
                    <div>
                      <h4 className="rw-name">{r.full_name || r.regimental_no}</h4>
                      <p className="rw-meta">
                        <span className="rw-mono">{r.regimental_no}</span>
                        {r.rank_name ? <> · {r.rank_name}</> : null}
                        {r.overall_score != null ? (
                          <> · Readiness <b>{Math.round(r.overall_score)}</b></>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <div className="rw-status-wrap">
                    {r.stale ? (
                      <span className="rw-status rw-status-stale">Recovered · resolves on scan</span>
                    ) : r.status === "acknowledged" ? (
                      <span className="rw-status rw-status-ack"><Check size={13} /> Acknowledged</span>
                    ) : r.status === "open" ? (
                      <span className="rw-status rw-status-open">Awaiting review</span>
                    ) : (
                      <span className="rw-status rw-status-unscanned">Not yet flagged</span>
                    )}
                  </div>
                </div>

                {/* drivers */}
                {r.drivers.length > 0 && (
                  <div className="rw-drivers">
                    {r.drivers.map((d, i) => (
                      <span key={i} className="rw-driver" title={d.detail || ""}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* recommended action */}
                {r.recommendedAction && (
                  <div className="rw-action">
                    <span className="rw-action-label">Recommended</span>
                    <span className="rw-action-text">{r.recommendedAction}</span>
                  </div>
                )}

                {/* footer */}
                <div className="rw-card-foot">
                  <span className="rw-conf">
                    Data confidence:{" "}
                    <b>
                      {r.dataConfidence == null ? "—" : `${Math.round(r.dataConfidence * 100)}%`}
                    </b>
                  </span>
                  <div className="rw-actions">
                    <button
                      className="rw-link-btn"
                      onClick={() =>
                        navigate(
                          `/ano/command/cadet/${encodeURIComponent(r.regimental_no)}`
                        )
                      }
                    >
                      View Digital Twin <ChevronRight size={14} />
                    </button>
                    {canAck ? (
                      <button
                        className="rw-ack-btn"
                        disabled={ackingReg === r.regimental_no}
                        onClick={() => handleAcknowledge(r.flagId, r.regimental_no)}
                      >
                        <Check size={14} />
                        {ackingReg === r.regimental_no ? "Acknowledging…" : "Acknowledge"}
                      </button>
                    ) : r.status === "unscanned" ? (
                      <span className="rw-hint" title="Run a scan to persist this flag before acknowledging.">
                        Scan to enable acknowledge
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
