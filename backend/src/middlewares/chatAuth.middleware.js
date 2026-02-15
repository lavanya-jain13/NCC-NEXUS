const jwt = require("jsonwebtoken");

const VALID_CHAT_ROLES = new Set(["cadet", "suo", "ano", "alumni"]);

function normalizeRole(rawRole, rank) {
  if (!rawRole) return null;

  const value = String(rawRole || "").trim().toLowerCase();

  if (["cadet", "suo", "ano", "alumni"].includes(value)) {
    if (value === "cadet" && String(rank || "").trim().toLowerCase() === "senior under officer") {
      return "suo";
    }
    return value;
  }

  if (value === "senior under officer") return "suo";
  return null;
}

function resolveFromToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = Number(decoded.user_id);
  const role = normalizeRole(decoded.role, decoded.rank);

  if (!Number.isInteger(userId) || userId <= 0 || !VALID_CHAT_ROLES.has(role)) {
    return null;
  }

  return {
    userId,
    role,
    tokenPayload: decoded,
  };
}

function resolveFromMockHeaders(req) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const userId = Number(req.headers["x-user-id"]);
  const role = normalizeRole(req.headers["x-user-role"]);

  if (!Number.isInteger(userId) || userId <= 0 || !VALID_CHAT_ROLES.has(role)) {
    return null;
  }

  return {
    userId,
    role,
    tokenPayload: null,
  };
}

function chatAuth(req, res, next) {
  try {
    const resolved = resolveFromToken(req) || resolveFromMockHeaders(req);

    if (!resolved) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Unauthorized. Provide a valid Bearer token.",
        },
      });
    }

    req.chatUser = resolved;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired authentication token.",
      },
    });
  }
}

module.exports = {
  chatAuth,
  normalizeRole,
  VALID_CHAT_ROLES,
};
