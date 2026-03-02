import React from "react";
import { FaTrophy } from "react-icons/fa6";

export default function BadgeList({ points = 0, badges = [], level = "Bronze Cadet" }) {
  const builtInBadges = [
    { name: "Contributor", hint: "Posted 5+ updates", icon: "🎖️" },
    { name: "Drill Master", hint: "Participated in 3+ events", icon: "🪖" },
    { name: "Shooting Champion", hint: "Top scorer in competitions", icon: "🔫" },
    { name: "Announcer", hint: "Created 10+ announcements", icon: "📣" },
    { name: "Engaged Member", hint: "Commented 20+ times", icon: "💬" },
  ];

  return (
    <section className="community-badges-card">
      <div className="community-achievement-head">
        <h3>
          <FaTrophy size={16} />
          Achievements
        </h3>
        <span className="community-points">{points} pts</span>
      </div>
      <div className="community-achievement-grid">
        {builtInBadges.map((badge) => (
          <article key={badge.name} className={`community-achievement-item ${badges.includes(badge.name) ? "earned" : ""}`}>
            <div className="community-achievement-title">
              <span>{badge.icon}</span>
              <div>
                <strong>{badge.name}</strong>
                <p>{badge.hint}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
