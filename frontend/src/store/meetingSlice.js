import { createSlice } from "@reduxjs/toolkit";
import { MEETING_STATUS } from "../components/Meetings/meetingUtils";

const mockUsers = [
  { id: 101, name: "Lt. Meera Nair", role: "ANO" },
  { id: 102, name: "SUO Arjun Rana", role: "SUO" },
  { id: 103, name: "Cadet Priya Singh", role: "CADET" },
  { id: 104, name: "Cadet Rohan Das", role: "CADET" },
  { id: 105, name: "Alumni Kavya Menon", role: "ALUMNI" },
  { id: 106, name: "Cadet Imran Khan", role: "CADET" },
  { id: 107, name: "SUO Neha Bist", role: "SUO" },
  { id: 108, name: "Alumni Aditya Rao", role: "ALUMNI" },
];

const initialMeetings = [
  {
    id: "M-1001",
    title: "Weekly Training Brief",
    description: "Agenda briefing and drill preparation for the upcoming parade.",
    dateTime: "2026-02-22T10:00:00",
    meetingType: "Training",
    restricted: true,
    invitedUserIds: [102, 103, 104, 106],
    createdBy: 101,
    status: MEETING_STATUS.SCHEDULED,
  },
  {
    id: "M-1002",
    title: "Live Unit Coordination",
    description: "Ongoing coordination call for event logistics.",
    dateTime: "2026-02-21T09:30:00",
    meetingType: "General",
    restricted: false,
    invitedUserIds: [101, 102, 103, 104, 105, 106, 107, 108],
    createdBy: 102,
    status: MEETING_STATUS.LIVE,
  },
  {
    id: "M-1003",
    title: "Annual Briefing Review",
    description: "Post-event debrief and archive review.",
    dateTime: "2026-02-12T15:00:00",
    meetingType: "Briefing",
    restricted: true,
    invitedUserIds: [101, 102, 105, 108],
    createdBy: 101,
    status: MEETING_STATUS.ENDED,
  },
];

const initialParticipants = {
  "M-1001": [{ userId: 101, micOn: true, cameraOn: true }],
  "M-1002": [
    { userId: 102, micOn: true, cameraOn: true },
    { userId: 103, micOn: true, cameraOn: false },
    { userId: 104, micOn: false, cameraOn: true },
    { userId: 105, micOn: true, cameraOn: true },
  ],
  "M-1003": [{ userId: 101, micOn: true, cameraOn: true }],
};

const initialState = {
  users: mockUsers,
  meetings: initialMeetings,
  currentMeeting: null,
  invitedUsers: [],
  participants: initialParticipants,
  isHost: false,
  meetingStatus: "IDLE",
  connectionStatus: "DISCONNECTED",
};

const updateParticipant = (state, meetingId, userId, updater) => {
  const list = state.participants[meetingId] || [];
  state.participants[meetingId] = list.map((participant) => {
    if (Number(participant.userId) !== Number(userId)) return participant;
    return updater(participant);
  });
};

const meetingsSlice = createSlice({
  name: "meetings",
  initialState,
  reducers: {
    addMeeting(state, action) {
      const meeting = action.payload;
      state.meetings.unshift(meeting);
      state.participants[meeting.id] = [{
        userId: meeting.createdBy,
        micOn: true,
        cameraOn: true,
      }];
    },
    editMeeting(state, action) {
      const { meetingId, updates } = action.payload;
      state.meetings = state.meetings.map((meeting) =>
        meeting.id === meetingId ? { ...meeting, ...updates } : meeting
      );
      if (state.currentMeeting?.id === meetingId) {
        state.currentMeeting = { ...state.currentMeeting, ...updates };
      }
    },
    setInvitedUsers(state, action) {
      state.invitedUsers = action.payload || [];
    },
    setCurrentMeeting(state, action) {
      const { meetingId, userId } = action.payload || {};
      const found = state.meetings.find((meeting) => meeting.id === meetingId) || null;
      state.currentMeeting = found;
      state.isHost = Boolean(found && Number(found.createdBy) === Number(userId));
      state.meetingStatus = found ? found.status : "IDLE";
    },
    updateMeetingStatus(state, action) {
      const { meetingId, status } = action.payload;
      state.meetings = state.meetings.map((meeting) =>
        meeting.id === meetingId ? { ...meeting, status } : meeting
      );
      if (state.currentMeeting?.id === meetingId) {
        state.currentMeeting = { ...state.currentMeeting, status };
      }
      state.meetingStatus = status;
    },
    joinMeeting(state, action) {
      const { meetingId, userId } = action.payload;
      const list = state.participants[meetingId] || [];
      const exists = list.some((participant) => Number(participant.userId) === Number(userId));
      if (!exists) {
        list.push({ userId, micOn: true, cameraOn: true });
      }
      state.participants[meetingId] = list;
      state.connectionStatus = "CONNECTED";
    },
    leaveMeeting(state, action) {
      const { meetingId, userId } = action.payload;
      state.participants[meetingId] = (state.participants[meetingId] || []).filter(
        (participant) => Number(participant.userId) !== Number(userId)
      );
      state.connectionStatus = "DISCONNECTED";
    },
    toggleMic(state, action) {
      const { meetingId, userId } = action.payload;
      updateParticipant(state, meetingId, userId, (participant) => ({
        ...participant,
        micOn: !participant.micOn,
      }));
    },
    toggleCamera(state, action) {
      const { meetingId, userId } = action.payload;
      updateParticipant(state, meetingId, userId, (participant) => ({
        ...participant,
        cameraOn: !participant.cameraOn,
      }));
    },
    muteParticipant(state, action) {
      const { meetingId, userId } = action.payload;
      updateParticipant(state, meetingId, userId, (participant) => ({ ...participant, micOn: false }));
    },
    removeParticipant(state, action) {
      const { meetingId, userId } = action.payload;
      state.participants[meetingId] = (state.participants[meetingId] || []).filter(
        (participant) => Number(participant.userId) !== Number(userId)
      );
    },
    setConnectionStatus(state, action) {
      state.connectionStatus = action.payload;
    },
  },
});

export const {
  addMeeting,
  editMeeting,
  setInvitedUsers,
  setCurrentMeeting,
  updateMeetingStatus,
  joinMeeting,
  leaveMeeting,
  toggleMic,
  toggleCamera,
  muteParticipant,
  removeParticipant,
  setConnectionStatus,
} = meetingsSlice.actions;

export default meetingsSlice.reducer;
