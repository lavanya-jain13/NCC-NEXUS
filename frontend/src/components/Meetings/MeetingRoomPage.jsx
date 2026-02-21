import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff, VolumeX } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  joinMeeting,
  leaveMeeting,
  muteParticipant,
  removeParticipant,
  setConnectionStatus,
  setCurrentMeeting,
  toggleCamera,
  toggleMic,
  updateMeetingStatus,
} from "../../store/meetingSlice";
import {
  MEETING_STATUS,
  getCurrentRole,
  getCurrentUser,
  isInvitedToMeeting,
  isMeetingHost,
} from "./meetingUtils";
import "./meetingModule.css";

const formatTimer = (seconds) => {
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const MeetingRoomPage = ({ embedded = false, basePath = "/meetings" }) => {
  const { meetingId } = useParams();
  const role = getCurrentRole();
  const currentUser = getCurrentUser();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const meetings = useSelector((state) => state.meetings.meetings);
  const users = useSelector((state) => state.meetings.users);
  const participantsMap = useSelector((state) => state.meetings.participants);

  const meeting = meetings.find((item) => item.id === meetingId);
  const participants = participantsMap[meetingId] || [];

  const [seconds, setSeconds] = useState(0);

  const participantViews = useMemo(() => {
    return participants
      .map((participant) => {
        const user = users.find((item) => Number(item.id) === Number(participant.userId));
        if (!user) return null;
        return {
          ...participant,
          user,
          isHost: meeting ? Number(meeting.createdBy) === Number(participant.userId) : false,
        };
      })
      .filter(Boolean);
  }, [participants, users, meeting]);

  useEffect(() => {
    if (!meeting) return;
    if (!isInvitedToMeeting(meeting, currentUser.id, role)) return;

    dispatch(setCurrentMeeting({ meetingId: meeting.id, userId: currentUser.id }));
    dispatch(joinMeeting({ meetingId: meeting.id, userId: currentUser.id }));
    dispatch(setConnectionStatus("CONNECTED"));

    return () => {
      dispatch(leaveMeeting({ meetingId: meeting.id, userId: currentUser.id }));
      dispatch(setConnectionStatus("DISCONNECTED"));
    };
  }, [meeting, currentUser.id, role, dispatch]);

  useEffect(() => {
    if (!meeting || meeting.status !== MEETING_STATUS.LIVE) return undefined;

    const timer = setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [meeting]);

  if (!meeting) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">Meeting room not found.</div>
      </div>
    );
  }

  const invited = isInvitedToMeeting(meeting, currentUser.id, role);
  const host = isMeetingHost(meeting, currentUser.id);
  const me = participantViews.find((participant) => Number(participant.userId) === Number(currentUser.id));

  if (!invited) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">You are not invited to this meeting room.</div>
      </div>
    );
  }

  if (meeting.status !== MEETING_STATUS.LIVE) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">Join is enabled only when the meeting is LIVE.</div>
        <Link className="meeting-btn meeting-btn-secondary" to={`${basePath}/${meeting.id}`}>
          Back to Details
        </Link>
      </div>
    );
  }

  const leaveRoom = () => {
    dispatch(leaveMeeting({ meetingId: meeting.id, userId: currentUser.id }));
    dispatch(setConnectionStatus("DISCONNECTED"));
    navigate(`${basePath}/${meeting.id}`);
  };

  const endMeeting = () => {
    dispatch(updateMeetingStatus({ meetingId: meeting.id, status: MEETING_STATUS.ENDED }));
    leaveRoom();
  };

  return (
    <div className={`meeting-room-page ${embedded ? "meeting-page-embedded" : ""}`}>
      <header className="meeting-room-topbar">
        <div>
          <h2>{meeting.title}</h2>
          <p>{formatTimer(seconds)}</p>
        </div>
        <span className="meeting-status-badge meeting-status-live">LIVE</span>
      </header>

      <div className="meeting-room-layout">
        <section className="meeting-video-grid">
          {participantViews.map((participant) => (
            <article key={participant.userId} className="meeting-video-tile">
              <div className="meeting-avatar">{participant.user.name.slice(0, 1)}</div>
              <h4>{participant.user.name}</h4>
              <div className="meeting-video-meta">
                <span className="meeting-user-role">{participant.user.role}</span>
                <span className="meeting-mic-indicator">
                  {participant.micOn ? <Mic size={14} /> : <MicOff size={14} />}
                </span>
              </div>
            </article>
          ))}
        </section>

        <aside className="meeting-room-sidebar">
          <h3>Participants ({participantViews.length})</h3>
          {participantViews.map((participant) => (
            <div key={participant.userId} className="meeting-participant-row">
              <div>
                <strong>{participant.user.name}</strong>
                {participant.isHost ? <span className="meeting-host-chip">Host</span> : null}
              </div>
              {host && !participant.isHost ? (
                <div className="meeting-participant-actions">
                  <button
                    className="meeting-icon-btn"
                    onClick={() => dispatch(muteParticipant({ meetingId: meeting.id, userId: participant.userId }))}
                    title="Mute"
                  >
                    <VolumeX size={14} />
                  </button>
                  <button
                    className="meeting-icon-btn meeting-icon-btn-danger"
                    onClick={() => dispatch(removeParticipant({ meetingId: meeting.id, userId: participant.userId }))}
                    title="Remove"
                  >
                    <PhoneOff size={14} />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </aside>
      </div>

      <footer className="meeting-room-controls">
        <button
          className="meeting-icon-btn"
          onClick={() => dispatch(toggleMic({ meetingId: meeting.id, userId: currentUser.id }))}
        >
          {me?.micOn ? <Mic size={16} /> : <MicOff size={16} />}
          <span>Mic</span>
        </button>

        <button
          className="meeting-icon-btn"
          onClick={() => dispatch(toggleCamera({ meetingId: meeting.id, userId: currentUser.id }))}
        >
          {me?.cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
          <span>Camera</span>
        </button>

        <button className="meeting-icon-btn">
          <MonitorUp size={16} />
          <span>Share</span>
        </button>

        <button className="meeting-icon-btn meeting-icon-btn-danger" onClick={leaveRoom}>
          <PhoneOff size={16} />
          <span>Leave</span>
        </button>

        {host ? (
          <button className="meeting-icon-btn meeting-icon-btn-danger" onClick={endMeeting}>
            <PhoneOff size={16} />
            <span>End Meeting</span>
          </button>
        ) : null}
      </footer>
    </div>
  );
};

export default MeetingRoomPage;
