import React, { useEffect, useRef, useState, useCallback } from "react";
import { MediaItem, MediaSourceType, PlaybackState } from "@rootwatch/gen-shared";
import { PlayerController } from "./useSyncEngine";

interface MediaPlayerProps {
  currentMedia: MediaItem | undefined;
  playbackState: PlaybackState;
  expectedPosition: number;
  effectiveRate: number;
  syncStatus: string;
  driftMs: number;
  onPlay: (currentTime: number) => void;
  onPause: (currentTime: number) => void;
  onSeek: (seconds: number) => void;
  onEnded: () => void;
  onBufferingChange: (isBuffering: boolean) => void;
  registerController: (controller: PlayerController) => void;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  currentMedia,
  playbackState,
  expectedPosition,
  effectiveRate,
  syncStatus,
  driftMs,
  onPlay,
  onPause,
  onSeek,
  onEnded,
  onBufferingChange,
  registerController
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const loadedYtIdRef = useRef<string | null>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isHoveringControls, setIsHoveringControls] = useState<boolean>(false);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [isPlayingLocally, setIsPlayingLocally] = useState<boolean>(false);

  // References to keep dependency array of effect stable and prevent thrashed re-inits
  const playbackStateRef = useRef<PlaybackState>(playbackState);
  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  const expectedPositionRef = useRef<number>(expectedPosition);
  useEffect(() => {
    expectedPositionRef.current = expectedPosition;
  }, [expectedPosition]);

  // Extract YouTube ID if applicable
  const getYouTubeId = (url?: string): string | null => {
    if (!url) return null;
    const match = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i
    );
    return match ? match[1] : null;
  };

  const isYouTube = currentMedia ? (currentMedia.sourceType === MediaSourceType.MEDIA_SOURCE_YOUTUBE || !!getYouTubeId(currentMedia.url)) : false;
  const ytVideoId = currentMedia ? getYouTubeId(currentMedia.url) : null;

  // Controller registration for YouTube
  const setupYtController = useCallback(() => {
    registerController({
      play: () => {
        if (ytPlayerRef.current?.playVideo) {
          try {
            ytPlayerRef.current.playVideo();
          } catch {}
        }
      },
      pause: () => {
        if (ytPlayerRef.current?.pauseVideo) {
          try {
            ytPlayerRef.current.pauseVideo();
          } catch {}
        }
      },
      seekTo: (sec) => {
        if (ytPlayerRef.current?.seekTo) {
          try {
            ytPlayerRef.current.seekTo(sec, true);
          } catch {}
        }
      },
      setRate: (rate) => {
        if (ytPlayerRef.current?.setPlaybackRate) {
          try {
            const ytRate = rate >= 1.2 ? 1.25 : rate <= 0.8 ? 0.75 : 1.0;
            ytPlayerRef.current.setPlaybackRate(ytRate);
          } catch {}
        }
      },
      getCurrentTime: () => {
        if (ytPlayerRef.current?.getCurrentTime) {
          try {
            return ytPlayerRef.current.getCurrentTime() || 0;
          } catch {}
        }
        return 0;
      }
    });
  }, [registerController]);

  // Controller registration for Direct Video
  const setupDirectController = useCallback(() => {
    registerController({
      play: () => {
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      seekTo: (sec) => {
        if (videoRef.current) {
          videoRef.current.currentTime = sec;
        }
      },
      setRate: (rate) => {
        if (videoRef.current) {
          videoRef.current.playbackRate = rate;
        }
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime || 0;
      }
    });
  }, [registerController]);

  // Stable YouTube initialization & dynamic video loader
  useEffect(() => {
    if (!isYouTube || !ytVideoId) return;

    setEmbedError(null);

    // If player already exists, immediately load or cue the new video ID
    if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === "function") {
      if (loadedYtIdRef.current !== ytVideoId) {
        loadedYtIdRef.current = ytVideoId;
        const startSec = expectedPositionRef.current > 1 ? expectedPositionRef.current : 0;
        try {
          if (playbackStateRef.current === PlaybackState.PLAYING) {
            ytPlayerRef.current.loadVideoById(ytVideoId, startSec);
          } else {
            ytPlayerRef.current.cueVideoById(ytVideoId, startSec);
          }
        } catch (err) {
          console.warn("Failed to load new video on existing player:", err);
        }
      }
      return;
    }

    if (ytPlayerRef.current) return;

    let isSubscribed = true;

    const createPlayer = () => {
      if (!isSubscribed) return;
      if (!window.YT || !window.YT.Player) {
        setTimeout(createPlayer, 100);
        return;
      }

      const targetEl = document.getElementById("yt-player-target");
      if (!targetEl) {
        setTimeout(createPlayer, 100);
        return;
      }

      loadedYtIdRef.current = ytVideoId;

      try {
        ytPlayerRef.current = new window.YT.Player("yt-player-target", {
          width: "100%",
          height: "100%",
          videoId: ytVideoId,
          playerVars: {
            autoplay: playbackStateRef.current === PlaybackState.PLAYING ? 1 : 0,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
            start: expectedPositionRef.current > 1 ? Math.floor(expectedPositionRef.current) : 0
          },
          events: {
            onReady: (event: any) => {
              if (!isSubscribed) return;
              event.target.setVolume(isMuted ? 0 : volume * 100);
              const d = event.target.getDuration() || 0;
              setDuration(d);
              setupYtController();

              if (expectedPositionRef.current > 1) {
                try {
                  event.target.seekTo(expectedPositionRef.current, true);
                } catch {}
              }

              if (playbackStateRef.current === PlaybackState.PLAYING) {
                try {
                  event.target.playVideo();
                } catch {}
              }
            },
            onStateChange: (event: any) => {
              // YT.PlayerState: -1 (UNSTARTED), 0 (ENDED), 1 (PLAYING), 2 (PAUSED), 3 (BUFFERING), 5 (CUED)
              if (event.data === 0) {
                onEnded();
                setIsPlayingLocally(false);
              } else if (event.data === 3) {
                onBufferingChange(true);
              } else if (event.data === 1) {
                onBufferingChange(false);
                setEmbedError(null);
                setIsPlayingLocally(true);
              } else if (event.data === 2 || event.data === 5) {
                onBufferingChange(false);
                setIsPlayingLocally(false);
              }
            },
            onError: (e: any) => {
              console.error("YouTube error code:", e.data);
              if (e.data === 101 || e.data === 150) {
                setEmbedError("Embedding restricted: The creator of this video disabled playback outside YouTube.");
              } else if (e.data === 100) {
                setEmbedError("Video not found or removed from YouTube.");
              } else {
                setEmbedError(`Playback error (code ${e.data}).`);
              }
            }
          }
        });
      } catch (err) {
        console.error("Failed to construct YouTube Player:", err);
      }
    };

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = createPlayer;
    } else {
      createPlayer();
    }

    return () => {
      isSubscribed = false;
    };
  }, [isYouTube, ytVideoId, onBufferingChange, onEnded, setupYtController, volume, isMuted]);

  // Synchronize playback state changes directly to active player
  useEffect(() => {
    if (playbackState === PlaybackState.PLAYING) {
      if (isYouTube && ytPlayerRef.current?.playVideo) {
        try {
          ytPlayerRef.current.playVideo();
        } catch {}
      } else if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    } else if (playbackState === PlaybackState.PAUSED) {
      if (isYouTube && ytPlayerRef.current?.pauseVideo) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch {}
      } else if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  }, [playbackState, isYouTube]);

  // Setup direct video controller
  useEffect(() => {
    if (!isYouTube) {
      setupDirectController();
      if (videoRef.current && expectedPosition > 1) {
        videoRef.current.currentTime = expectedPosition;
      }
    }
  }, [isYouTube, setupDirectController, expectedPosition]);

  // Volume synchronization
  useEffect(() => {
    const volLevel = isMuted ? 0 : volume;
    if (isYouTube && ytPlayerRef.current?.setVolume) {
      try {
        ytPlayerRef.current.setVolume(volLevel * 100);
      } catch {}
    } else if (videoRef.current) {
      videoRef.current.volume = volLevel;
    }
  }, [volume, isMuted, isYouTube]);

  // Periodic UI progress update
  useEffect(() => {
    const interval = setInterval(() => {
      if (isYouTube && ytPlayerRef.current?.getCurrentTime) {
        try {
          const t = ytPlayerRef.current.getCurrentTime() || 0;
          const d = ytPlayerRef.current.getDuration() || 0;
          setCurrentTime(t);
          if (d > 0) setDuration(d);
        } catch {}
      } else if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime || 0);
        if (videoRef.current.duration) {
          setDuration(videoRef.current.duration);
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isYouTube]);

  // Format seconds into MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    if (seconds > 86400 * 2) return "LIVE";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const isCurrentlyPlaying = (): boolean => {
    return isPlayingLocally || playbackState === PlaybackState.PLAYING;
  };

  const handleTogglePlay = () => {
    if (isCurrentlyPlaying()) {
      onPause(currentTime);
    } else {
      onPlay(currentTime);
    }
  };

  const handleSeekCommit = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration > 86400 * 2 || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = pos * duration;
    setCurrentTime(target);
    onSeek(target);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Keyboard shortcut listener (Spacebar, Arrows, M, F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        const nextTime = Math.min(duration || Infinity, currentTime + 5);
        setCurrentTime(nextTime);
        onSeek(nextTime);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        const nextTime = Math.max(0, currentTime - 5);
        setCurrentTime(nextTime);
        onSeek(nextTime);
      } else if (e.code === "KeyM") {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      } else if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, duration, playbackState, onSeek, onPlay, onPause, isPlayingLocally]);

  const progressPercent = (duration > 0 && duration < 86400 * 2) ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="media-player-container"
      onMouseEnter={() => setIsHoveringControls(true)}
      onMouseLeave={() => setIsHoveringControls(false)}
    >
      {/* Video Canvas */}
      <div className="player-canvas">
        {/* Empty Cinema Placeholder when queue is empty */}
        {!currentMedia && (
          <div className="empty-cinema-placeholder">
            <div className="placeholder-content">
              <span className="placeholder-icon">🎬</span>
              <h3>No Video Playing</h3>
              <p>The queue is empty. Paste a YouTube or video stream URL in the sidebar to start watching together!</p>
            </div>
          </div>
        )}

        {/* YouTube Wrapper: ALWAYS kept in DOM to avoid orphaned instances */}
        <div
          className="yt-wrapper"
          style={{ display: currentMedia && isYouTube ? "block" : "none" }}
        >
          <div id="yt-player-target" />
          <div
            className="video-click-interceptor"
            onClick={handleTogglePlay}
            onDoubleClick={toggleFullscreen}
            title="Click to Play/Pause, Double-click for Fullscreen"
          />
        </div>

        {/* Direct Video: ALWAYS kept in DOM */}
        <div
          className="direct-video-wrapper"
          style={{ display: currentMedia && !isYouTube ? "flex" : "none" }}
          onClick={handleTogglePlay}
          onDoubleClick={toggleFullscreen}
        >
          <video
            ref={videoRef}
            src={currentMedia && !isYouTube ? currentMedia.url : undefined}
            className="html5-video"
            playsInline
            onEnded={onEnded}
            onPlay={() => setIsPlayingLocally(true)}
            onPause={() => setIsPlayingLocally(false)}
            onWaiting={() => onBufferingChange(true)}
            onPlaying={() => onBufferingChange(false)}
          />
        </div>

        {/* Embed Restriction Alert */}
        {embedError && (
          <div className="embed-error-modal">
            <div className="error-card">
              <span className="error-icon">⚠️</span>
              <h4>Video Playback Restricted</h4>
              <p>{embedError}</p>
              <button className="error-action-btn" onClick={onEnded}>
                Skip to Next ⏭
              </button>
            </div>
          </div>
        )}

        {/* Center Big Play Button (shown whenever paused locally or room is paused) */}
        {currentMedia && (!isPlayingLocally || playbackState === PlaybackState.PAUSED) && !embedError && (
          <div className="center-play-overlay" onClick={handleTogglePlay}>
            <button className="big-play-btn" title="Click to Play">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        )}

        {/* Ambient Top Overlay Header */}
        <div className={`player-header ${isHoveringControls ? "visible" : ""}`}>
          <div className="player-media-title">
            <span className="source-pill">
              {isYouTube ? "YouTube" : "Direct Stream"}
            </span>
            <span className="media-name">{currentMedia?.title || "No Media Playing"}</span>
          </div>

          {/* Sync Engine Health Badge */}
          <div className="sync-badge-container">
            {syncStatus === "in_sync" && (
              <span className="badge badge-in-sync">
                <span className="pulse-dot green" /> In-Sync (±{Math.abs(driftMs)}ms)
              </span>
            )}
            {syncStatus === "steering" && (
              <span className="badge badge-steering">
                <span className="pulse-dot yellow" /> Speed-Steering: {effectiveRate}x ({driftMs > 0 ? `+${driftMs}ms` : `${driftMs}ms`})
              </span>
            )}
            {syncStatus === "seeking" && (
              <span className="badge badge-seeking">
                <span className="pulse-dot red" /> Resyncing...
              </span>
            )}
            {syncStatus === "buffering" && (
              <span className="badge badge-buffering">
                <span className="spinner-icon" /> Buffering
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Glassmorphic Cinema Control Bar */}
      <div className={`cinema-controls-bar ${isHoveringControls || playbackState === PlaybackState.PAUSED ? "visible" : ""}`}>
        {/* Scrubber Timeline */}
        <div
          className="timeline-track"
          onClick={handleSeekCommit}
        >
          <div className="timeline-background" />
          <div
            className="timeline-progress"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="timeline-handle"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        {/* Control Buttons & Indicators */}
        <div className="controls-row">
          <div className="controls-left">
            <button
              className="ctrl-btn play-btn"
              onClick={handleTogglePlay}
              title={playbackState === PlaybackState.PLAYING ? "Pause" : "Play"}
            >
              {playbackState === PlaybackState.PLAYING ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Time Stamp Display */}
            <div className="time-display">
              <span className="time-current">{formatTime(currentTime)}</span>
              <span className="time-sep">/</span>
              <span className="time-total">{formatTime(duration)}</span>
            </div>

            {/* Volume Control */}
            <div className="volume-control-wrapper">
              <button
                className="ctrl-btn mute-btn"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }}
                className="volume-slider"
              />
            </div>
          </div>

          <div className="controls-right">
            <button
              className="ctrl-btn fullscreen-btn"
              onClick={toggleFullscreen}
              title="Fullscreen"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};