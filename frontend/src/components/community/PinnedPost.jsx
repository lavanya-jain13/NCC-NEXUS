import React from "react";
import { Pin } from "lucide-react";
import PostCard from "./PostCard";

export default function PinnedPost(props) {
  return (
    <div className="community-pinned-shell">
      <div className="community-pinned-title">
        <Pin size={13} />
        Pinned
      </div>
      <PostCard {...props} />
    </div>
  );
}


