const STORAGE_KEY = "ncc_attendance_sessions_v1";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CADETS = [
  "Shami Dubey",
  "Rohit Singh",
  "Priya Sharma",
  "Amit Verma",
  "Neha Gupta",
  "Sahil Khan",
  "Anjali Mehta",
];

const DEFAULT_ATTENDANCE = [
  ["P", "A", "P", "P", "P", "P"],
  ["P", "P", "A", "P", "P", "P"],
  ["P", "P", "P", "A", "A", "P"],
  ["A", "P", "P", "P", "P", "P"],
  ["P", "A", "A", "P", "P", "P"],
  ["A", "P", "P", "A", "P", "P"],
  ["P", "P", "A", "P", "A", "P"],
];

const FEB_DRILLS = [
  "2026-02-03 09:00",
  "2026-02-10 09:00",
  "2026-02-17 09:00",
  "2026-02-24 09:00",
  "2026-02-28 09:00",
  "2026-02-16 09:00",
];

export const buildInitialSessionState = () => {
  const sessions = {};

  MONTHS.forEach((month, monthIdx) => {
    const mm = String(monthIdx + 1).padStart(2, "0");
    const drills =
      month === "February"
        ? FEB_DRILLS.map((date, idx) => ({ id: `d-${month}-${idx + 1}`, label: `Drill ${idx + 1}`, date }))
        : [1, 2, 3, 4, 5].map((n) => ({
            id: `d-${month}-${n}`,
            label: `Drill ${n}`,
            date: `2026-${mm}-${String(n * 4 - 1).padStart(2, "0")} 09:00`,
          }));

    const cadets = CADETS.map((name, idx) => ({
      id: `c-${idx + 1}`,
      name,
      attendance:
        month === "February"
          ? [...DEFAULT_ATTENDANCE[idx]]
          : drills.map((_, dIdx) => DEFAULT_ATTENDANCE[idx][dIdx % DEFAULT_ATTENDANCE[idx].length] || "P"),
    }));

    sessions[month] = { drills, cadets };
  });

  return sessions;
};

const isValidState = (value) => {
  if (!value || typeof value !== "object") return false;
  return MONTHS.every((month) => {
    const session = value[month];
    return session && Array.isArray(session.drills) && Array.isArray(session.cadets);
  });
};

export const loadAttendanceSessions = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildInitialSessionState();
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) return buildInitialSessionState();
    return parsed;
  } catch {
    return buildInitialSessionState();
  }
};

export const saveAttendanceSessions = (sessions) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // no-op
  }
};

export const addCadetToAttendance = (cadetName) => {
  const name = (cadetName || "").trim();
  if (!name) return;

  const sessions = loadAttendanceSessions();
  const normalizedName = name.toLowerCase();

  MONTHS.forEach((month) => {
    const session = sessions[month];
    if (!session || !Array.isArray(session.cadets)) return;

    const exists = session.cadets.some(
      (cadet) => (cadet?.name || "").trim().toLowerCase() === normalizedName
    );
    if (exists) return;

    const newCadet = {
      id: `c-${Date.now()}-${month}`,
      name,
      attendance: session.drills.map(() => "P"),
    };
    session.cadets.push(newCadet);
  });

  saveAttendanceSessions(sessions);
};

export const ATTENDANCE_STORAGE_KEY = STORAGE_KEY;
