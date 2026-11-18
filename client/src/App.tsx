import React, { useState } from "react";
import { useSyncEngine } from "./useSyncEngine";
import { MediaPlayer } from "./MediaPlayer";
import { SpectatorsBar } from "./SpectatorsBar";
import { PlaylistDrawer } from "./PlaylistDrawer";
import { ReactionsOverlay } from "./ReactionsOverlay";
import "./styles.css";

const App: React.FC = () => {
  const {
    roomState,
    spectators,
    reactions,
    syncStatus,
    driftMs,
    effectiveRate,
    expectedPosition,
    play,
    pause,
    seek,
    queueMedia,
    removeFromQueue,
    skipToNext,
    toggleDjMode,
    sendReaction,
    reportPlayerState,
    registerPlayerController
  } = useSyncEngine();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  };

  const handlePlay = async (time: number) => {
    try {
      await play(time);
    } catch (err: any) {
      showError(err?.message || "Failed to start playback");
    }
  };

  const handlePause = async (time: number) => {
    try {
      await pause(time);
    } catch (err: any) {
      showError(err?.message || "Failed to pause playback");
    }
  };

  const handleSeek = async (seconds: number) => {
    try {
      await seek(seconds);
    } catch (err: any) {
      showError(err?.message || "Failed to seek");
    }
  };

  return (
    <div className="rootwatch-app-root">
      {/* Toast error banner */}
      {errorMessage && (
        <div className="toast-notification">
          <span className="toast-icon">⚠️</span>
          <span className="toast-text">{errorMessage}</span>
        </div>
      )}

      {/* Top Presence & DJ Controls Header */}
      <SpectatorsBar
        roomState={roomState}
        spectators={spectators}
        onToggleDjMode={toggleDjMode}
      />

      {/* Main Cinema & Queue Workspace */}
      <main className="rootwatch-workspace">
        <section className="player-section">
          <MediaPlayer
            currentMedia={roomState?.currentMedia}
            playbackState={roomState?.state ?? 0}
            expectedPosition={expectedPosition}
            effectiveRate={effectiveRate}
            syncStatus={syncStatus}
            driftMs={driftMs}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onEnded={skipToNext}
            onBufferingChange={(isBuffering) => reportPlayerState(0, isBuffering)}
            registerController={registerPlayerController}
          />
        </section>

        <aside className="sidebar-section">
          <PlaylistDrawer
            roomState={roomState}
            onQueueMedia={queueMedia}
            onRemoveFromQueue={removeFromQueue}
            onSkipToNext={skipToNext}
          />
        </aside>
      </main>

      {/* Real-time Emoji Reactions Overlay */}
      <ReactionsOverlay
        reactions={reactions}
        onSendReaction={sendReaction}
      />
    </div>
  );
};

export default App;
