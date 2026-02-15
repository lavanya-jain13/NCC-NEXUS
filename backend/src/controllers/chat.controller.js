const chatService = require("../services/chat.service");

function toPositiveInt(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function ok(res, status, data, meta = null) {
  const payload = { success: true, data };
  if (meta) payload.meta = meta;
  return res.status(status).json(payload);
}

function fail(res, status, message, code = "CHAT_ERROR") {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}

function handleError(res, error) {
  const status = error.status || 500;
  const code = status >= 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR";
  const safeMessage = status >= 500 ? "Internal server error." : (error.message || "Request failed.");
  return fail(res, status, safeMessage, code);
}

async function createChatRoom(req, res) {
  try {
    const creatorUserId = req.chatUser.userId;
    const creatorRole = req.chatUser.role;

    const roomType = String(req.body.room_type || "direct").toLowerCase();
    const roomName = req.body.room_name;

    if (typeof roomName !== "undefined" && typeof roomName !== "string") {
      return fail(res, 400, "room_name must be a string.", "INVALID_ROOM_NAME");
    }

    if (!Array.isArray(req.body.participant_user_ids)) {
      return fail(res, 400, "participant_user_ids must be an array.", "INVALID_PARTICIPANTS");
    }

    const participantUserIds = req.body.participant_user_ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    const result = await chatService.createRoom({
      creatorUserId,
      creatorRole,
      roomType,
      roomName,
      participantUserIds,
    });

    return ok(
      res,
      result.reused ? 200 : 201,
      {
        room: result.room,
        participants: result.participants,
      },
      { reused: result.reused }
    );
  } catch (error) {
    return handleError(res, error);
  }
}

async function getUserChatList(req, res) {
  try {
    const requestedUserId = toPositiveInt(req.params.userId);
    if (!requestedUserId) {
      return fail(res, 400, "Invalid userId parameter.", "INVALID_USER_ID");
    }

    if (requestedUserId !== req.chatUser.userId) {
      return fail(res, 403, "You can only fetch your own chat list.", "FORBIDDEN");
    }

    const filter = req.query.filter || "all";
    const onlineUsers = req.app.locals.onlineUsers || new Set();
    const chats = await chatService.getChatList({ userId: requestedUserId, onlineUsers, filter });

    return ok(res, 200, { chats }, { filter: String(filter).toLowerCase() });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getCollegeUsers(req, res) {
  try {
    const requestedUserId = toPositiveInt(req.params.userId);
    if (!requestedUserId) {
      return fail(res, 400, "Invalid userId parameter.", "INVALID_USER_ID");
    }

    if (requestedUserId !== req.chatUser.userId) {
      return fail(res, 403, "You can only fetch your own users list.", "FORBIDDEN");
    }

    const filter = req.query.filter || "all";
    const onlineUsers = req.app.locals.onlineUsers || new Set();
    const users = await chatService.getCollegeUsers({ userId: requestedUserId, filter, onlineUsers });

    return ok(res, 200, { users }, { filter: String(filter).toLowerCase() });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getRoomMessages(req, res) {
  try {
    const roomId = toPositiveInt(req.params.roomId);
    if (!roomId) {
      return fail(res, 400, "Invalid roomId parameter.", "INVALID_ROOM_ID");
    }

    const limit = req.query.limit;
    const beforeMessageId = req.query.before_message_id;

    const result = await chatService.getRoomMessages({
      roomId,
      userId: req.chatUser.userId,
      limit,
      beforeMessageId,
    });

    return ok(res, 200, { room_id: roomId, messages: result.messages }, result.pagination);
  } catch (error) {
    return handleError(res, error);
  }
}

async function sendMessage(req, res) {
  try {
    const roomId = toPositiveInt(req.body.room_id);
    if (!roomId) {
      return fail(res, 400, "Valid room_id is required.", "INVALID_ROOM_ID");
    }

    const body = req.body.body;
    if (typeof body !== "string") {
      return fail(res, 400, "body must be a string.", "INVALID_BODY");
    }

    const messageType = typeof req.body.message_type === "string" ? req.body.message_type : "text";

    const message = await chatService.sendMessage({
      roomId,
      senderUserId: req.chatUser.userId,
      senderRole: req.chatUser.role,
      body,
      messageType,
      metadata: req.body.metadata || null,
    });

    const io = req.app.locals.io;
    if (io) {
      io.to(`room:${roomId}`).emit("chat:new_message", message);
    }

    return ok(res, 201, { message });
  } catch (error) {
    return handleError(res, error);
  }
}

async function markMessageAsRead(req, res) {
  try {
    const roomId = toPositiveInt(req.body.room_id);
    if (!roomId) {
      return fail(res, 400, "Valid room_id is required.", "INVALID_ROOM_ID");
    }

    const upToMessageId = typeof req.body.up_to_message_id === "undefined"
      ? null
      : toPositiveInt(req.body.up_to_message_id);

    if (typeof req.body.up_to_message_id !== "undefined" && !upToMessageId) {
      return fail(res, 400, "up_to_message_id must be a positive integer.", "INVALID_MESSAGE_ID");
    }

    const result = await chatService.markRoomAsRead({
      roomId,
      userId: req.chatUser.userId,
      upToMessageId,
    });

    const io = req.app.locals.io;
    if (io) {
      io.to(`room:${roomId}`).emit("chat:read_update", {
        room_id: roomId,
        user_id: req.chatUser.userId,
        last_read_message_id: result.last_read_message_id,
        marked_count: result.marked_count,
      });
    }

    return ok(res, 200, {
      room_id: roomId,
      user_id: req.chatUser.userId,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function deleteMessage(req, res) {
  try {
    const messageId = toPositiveInt(req.params.messageId);
    if (!messageId) {
      return fail(res, 400, "Invalid messageId parameter.", "INVALID_MESSAGE_ID");
    }

    const result = await chatService.softDeleteMessage({
      messageId,
      requesterUserId: req.chatUser.userId,
    });

    const io = req.app.locals.io;
    if (io) {
      io.to(`room:${result.room_id}`).emit("chat:message_deleted", {
        room_id: result.room_id,
        message_id: result.message_id,
      });
    }

    return ok(res, 200, result);
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  createChatRoom,
  getUserChatList,
  getCollegeUsers,
  getRoomMessages,
  sendMessage,
  markMessageAsRead,
  deleteMessage,
};
