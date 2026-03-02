import React from "react";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { FaArrowUpRightFromSquare } from "react-icons/fa6";

function formatRelativeDay(value) {
  const eventDate = new Date(value).getTime();
  const diff = eventDate - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  return "Completed";
}

function toCalendarLink(eventDetails) {
  const start = new Date(eventDetails.date);
  const end = new Date(start.getTime() + 1000 * 60 * 60);
  const encodeDate = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventDetails.title || "NCC Event",
    dates: `${encodeDate(start)}/${encodeDate(end)}`,
    details: eventDetails.description || "",
    location: eventDetails.location || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function EventCard({ eventDetails }) {
  if (!eventDetails) return null;
  return (
    <div className="community-event-card">
      <div className="community-event-head">
        <h4>{eventDetails.title}</h4>
        <span className="community-inline-chip">
          <Clock3 size={13} />
          Starts {formatRelativeDay(eventDetails.date).toLowerCase()}
        </span>
      </div>
      <div className="community-event-meta-line">
        <p className="community-event-date">
          <CalendarDays size={14} />
          {new Date(eventDetails.date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
        </p>
        <p className="community-event-location">
          <MapPin size={14} />
          {eventDetails.location}
        </p>
      </div>
      <p className="community-event-desc">{eventDetails.description}</p>
      <div className="community-event-footer">
        <a href={toCalendarLink(eventDetails)} target="_blank" rel="noreferrer">
          <FaArrowUpRightFromSquare size={14} />
          Add to Calendar
        </a>
      </div>
    </div>
  );
}
