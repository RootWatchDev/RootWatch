import React, { useState } from "react";
import { MediaSourceType, RoomPlaybackState } from "@rootwatch/gen-shared";

interface PlaylistDrawerProps {
  roomState: RoomPlaybackState | null;
  onQueueMedia: (url: string, title?: string) => void;
  onRemoveFromQueue: (mediaId: string) => void;
  onSkipToNext: () => void;
}

export const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({
  roomState,
  onQueueMedia,
  onRemoveFromQueue,
  onSkipToNext
}) => {
  const [inputUrl, setInputUrl] = useState<string>("");
  const [inputTitle, setInputTitle] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"queue" | "suggestions">("queue");

  const currentMedia = roomState?.currentMedia;
  const playlist = roomState?.playlist || [];

  const handleAddMedia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    onQueueMedia(inputUrl.trim(), inputTitle.trim());
    setInputUrl("");
    setInputTitle("");
  };

  const sampleStreams = [
    {
      title: "Lofi Girl - Beats to relax/study to",
      url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      category: "Lofi Beats"
    },
    {
      title: "Synthwave Radio - Chill Synth / Retro",
      url: "https://www.youtube.com/watch?v=4xDzrJKXOOY",
      category: "Synthwave"
    },
    {
      title: "Big Buck Bunny 4K (Direct MP4 Stream)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      category: "Direct MP4"
    },
    {
      title: "Sintel Animation (Direct MP4 Stream)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
      category: "Direct MP4"
    }
  ];

  return (
    <div className="playlist-drawer-container">
      {/* Drawer Header & Tabs */}
      <div className="drawer-header">
        <div className="drawer-tabs">
          <button
            className={`tab-btn ${activeTab === "queue" ? "active" : ""}`}
            onClick={() => setActiveTab("queue")}
          >
            📋 Queue ({playlist.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "suggestions" ? "active" : ""}`}
            onClick={() => setActiveTab("suggestions")}
          >
            ✨ Quick Add
          </button>
        </div>

        {currentMedia && (
          <button
            className="skip-btn"
            onClick={onSkipToNext}
            title="Skip to next video"
          >
            Skip ⏭
          </button>
        )}
      </div>

      {/* Add Media Bar */}
      <form className="add-media-form" onSubmit={handleAddMedia}>
        <div className="input-group">
          <input
            type="text"
            className="url-input"
            placeholder="Paste YouTube or Direct MP4/HLS URL..."
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
          />
          <button type="submit" className="add-submit-btn" disabled={!inputUrl.trim()}>
            + Add
          </button>
        </div>
      </form>

      {/* Active Tab Content */}
      <div className="drawer-content">
        {activeTab === "queue" ? (
          <div className="queue-list-section">
            {/* Now Playing Card */}
            {currentMedia ? (
              <div className="now-playing-card">
                <div className="card-badge">NOW PLAYING</div>
                <div className="card-body">
                  {currentMedia.thumbnailUrl ? (
                    <img
                      src={currentMedia.thumbnailUrl}
                      alt={currentMedia.title}
                      className="card-thumb"
                    />
                  ) : (
                    <div className="card-thumb-placeholder">🎬</div>
                  )}
                  <div className="card-info">
                    <h4 className="card-title">{currentMedia.title}</h4>
                    <span className="card-meta">
                      Queued by {currentMedia.queuedByUsername || "Anonymous"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-playing-card">
                <span>No media currently playing</span>
              </div>
            )}

            {/* Up Next List */}
            <div className="up-next-section">
              <h5 className="section-title">UP NEXT ({playlist.length})</h5>

              {playlist.length === 0 ? (
                <div className="empty-queue-msg">
                  <p>Queue is empty. Paste a link above or pick from Quick Add!</p>
                </div>
              ) : (
                <div className="queue-items-scroll">
                  {playlist.map((item, index) => (
                    <div key={item.id} className="queue-item-row">
                      <span className="item-index">{index + 1}</span>

                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="item-thumb"
                        />
                      ) : (
                        <div className="item-thumb-placeholder">
                          {item.sourceType === MediaSourceType.MEDIA_SOURCE_YOUTUBE ? "▶" : "🎞"}
                        </div>
                      )}

                      <div className="item-details">
                        <span className="item-title">{item.title}</span>
                        <span className="item-user">by {item.queuedByUsername}</span>
                      </div>

                      <button
                        className="item-delete-btn"
                        onClick={() => onRemoveFromQueue(item.id)}
                        title="Remove from queue"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Quick Add Suggestions Tab */
          <div className="suggestions-section">
            <h5 className="section-title">POPULAR CHILL STREAMS</h5>
            <div className="suggestions-list">
              {sampleStreams.map((sample) => (
                <div key={sample.url} className="suggestion-card">
                  <div className="suggestion-info">
                    <span className="suggestion-category">{sample.category}</span>
                    <h5 className="suggestion-title">{sample.title}</h5>
                  </div>
                  <button
                    className="quick-add-btn"
                    onClick={() => onQueueMedia(sample.url, sample.title)}
                  >
                    + Queue
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
