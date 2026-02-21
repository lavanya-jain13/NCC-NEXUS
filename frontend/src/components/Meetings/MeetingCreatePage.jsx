import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { addMeeting } from "../../store/meetingSlice";
import { MEETING_STATUS, MEETING_TYPES, canCreateMeeting, getCurrentRole, getCurrentUser } from "./meetingUtils";
import "./meetingModule.css";

const buildId = () => `M-${Date.now()}`;

const MeetingCreatePage = ({ embedded = false, basePath = "/meetings" }) => {
  const role = getCurrentRole();
  const currentUser = getCurrentUser();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const users = useSelector((state) => state.meetings.users).filter(
    (user) => Number(user.id) !== Number(currentUser.id)
  );

  const [form, setForm] = useState({
    title: "",
    description: "",
    dateTime: "",
    meetingType: "General",
    restricted: false,
  });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const roleAllowed = canCreateMeeting(role);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const roleMatch = roleFilter === "ALL" ? true : user.role === roleFilter;
      const searchMatch = user.name.toLowerCase().includes(search.toLowerCase());
      return roleMatch && searchMatch;
    });
  }, [users, search, roleFilter]);

  const isValid =
    form.title.trim().length > 1 &&
    form.description.trim().length > 1 &&
    form.dateTime &&
    form.meetingType &&
    selectedUsers.length > 0;

  const toggleUser = (id) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((userId) => userId !== id) : [...prev, id]
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isValid || !roleAllowed) return;

    const meeting = {
      id: buildId(),
      title: form.title.trim(),
      description: form.description.trim(),
      dateTime: form.dateTime,
      meetingType: form.meetingType,
      restricted: form.restricted,
      invitedUserIds: [currentUser.id, ...selectedUsers],
      createdBy: currentUser.id,
      status: MEETING_STATUS.SCHEDULED,
    };

    dispatch(addMeeting(meeting));
    navigate(`${basePath}/${meeting.id}`);
  };

  if (!roleAllowed) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">Only ANO and SUO can schedule meetings.</div>
      </div>
    );
  }

  return (
    <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
      <div className="meeting-page-head">
        <div>
          <h1>Create Meeting</h1>
          <p>Configure schedule, type, and invite list.</p>
        </div>
      </div>

      <form className="meeting-create-form" onSubmit={handleSubmit}>
        <div className="meeting-form-grid">
          <label className="meeting-form-field">
            <span>Title *</span>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Enter meeting title"
            />
          </label>

          <label className="meeting-form-field">
            <span>Date & Time *</span>
            <input
              type="datetime-local"
              value={form.dateTime}
              onChange={(event) => setForm((prev) => ({ ...prev, dateTime: event.target.value }))}
            />
          </label>

          <label className="meeting-form-field meeting-form-field-full">
            <span>Description *</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Enter meeting description"
            />
          </label>

          <label className="meeting-form-field">
            <span>Meeting Type *</span>
            <select
              value={form.meetingType}
              onChange={(event) => setForm((prev) => ({ ...prev, meetingType: event.target.value }))}
            >
              {MEETING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="meeting-form-toggle">
            <input
              type="checkbox"
              checked={form.restricted}
              onChange={(event) => setForm((prev) => ({ ...prev, restricted: event.target.checked }))}
            />
            <span>Restricted Meeting</span>
          </label>
        </div>

        <section className="meeting-invite-selector">
          <div className="meeting-invite-head">
            <h3>Invite Users *</h3>
            <div className="meeting-invite-filters">
              <input
                placeholder="Search user"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="ALL">All Roles</option>
                <option value="SUO">SUO</option>
                <option value="CADET">Cadet</option>
                <option value="ALUMNI">Alumni</option>
                <option value="ANO">ANO</option>
              </select>
            </div>
          </div>

          <div className="meeting-invite-selected">
            {selectedUsers.length ? (
              selectedUsers.map((id) => {
                const user = users.find((item) => item.id === id);
                if (!user) return null;
                return (
                  <span key={id} className="meeting-selected-chip">
                    {user.name} ({user.role})
                  </span>
                );
              })
            ) : (
              <span className="meeting-empty-inline">No invited users selected</span>
            )}
          </div>

          <div className="meeting-invite-list">
            {filteredUsers.map((user) => (
              <label key={user.id} className="meeting-invite-row">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(user.id)}
                  onChange={() => toggleUser(user.id)}
                />
                <span className="meeting-user-name">{user.name}</span>
                <span className="meeting-user-role">{user.role}</span>
              </label>
            ))}
          </div>
        </section>

        <button className="meeting-btn meeting-btn-primary" type="submit" disabled={!isValid}>
          Schedule Meeting
        </button>
      </form>
    </div>
  );
};

export default MeetingCreatePage;
