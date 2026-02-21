import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { editMeeting, setCurrentMeeting, updateMeetingStatus } from "../../store/meetingSlice";
import {
  MEETING_STATUS,
  formatMeetingDateTime,
  getCurrentRole,
  getCurrentUser,
  isInvitedToMeeting,
  isMeetingHost,
} from "./meetingUtils";
import "./meetingModule.css";

const MeetingDetailsPage = ({ embedded = false, basePath = "/meetings" }) => {
  const { meetingId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const role = getCurrentRole();
  const currentUser = getCurrentUser();

  const meetings = useSelector((state) => state.meetings.meetings);
  const participantsMap = useSelector((state) => state.meetings.participants);
  const users = useSelector((state) => state.meetings.users);

  const meeting = meetings.find((item) => item.id === meetingId);
  const participants = participantsMap[meetingId] || [];

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({
    title: meeting?.title || "",
    description: meeting?.description || "",
    dateTime: meeting?.dateTime || "",
    meetingType: meeting?.meetingType || "General",
  });

  const invitedUsers = useMemo(() => {
    if (!meeting) return [];
    return users.filter((user) => (meeting.invitedUserIds || []).includes(user.id));
  }, [meeting, users]);

  if (!meeting) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">Meeting not found.</div>
      </div>
    );
  }

  const invited = isInvitedToMeeting(meeting, currentUser.id, role);
  const host = isMeetingHost(meeting, currentUser.id);

  if (!invited && role !== "ANO") {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">You are not invited to this meeting.</div>
      </div>
    );
  }

  const saveEdit = () => {
    dispatch(editMeeting({ meetingId: meeting.id, updates: draft }));
    setEditMode(false);
  };

  const startMeeting = () => {
    dispatch(updateMeetingStatus({ meetingId: meeting.id, status: MEETING_STATUS.LIVE }));
    dispatch(setCurrentMeeting({ meetingId: meeting.id, userId: currentUser.id }));
    navigate(`${basePath}/${meeting.id}/room`);
  };

  const cancelMeeting = () => {
    dispatch(updateMeetingStatus({ meetingId: meeting.id, status: MEETING_STATUS.CANCELLED }));
  };

  return (
    <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
      <div className="meeting-page-head">
        <div>
          <h1>{meeting.title}</h1>
          <p>Meeting details, invitees, and host controls.</p>
        </div>
      </div>

      <section className="meeting-details-card">
        <div className="meeting-details-grid">
          <div>
            <h3>Meeting Info</h3>
            <p>
              <strong>Status:</strong> {meeting.status}
            </p>
            <p>
              <strong>Type:</strong> {meeting.meetingType}
            </p>
            <p>
              <strong>Date & Time:</strong> {formatMeetingDateTime(meeting.dateTime)}
            </p>
            <p>
              <strong>Description:</strong> {meeting.description}
            </p>
            <p>
              <strong>Joined Participants:</strong> {participants.length}
            </p>
          </div>

          <div>
            <h3>Invited Users</h3>
            <div className="meeting-invite-pills">
              {invitedUsers.map((user) => (
                <span className="meeting-selected-chip" key={user.id}>
                  {user.name} ({user.role})
                </span>
              ))}
            </div>
          </div>
        </div>

        {host ? (
          <div className="meeting-host-controls">
            <button className="meeting-btn meeting-btn-primary" onClick={startMeeting}>
              Start Meeting
            </button>
            <button className="meeting-btn meeting-btn-danger" onClick={cancelMeeting}>
              Cancel Meeting
            </button>
            <button className="meeting-btn meeting-btn-secondary" onClick={() => setEditMode((prev) => !prev)}>
              {editMode ? "Close Edit" : "Edit Meeting"}
            </button>
          </div>
        ) : null}

        {editMode ? (
          <div className="meeting-edit-panel">
            <label>
              <span>Title</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                rows={3}
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
            <label>
              <span>Date & Time</span>
              <input
                type="datetime-local"
                value={draft.dateTime}
                onChange={(event) => setDraft((prev) => ({ ...prev, dateTime: event.target.value }))}
              />
            </label>
            <label>
              <span>Meeting Type</span>
              <select
                value={draft.meetingType}
                onChange={(event) => setDraft((prev) => ({ ...prev, meetingType: event.target.value }))}
              >
                <option value="General">General</option>
                <option value="Training">Training</option>
                <option value="Briefing">Briefing</option>
              </select>
            </label>
            <button className="meeting-btn meeting-btn-primary" onClick={saveEdit}>
              Save Changes
            </button>
          </div>
        ) : null}

        <div className="meeting-details-actions">
          <Link className="meeting-btn meeting-btn-secondary" to={basePath}>
            Back to Meetings
          </Link>
          <Link className="meeting-btn meeting-btn-primary" to={`${basePath}/${meeting.id}/room`}>
            Open Room
          </Link>
        </div>
      </section>
    </div>
  );
};

export default MeetingDetailsPage;
