import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import MeetingCard from "./MeetingCard";
import {
  MEETING_STATUS,
  canCreateMeeting,
  getCurrentRole,
  getCurrentUser,
  getVisibleMeetings,
} from "./meetingUtils";
import "./meetingModule.css";

const MeetingListSection = ({ title, meetings, role, currentUser, participants, basePath }) => (
  <section className="meeting-list-section">
    <h3>{title}</h3>
    {meetings.length ? (
      <div className="meeting-card-grid">
        {meetings.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            role={role}
            currentUser={currentUser}
            participants={participants[meeting.id] || []}
            detailsPath={`${basePath}/${meeting.id}`}
            roomPath={`${basePath}/${meeting.id}/room`}
          />
        ))}
      </div>
    ) : (
      <div className="meeting-empty">No meetings in this section.</div>
    )}
  </section>
);

const MeetingListPage = ({ embedded = false, basePath = "/meetings" }) => {
  const role = getCurrentRole();
  const currentUser = getCurrentUser();
  const meetings = useSelector((state) => state.meetings.meetings);
  const participants = useSelector((state) => state.meetings.participants);

  const visibleMeetings = getVisibleMeetings(meetings, role, currentUser.id);

  const ongoing = visibleMeetings.filter((meeting) => meeting.status === MEETING_STATUS.LIVE);
  const upcoming = visibleMeetings.filter((meeting) => meeting.status === MEETING_STATUS.SCHEDULED);
  const past = visibleMeetings.filter((meeting) =>
    [MEETING_STATUS.ENDED, MEETING_STATUS.CANCELLED].includes(meeting.status)
  );

  return (
    <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
      <div className="meeting-page-head">
        <div>
          <h1>Meetings</h1>
          <p>Invite-based meeting management and live join flow.</p>
        </div>

        {canCreateMeeting(role) ? (
          <Link className="meeting-btn meeting-btn-primary" to={`${basePath}/create`}>
            Create Meeting
          </Link>
        ) : null}
      </div>

      <MeetingListSection
        title="Ongoing Meetings"
        meetings={ongoing}
        role={role}
        currentUser={currentUser}
        participants={participants}
        basePath={basePath}
      />

      <MeetingListSection
        title="Upcoming Meetings"
        meetings={upcoming}
        role={role}
        currentUser={currentUser}
        participants={participants}
        basePath={basePath}
      />

      <MeetingListSection
        title="Past Meetings"
        meetings={past}
        role={role}
        currentUser={currentUser}
        participants={participants}
        basePath={basePath}
      />
    </div>
  );
};

export default MeetingListPage;
