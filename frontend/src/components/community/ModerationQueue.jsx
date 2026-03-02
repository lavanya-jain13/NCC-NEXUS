import React, { useState } from "react";
import { BadgeCheck, CircleSlash, ShieldAlert } from "lucide-react";

export default function ModerationQueue({ posts, onApprove, onReject }) {
  const [rejectingPostId, setRejectingPostId] = useState(null);
  const [reason, setReason] = useState("");

  if (!posts.length) return null;

  return (
    <section className="community-moderation-card">
      <h3>
        <ShieldAlert size={16} />
        Moderation Queue
      </h3>
      <p>Pending submissions require ANO approval.</p>
      <div className="community-moderation-list">
        {posts.map((post) => (
          <article key={post.id} className="community-moderation-item">
            <div>
              <strong>{post.author}</strong>
              <span>{post.type.toUpperCase()}</span>
              <p>{post.content}</p>
            </div>
            <div className="community-moderation-actions">
              <button type="button" onClick={() => onApprove(post.id)}>
                <BadgeCheck size={13} />
                Approve
              </button>
              <button type="button" className="danger" onClick={() => setRejectingPostId(post.id)}>
                <CircleSlash size={13} />
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>

      {rejectingPostId ? (
        <div className="community-modal-overlay" role="dialog" aria-modal="true" onClick={() => setRejectingPostId(null)}>
          <div className="community-modal-card community-reject-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Reject Post</h4>
            <textarea
              placeholder="Reason for rejection..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="community-modal-actions">
              <button type="button" onClick={() => setRejectingPostId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  onReject(rejectingPostId, reason.trim());
                  setReason("");
                  setRejectingPostId(null);
                }}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
