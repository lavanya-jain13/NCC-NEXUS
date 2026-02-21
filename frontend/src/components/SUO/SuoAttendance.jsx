import React, { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import "./suoAttendance.css";
import {
  ATTENDANCE_STORAGE_KEY,
  loadAttendanceSessions,
  saveAttendanceSessions,
} from "../attendanceStore";

const calculateAttendance = (attendance, totalDrills) => {
  const attended = attendance.filter((v) => v === "P").length;
  const percent = totalDrills ? ((attended / totalDrills) * 100).toFixed(1) : "0.0";
  return { attended, total: totalDrills, percent };
};

const SuoAttendance = () => {
  const [sessionState, setSessionState] = useState(loadAttendanceSessions);
  const [selectedSession, setSelectedSession] = useState(() => Object.keys(loadAttendanceSessions())[0] || "");
  const sessionNames = Object.keys(sessionState);

  const currentSession = sessionState[selectedSession] || sessionState[sessionNames[0]];
  const drills = currentSession.drills;
  const cadets = currentSession.cadets;

  useEffect(() => {
    saveAttendanceSessions(sessionState);
  }, [sessionState]);

  useEffect(() => {
    const syncAttendance = (event) => {
      if (event.key === ATTENDANCE_STORAGE_KEY) {
        setSessionState(loadAttendanceSessions());
      }
    };

    window.addEventListener("storage", syncAttendance);
    return () => window.removeEventListener("storage", syncAttendance);
  }, []);

  useEffect(() => {
    if (!sessionNames.length) return;
    if (!selectedSession || !sessionState[selectedSession]) {
      setSelectedSession(sessionNames[0]);
    }
  }, [selectedSession, sessionNames, sessionState]);

  const nextDrillDate = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} 09:00`;
  }, []);

  const setCurrentSession = (updater) => {
    setSessionState((prev) => ({
      ...prev,
      [selectedSession]: updater(prev[selectedSession]),
    }));
  };

  const createSession = () => {
    const nameInput = window.prompt("Enter session name (example: RDC Camp 2026):");
    if (!nameInput) return;
    const sessionName = nameInput.trim();
    if (!sessionName) return;

    const exists = sessionNames.some(
      (name) => name.toLowerCase() === sessionName.toLowerCase()
    );
    if (exists) {
      window.alert("A session with this name already exists.");
      return;
    }

    const knownCadets = Array.from(
      new Set(
        Object.values(sessionState)
          .flatMap((session) => session?.cadets || [])
          .map((cadet) => (cadet?.name || "").trim())
          .filter(Boolean)
      )
    );

    const firstDrillDate = window.prompt(
      "Enter first drill date-time (YYYY-MM-DD HH:mm)",
      nextDrillDate
    );
    const now = Date.now();
    const newSession = {
      drills: [
        {
          id: `d-${now}-1`,
          label: "Drill 1",
          date: (firstDrillDate || nextDrillDate).trim(),
        },
      ],
      cadets: knownCadets.map((name, idx) => ({
        id: `c-${now}-${idx + 1}`,
        name,
        attendance: ["P"],
      })),
    };

    setSessionState((prev) => ({
      ...prev,
      [sessionName]: newSession,
    }));
    setSelectedSession(sessionName);
  };

  const removeSession = () => {
    if (sessionNames.length <= 1) {
      window.alert("At least one session is required.");
      return;
    }

    if (!window.confirm(`Delete session "${selectedSession}"?`)) return;

    setSessionState((prev) => {
      const next = { ...prev };
      delete next[selectedSession];
      return next;
    });
  };

  const toggleAttendance = (cadetIdx, drillIdx) => {
    setCurrentSession((session) => ({
      ...session,
      cadets: session.cadets.map((cadet, idx) =>
        idx !== cadetIdx
          ? cadet
          : {
              ...cadet,
              attendance: cadet.attendance.map((value, j) =>
                j !== drillIdx ? value : value === "P" ? "A" : "P"
              ),
            }
      ),
    }));
  };

  const addDrill = () => {
    const dateInput = window.prompt("Enter drill date-time (YYYY-MM-DD HH:mm)", nextDrillDate);
    if (!dateInput) return;

    setCurrentSession((session) => {
      const nextNumber = session.drills.length + 1;
      return {
        ...session,
        drills: [
          ...session.drills,
          { id: `d-${selectedSession}-${Date.now()}`, label: `Drill ${nextNumber}`, date: dateInput.trim() },
        ],
        cadets: session.cadets.map((cadet) => ({
          ...cadet,
          attendance: [...cadet.attendance, "P"],
        })),
      };
    });
  };

  const removeDrill = (drillIdx) => {
    if (drills.length <= 1) {
      window.alert("At least one drill is required.");
      return;
    }

    setCurrentSession((session) => ({
      ...session,
      drills: session.drills.filter((_, idx) => idx !== drillIdx),
      cadets: session.cadets.map((cadet) => ({
        ...cadet,
        attendance: cadet.attendance.filter((_, idx) => idx !== drillIdx),
      })),
    }));
  };

  const downloadCSV = () => {
    let csv = "Cadet Name,";
    drills.forEach((drill) => {
      csv += `${drill.label} (${drill.date}),`;
    });
    csv += "Total Drills,Total Attendance,Percentage\n";

    cadets.forEach((cadet) => {
      csv += `${cadet.name},`;
      cadet.attendance.forEach((status) => {
        csv += `${status},`;
      });
      const { attended, total, percent } = calculateAttendance(cadet.attendance, drills.length);
      csv += `${total},${attended},${percent}%\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${selectedSession}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="suo-attendance-container">
      <h2 className="attendance-title">Attendance Monitoring</h2>

      <div className="attendance-toolbar">
        <label className="attendance-label">Session:</label>
        <select
          className="attendance-session-select"
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
        >
          {sessionNames.map((sessionName) => (
            <option key={sessionName} value={sessionName}>
              {sessionName}
            </option>
          ))}
        </select>

        <button className="attendance-btn attendance-btn-secondary" onClick={createSession}>
          <Plus size={18} />
          <span>Add Session</span>
        </button>

        <button className="attendance-btn attendance-btn-danger" onClick={removeSession}>
          <Trash2 size={18} />
          <span>Delete Session</span>
        </button>

        <button className="attendance-btn attendance-btn-secondary" onClick={addDrill}>
          <Plus size={18} />
          <span>Add Drill</span>
        </button>

        <button className="attendance-btn attendance-btn-primary" onClick={downloadCSV}>
          <Download size={18} />
          <span>Download Attendance</span>
        </button>
      </div>

      <div className="attendance-table-card">
        <table className="attendance-table">
          <thead>
            <tr>
              <th className="col-cadet">Cadet Name</th>
              {drills.map((drill, drillIdx) => (
                <th key={drill.id} className="col-drill">
                  <div className="drill-head">
                    <span>{drill.label}</span>
                    <button
                      className="drill-delete"
                      onClick={() => removeDrill(drillIdx)}
                      title="Remove Drill"
                      aria-label={`Remove ${drill.label}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="drill-date">{drill.date}</div>
                </th>
              ))}
              <th>Total Drills</th>
              <th>Total Attendance</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {cadets.map((cadet, cadetIdx) => {
              const { attended, total, percent } = calculateAttendance(cadet.attendance, drills.length);
              return (
                <tr key={cadet.id}>
                  <td className="cadet-name-cell">{cadet.name}</td>
                  {drills.map((drill, drillIdx) => {
                    const status = cadet.attendance[drillIdx] || "P";
                    return (
                      <td key={`${cadet.id}-${drill.id}`}>
                        <button
                          className={`attendance-pill ${status === "P" ? "present" : "absent"}`}
                          onClick={() => toggleAttendance(cadetIdx, drillIdx)}
                        >
                          {status}
                        </button>
                      </td>
                    );
                  })}
                  <td className="total-cell">{total}</td>
                  <td className="total-cell">{attended}</td>
                  <td className="total-cell">{percent}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SuoAttendance;
