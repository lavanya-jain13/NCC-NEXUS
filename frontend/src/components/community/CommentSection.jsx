import React, { useState } from "react";

export default function CommentSection({ post, role, canComment = true, onAddComment, onAddReply }) {
  const [text, setText] = useState("");
  const [replyDraft, setReplyDraft] = useState({});

  const submitComment = () => {
    const value = text.trim();
    if (!value) return;
    onAddComment(post.id, {
      id: `${post.id}-comment-${Date.now()}`,
      authorRole: role,
      author: role.toUpperCase(),
      text: value,
      createdAt: Date.now(),
      replies: [],
    });
    setText("");
  };

  const submitReply = (commentId) => {
    const value = (replyDraft[commentId] || "").trim();
    if (!value) return;
    onAddReply(post.id, commentId, {
      id: `${commentId}-reply-${Date.now()}`,
      authorRole: role,
      author: role.toUpperCase(),
      text: value,
      createdAt: Date.now(),
    });
    setReplyDraft((prev) => ({ ...prev, [commentId]: "" }));
  };

  return (
    <div className="community-comments">
      {canComment ? (
        <div className="community-comment-input-wrap">
          <input
            type="text"
            placeholder="Write a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="button" onClick={submitComment}>
            Send
          </button>
        </div>
      ) : null}

      <div className="community-comment-list">
        {(post.comments || []).map((comment) => (
          <div key={comment.id} className="community-comment-item">
            <strong>{comment.author}</strong>
            <p>{comment.text}</p>
            <div className="community-reply-wrap">
              {(comment.replies || []).map((reply) => (
                <div key={reply.id} className="community-reply-item">
                  <strong>{reply.author}</strong>
                  <span>{reply.text}</span>
                </div>
              ))}
            </div>
            {canComment ? (
              <div className="community-reply-input">
                <input
                  type="text"
                  placeholder="Reply..."
                  value={replyDraft[comment.id] || ""}
                  onChange={(e) => setReplyDraft((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                />
                <button type="button" onClick={() => submitReply(comment.id)}>
                  Reply
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
