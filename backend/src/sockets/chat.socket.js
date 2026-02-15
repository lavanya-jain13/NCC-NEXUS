const jwt = require("jsonwebtoken");
const chatService = require("../services/chat.service");
const { normalizeRole, VALID_CHAT_ROLES } = require("../middlewares/chatAuth.middleware");

function parseSocketUser(socket) {
  const auth = socket.handshake.auth || {};
  const headers = socket.handshake.headers || {};

  const bearer = headers.authorization;
  const token = auth.token || (typeof bearer === "string" && bearer.startsWith("Bearer ") ? bearer.slice(7) : null);

  if (token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = Number(decoded.user_id);
    const role = normalizeRole(decoded.role, decoded.rank);

    if (!Number.isInteger(userId) || userId <= 0 || !VALID_CHAT_ROLES.has(role)) {
      throw new Error("Invalid token payload.");
    }

    return { userId, role };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing token.");
  }

  const mockUserId = Number(auth.user_id || headers["x-user-id"]);
  const mockRole = normalizeRole(auth.role || headers["x-user-role"]);

  if (!Number.isInteger(mockUserId) || mockUserId <= 0 || !VALID_CHAT_ROLES.has(mockRole)) {
    throw new Error("Invalid mock socket auth.");
  }

  return { userId: mockUserId, role: mockRole };
}

function initChatSocket(io, options = {}) {
  const onlineUsers = options.onlineUsers || new Set();
  const connectionCountByUser = new Map();

  io.use((socket, next) => {
    try {
      socket.data.chatUser = parseSocketUser(socket);
      next();
    } catch (error) {
      next(new Error("Socket authentication failed."));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.chatUser;

    socket.join(`user:${user.userId}`);

    const count = (connectionCountByUser.get(user.userId) || 0) + 1;
    connectionCountByUser.set(user.userId, count);
    onlineUsers.add(user.userId);

    socket.emit("chat:connected", { user_id: user.userId, role: user.role });

    socket.on("chat:join_room", async (payload = {}) => {
      try {
        const roomId = Number(payload.room_id);
        if (!Number.isInteger(roomId) || roomId <= 0) {
          throw new Error("Invalid room_id.");
        }

        await chatService.assertRoomAccess(roomId, user.userId);
        socket.join(`room:${roomId}`);
        socket.emit("chat:room_joined", { room_id: roomId });
      } catch (error) {
        socket.emit("chat:error", { message: error.message || "Unable to join room." });
      }
    });

    socket.on("chat:leave_room", (payload = {}) => {
      const roomId = Number(payload.room_id);
      if (Number.isInteger(roomId) && roomId > 0) {
        socket.leave(`room:${roomId}`);
        socket.emit("chat:room_left", { room_id: roomId });
      }
    });

    socket.on("chat:send_message", async (payload = {}) => {
      try {
        const roomId = Number(payload.room_id);
        if (!Number.isInteger(roomId) || roomId <= 0) {
          throw new Error("Invalid room_id.");
        }

        const message = await chatService.sendMessage({
          roomId,
          senderUserId: user.userId,
          senderRole: user.role,
          body: payload.body,
          messageType: payload.message_type || "text",
          metadata: payload.metadata || null,
        });

        io.to(`room:${roomId}`).emit("chat:new_message", message);
      } catch (error) {
        socket.emit("chat:error", { message: error.message || "Failed to send message." });
      }
    });

    socket.on("chat:typing", async (payload = {}) => {
      try {
        const roomId = Number(payload.room_id);
        if (!Number.isInteger(roomId) || roomId <= 0) {
          throw new Error("Invalid room_id.");
        }

        await chatService.assertRoomAccess(roomId, user.userId);
        socket.to(`room:${roomId}`).emit("chat:typing", {
          room_id: roomId,
          user_id: user.userId,
          role: user.role,
          is_typing: Boolean(payload.is_typing),
        });
      } catch (error) {
        socket.emit("chat:error", { message: error.message || "Failed to emit typing." });
      }
    });

    socket.on("chat:mark_read", async (payload = {}) => {
      try {
        const roomId = Number(payload.room_id);
        if (!Number.isInteger(roomId) || roomId <= 0) {
          throw new Error("Invalid room_id.");
        }

        const upToMessageId = typeof payload.up_to_message_id === "undefined" ? null : Number(payload.up_to_message_id);
        const result = await chatService.markRoomAsRead({
          roomId,
          userId: user.userId,
          upToMessageId: Number.isInteger(upToMessageId) && upToMessageId > 0 ? upToMessageId : null,
        });

        io.to(`room:${roomId}`).emit("chat:read_update", {
          room_id: roomId,
          user_id: user.userId,
          last_read_message_id: result.last_read_message_id,
          marked_count: result.marked_count,
        });
      } catch (error) {
        socket.emit("chat:error", { message: error.message || "Failed to mark read." });
      }
    });

    socket.on("disconnect", () => {
      const active = Math.max((connectionCountByUser.get(user.userId) || 1) - 1, 0);
      if (active === 0) {
        connectionCountByUser.delete(user.userId);
        onlineUsers.delete(user.userId);
      } else {
        connectionCountByUser.set(user.userId, active);
      }
    });
  });

  return { onlineUsers };
}

module.exports = {
  initChatSocket,
};
