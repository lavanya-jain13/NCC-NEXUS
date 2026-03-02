import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Filter, Sparkles } from "lucide-react";
import VoiceCommandCard from "./VoiceCommandCard";
import { VOICE_COMMANDS, VOICE_COMMAND_TYPES } from "./voiceCommandsData";
import commandAudio from "./assets/command-sample.mp3";
import "./voiceCommands.css";

const LEARNED_STORAGE_KEY = "voice_commands_learned_v1";

const safeReadLearned = () => {
  try {
    const raw = localStorage.getItem(LEARNED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
};

export default function VoiceCommandsModule() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [learnedOnly, setLearnedOnly] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [learned, setLearned] = useState(() => safeReadLearned());
  const [nowPlaying, setNowPlaying] = useState({ id: null, speed: 1 });

  const audioRefs = useRef({});
  const activeAudioRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(LEARNED_STORAGE_KEY, JSON.stringify(learned));
  }, [learned]);

  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return VOICE_COMMANDS.filter((command) => {
      if (typeFilter !== "All" && command.type !== typeFilter) {
        return false;
      }

      if (learnedOnly && !learned[command.id]) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        command.name.toLowerCase().includes(normalizedQuery) ||
        command.type.toLowerCase().includes(normalizedQuery) ||
        command.hindi.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, typeFilter, learnedOnly, learned]);

  const registerAudioRef = (id, node) => {
    if (!node) {
      delete audioRefs.current[id];
      return;
    }

    audioRefs.current[id] = node;

    node.onended = () => {
      setNowPlaying((current) => (current.id === id ? { id: null, speed: 1 } : current));
    };
  };

  const playCommandAudio = async (id, speed = 1) => {
    const audio = audioRefs.current[id];
    if (!audio) return;

    if (activeAudioRef.current && activeAudioRef.current !== audio) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.playbackRate = speed;

    try {
      await audio.play();
      activeAudioRef.current = audio;
      setNowPlaying({ id, speed });
    } catch (_error) {
      setNowPlaying({ id: null, speed: 1 });
    }
  };

  const toggleExpanded = (id) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleLearned = (id) => {
    setLearned((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="voice-module-shell">
      <header className="voice-module-header">
        <div className="voice-module-title-row">
          <h2>Voice Command Trainer</h2>
          <span className="voice-module-count">{filteredCommands.length} commands</span>
        </div>

        <div className="voice-module-controls">
          <div className="voice-search-wrap">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by command, type, or Hindi text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="voice-filter-wrap">
            <Filter size={15} />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="All">All Types</option>
              {VOICE_COMMAND_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="voice-toggle-group" role="group" aria-label="Learned filter">
            <button
              type="button"
              className={!learnedOnly ? "active" : ""}
              onClick={() => setLearnedOnly(false)}
            >
              Show All
            </button>
            <button
              type="button"
              className={learnedOnly ? "active" : ""}
              onClick={() => setLearnedOnly(true)}
            >
              <Sparkles size={13} />
              Learned Only
            </button>
          </div>
        </div>
      </header>

      <div className="voice-card-list" role="list">
        {filteredCommands.map((command) => (
          <VoiceCommandCard
            key={command.id}
            command={command}
            audioSrc={commandAudio}
            isExpanded={Boolean(expanded[command.id])}
            isLearned={Boolean(learned[command.id])}
            isPlaying={nowPlaying.id === command.id}
            playingSpeed={nowPlaying.speed}
            onToggleExpand={() => toggleExpanded(command.id)}
            onToggleLearned={() => toggleLearned(command.id)}
            onPlay={(speed) => playCommandAudio(command.id, speed)}
            onAudioRef={(node) => registerAudioRef(command.id, node)}
          />
        ))}

        {!filteredCommands.length ? (
          <div className="voice-empty-state">No commands matched your current filters.</div>
        ) : null}
      </div>
    </div>
  );
}
