import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ROLE_STORAGE_KEY = "community_role_state";
const LEVELS = ["Bronze Cadet", "Silver Cadet", "Gold Cadet", "Elite Cadet"];

const RoleContext = createContext(null);

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "ANO" || raw === "SUO" || raw === "CADET" || raw === "ALUMNI") return raw.toLowerCase();
  return "cadet";
};

const defaultRoleState = {
  ano: { points: 0, badges: [] },
  suo: { points: 0, badges: [] },
  cadet: { points: 0, badges: [] },
  alumni: { points: 0, badges: [] },
};

function getStoredRoleState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || "{}");
    return {
      ...defaultRoleState,
      ...parsed,
      ano: { ...defaultRoleState.ano, ...(parsed?.ano || {}) },
      suo: { ...defaultRoleState.suo, ...(parsed?.suo || {}) },
      cadet: { ...defaultRoleState.cadet, ...(parsed?.cadet || {}) },
      alumni: { ...defaultRoleState.alumni, ...(parsed?.alumni || {}) },
    };
  } catch {
    return defaultRoleState;
  }
}

function deriveLevel(points) {
  if (points >= 120) return LEVELS[3];
  if (points >= 80) return LEVELS[2];
  if (points >= 40) return LEVELS[1];
  return LEVELS[0];
}

export function RoleProvider({ children }) {
  const role = normalizeRole(localStorage.getItem("role"));
  const [roleState, setRoleState] = useState(getStoredRoleState);

  useEffect(() => {
    localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(roleState));
  }, [roleState]);

  const grantPoints = (value, reason = "") => {
    if (!Number.isFinite(value) || value <= 0) return;
    setRoleState((prev) => {
      const next = { ...prev };
      next[role] = {
        ...next[role],
        points: Number(next[role].points || 0) + value,
      };

      const badges = new Set(next[role].badges || []);
      const points = next[role].points;
      if (points >= 10) badges.add("Contributor");
      if (points >= 25) badges.add("Engaged Cadet");
      if (points >= 40) badges.add("Drill Master");
      if (points >= 60) badges.add("Announcer");
      if (reason === "media_shooting") badges.add("Shooting Champion");
      next[role].badges = Array.from(badges);

      return next;
    });
  };

  const value = useMemo(() => {
    const points = Number(roleState?.[role]?.points || 0);
    const badges = roleState?.[role]?.badges || [];
    return {
      role,
      canPost: role === "ano" || role === "suo",
      canEdit: role === "ano" || role === "suo",
      canModerate: role === "ano",
      canComment: true,
      points,
      badges,
      level: deriveLevel(points),
      grantPoints,
    };
  }, [role, roleState]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used inside RoleProvider");
  }
  return ctx;
}
