import { Link } from "react-router-dom";
import { CalendarDays, Users, Video } from "lucide-react";
import {
  MEETING_STATUS,
  formatMeetingDateTime,
  getStatusClass,
  isInvitedToMeeting,
  isMeetingHost,
} from "./meetingUtils";

const MeetingCard = ({ meeting, role, currentUser, participants = [], detailsPath, roomPath }) => {
  const invited = isInvitedToMeeting(meeting, currentUser.id, role);
  const isHost = isMeetingHost(meeting, currentUser.id);
  const canJoin = invited && meeting.status === MEETING_STATUS.LIVE;

  return (
    <article className="meeting-card">
      <div className="meeting-card-head">
        <h3>{meeting.title}</h3>
        <span className={`meeting-status-badge ${getStatusClass(meeting.status)}`}>{meeting.status}</span>
      </div>

      <p className="meeting-card-description">{meeting.description}</p>

      <div className="meeting-card-meta">
        <span>
          <CalendarDays size={14} />
          {formatMeetingDateTime(meeting.dateTime)}
        </span>
        <span>
          <Users size={14} />
          {(meeting.invitedUserIds || []).length} invited
        </span>
        <span>
          <Video size={14} />
          {participants.length} joined
        </span>
      </div>

      <div className="meeting-card-footer">
        <span className="meeting-type-chip">{meeting.meetingType}</span>
        {isHost ? <span className="meeting-host-chip">Host</span> : null}
      </div>

      <div className="meeting-card-actions">
        <Link className="meeting-btn meeting-btn-secondary" to={detailsPath}>
          View Details
        </Link>
        <Link
          className={`meeting-btn meeting-btn-primary ${!canJoin ? "meeting-btn-disabled" : ""}`}
          to={canJoin ? roomPath : detailsPath}
          aria-disabled={!canJoin}
          onClick={(event) => {
            if (!canJoin) event.preventDefault();
          }}
        >
          Join
        </Link>
      </div>
    </article>
  );
};

export default MeetingCard;
