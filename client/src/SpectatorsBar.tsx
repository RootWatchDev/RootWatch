import React from "react";
import { SpectatorInfo, RoomPlaybackState } from "@rootwatch/gen-shared";

interface SpectatorsBarProps {
  roomState: RoomPlaybackState | null;
  spectators: SpectatorInfo[];
  onToggleDjMode: (enabled: boolean) => void;
}

export const SpectatorsBar: React.FC<SpectatorsBarProps> = ({
  roomState,
  spectators,
  onToggleDjMode
}) => {
  const isDjMode = roomState?.djModeEnabled ?? false;
  const inSyncCount = spectators.filter((s) => s.inSync && !s.isBuffering).length;
  const totalCount = Math.max(1, spectators.length);

  return (
    <div className="spectators-bar-container">
      <div className="spectators-left">
        <div className="room-badge">
          <span className="room-icon">🎬</span>
          <span className="room-title">RootWatch</span>
        </div>

        {/* DJ Mode Switcher */}
        <div className="dj-mode-wrapper">
          <button
            className={`dj-mode-toggle ${isDjMode ? "active" : ""}`}
            onClick={() => onToggleDjMode(!isDjMode)}
            title={isDjMode ? "DJ Mode is ON (Host only controls)" : "Free-for-all mode (Anyone can control)"}
          >
            <span className="dj-icon">{isDjMode ? "👑" : "👥"}</span>
            <span className="dj-label">
              {isDjMode ? "DJ Mode (Host Only)" : "Free-for-All Mode"}
            </span>
          </button>
        </div>

        {/* Sync Metric */}
        <div className="sync-metric-pill">
          <span className="metric-dot green" />
          <span className="metric-text">{inSyncCount}/{totalCount} In Sync</span>
        </div>
      </div>

      {/* Spectator Avatars & Status Pills */}
      <div className="spectators-list">
        {spectators.map((spec) => (
          <div
            key={spec.userId}
            className={`spectator-pill ${spec.isBuffering ? "buffering" : spec.inSync ? "in-sync" : "steering"}`}
            title={`${spec.username} - Drift: ${Math.round(spec.driftMs)}ms`}
          >
            <div className="spectator-avatar">
              {spec.username.slice(0, 2).toUpperCase()}
            </div>
            <span className="spectator-name">{spec.username}</span>

            {spec.isBuffering ? (
              <span className="status-indicator icon-spin">🔄</span>
            ) : spec.inSync ? (
              <span className="status-indicator">🟢</span>
            ) : (
              <span className="status-indicator">🟡</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
