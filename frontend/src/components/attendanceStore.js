const STORAGE_KEY = "ncc_attendance_sessions_v1";
const SESSION_FALLBACK_NAME = "NCC Training Cycle 2026";

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

const DEFAULT_DRILLS = [
  "2026-02-03 09:00",
  "2026-02-10 09:00",
  "2026-02-17 09:00",
  "2026-02-24 09:00",
  "2026-02-28 09:00",
  "2026-02-16 09:00",
];

const slugifyName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const toDrillLabel = (index) => `Drill ${index + 1}`;

const buildCadetsForDrills = (drillCount) =>
  CADETS.map((name, idx) => ({
    id: `c-${idx + 1}`,
    name,
    attendance: Array.from({ length: drillCount }, (_, drillIdx) => {
      const source = DEFAULT_ATTENDANCE[idx] || ["P"];
      return source[drillIdx % source.length] || "P";
    }),
  }));

const buildSessionFromCadetNames = (sessionName, cadetNames = []) => {
  const normalizedSessionName = (sessionName || SESSION_FALLBACK_NAME).trim();
  const baseDrillId = slugifyName(normalizedSessionName) || "session";
  const drills = DEFAULT_DRILLS.map((date, idx) => ({
    id: `d-${baseDrillId}-${idx + 1}`,
    label: toDrillLabel(idx),
    date,
  }));

  const names = Array.from(new Set(cadetNames.map((name) => (name || "").trim()).filter(Boolean)));
  const cadets =
    names.length > 0
      ? names.map((name, idx) => ({
          id: `c-${Date.now()}-${idx + 1}`,
          name,
          attendance: drills.map(() => "P"),
        }))
      : buildCadetsForDrills(drills.length);

  return { drills, cadets };
};

export const buildInitialSessionState = () => ({
  [SESSION_FALLBACK_NAME]: buildSessionFromCadetNames(SESSION_FALLBACK_NAME),
});

const isValidSession = (session) => {
  if (!session || typeof session !== "object") return false;
  if (!Array.isArray(session.drills) || !Array.isArray(session.cadets)) return false;
  return true;
};

const normalizeState = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return buildInitialSessionState();
  }

  const entries = Object.entries(value).filter(([sessionName, sessionValue]) => {
    if (!sessionName || typeof sessionName !== "string") return false;
    return isValidSession(sessionValue);
  });

  if (!entries.length) return buildInitialSessionState();

  return entries.reduce((acc, [sessionName, session]) => {
    const normalizedCadets = session.cadets.map((cadet, cadetIdx) => ({
      id: cadet?.id || `c-${slugifyName(sessionName) || "session"}-${cadetIdx + 1}`,
      name: (cadet?.name || "").trim() || `Cadet ${cadetIdx + 1}`,
      attendance: session.drills.map((_, drillIdx) =>
        cadet?.attendance?.[drillIdx] === "A" ? "A" : "P"
      ),
    }));

    const normalizedDrills = session.drills.map((drill, drillIdx) => ({
      id: drill?.id || `d-${slugifyName(sessionName) || "session"}-${drillIdx + 1}`,
      label: (drill?.label || "").trim() || toDrillLabel(drillIdx),
      date: (drill?.date || "").trim() || "",
    }));

    acc[sessionName] = { drills: normalizedDrills, cadets: normalizedCadets };
    return acc;
  }, {});
};

export const loadAttendanceSessions = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildInitialSessionState();
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
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

  Object.keys(sessions).forEach((sessionName) => {
    const session = sessions[sessionName];
    if (!session || !Array.isArray(session.cadets)) return;

    const exists = session.cadets.some(
      (cadet) => (cadet?.name || "").trim().toLowerCase() === normalizedName
    );
    if (exists) return;

    const newCadet = {
      id: `c-${Date.now()}-${slugifyName(sessionName) || "session"}`,
      name,
      attendance: session.drills.map(() => "P"),
    };
    session.cadets.push(newCadet);
  });

  saveAttendanceSessions(sessions);
};

export const ATTENDANCE_STORAGE_KEY = STORAGE_KEY;
