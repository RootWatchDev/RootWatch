import { useState, useEffect, useRef, useCallback } from "react";
import {
  watchServiceClient,
  WatchServiceClientEvent
} from "@rootwatch/gen-client";
import {
  RoomPlaybackState,
  PlaybackState,
  SpectatorInfo,
  ReactionEvent
} from "@rootwatch/gen-shared";

export interface SyncEngineStatus {
  roomState: RoomPlaybackState | null;
  spectators: SpectatorInfo[];
  reactions: ReactionEvent[];
  syncStatus: "in_sync" | "steering" | "seeking" | "buffering" | "paused";
  driftMs: number;
  effectiveRate: number;
  expectedPosition: number;
  play: (currentTime?: number) => Promise<void>;
  pause: (currentTime?: number) => Promise<void>;
  seek: (targetSeconds: number) => Promise<void>;
  queueMedia: (url: string, title?: string) => Promise<void>;
  removeFromQueue: (mediaId: string) => Promise<void>;
  skipToNext: () => Promise<void>;
  toggleDjMode: (enabled: boolean) => Promise<void>;
  sendReaction: (emoji: string) => Promise<void>;
  reportPlayerState: (position: number, isBuffering: boolean) => void;
  registerPlayerController: (controller: PlayerController) => void;
}

export interface PlayerController {
  play: () => Promise<void> | void;
  pause: () => Promise<void> | void;
  seekTo: (seconds: number) => void;
  setRate: (rate: number) => void;
  getCurrentTime: () => number;
}

export function useSyncEngine(): SyncEngineStatus {
  const [roomState, setRoomState] = useState<RoomPlaybackState | null>(null);
  const [spectators, setSpectators] = useState<SpectatorInfo[]>([]);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [syncStatus, setSyncStatus] = useState<"in_sync" | "steering" | "seeking" | "buffering" | "paused">("paused");
  const [driftMs, setDriftMs] = useState<number>(0);
  const [effectiveRate, setEffectiveRate] = useState<number>(1.0);
  const [expectedPosition, setExpectedPosition] = useState<number>(0);

  const clockOffsetMsRef = useRef<number>(0);
  const playerControllerRef = useRef<PlayerController | null>(null);
  const roomStateRef = useRef<RoomPlaybackState | null>(null);
  const isBufferingRef = useRef<boolean>(false);
  const lastHardSeekTimeRef = useRef<number>(0);
  const lastLocalActionTimeRef = useRef<number>(0);
  const isSteeringRef = useRef<boolean>(false);

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  // NTP Clock Sync Calibration
  const calibrateClock = useCallback(async () => {
    try {
      const sendTime = BigInt(Date.now());
      const response = await watchServiceClient.syncTime({ clientSendTimeMs: sendTime });
      const now = Date.now();
      const rtt = now - Number(response.clientSendTimeMs);
      const serverEst = Number(response.serverReceiveTimeMs) + rtt / 2;
      const offset = serverEst - now;

      clockOffsetMsRef.current = clockOffsetMsRef.current === 0
        ? offset
        : clockOffsetMsRef.current * 0.7 + offset * 0.3;
    } catch (err) {
      console.warn("Time sync roundtrip failed:", err);
    }
  }, []);

  // Compute expected virtual timeline position
  const getExpectedPosition = useCallback((state: RoomPlaybackState | null): number => {
    if (!state || !state.currentMedia) return 0;
    if (state.state !== PlaybackState.PLAYING) {
      return Math.max(0, state.positionSeconds);
    }
    const serverNow = Date.now() + clockOffsetMsRef.current;
    const elapsedSeconds = Math.max(0, (serverNow - Number(state.updatedAtServerMs)) / 1000.0) * (state.playbackRate || 1.0);
    return Math.max(0, state.positionSeconds + elapsedSeconds);
  }, []);

  // Initialize and subscribe to events
  useEffect(() => {
    calibrateClock().then(() => calibrateClock());
    const syncInterval = setInterval(calibrateClock, 20000);

    watchServiceClient.getRoomState()
      .then((state) => {
        setRoomState(state);
        setExpectedPosition(getExpectedPosition(state));
      })
      .catch((err) => console.error("Failed to load initial room state:", err));

    const onPlaybackUpdated = (updatedState: RoomPlaybackState) => {
      setRoomState(updatedState);
      const player = playerControllerRef.current;
      if (!player) return;

      // Ignore self-echo if we just initiated a local action (within 1.2s)
      const now = Date.now();
      if (now - lastLocalActionTimeRef.current < 1200) {
        return;
      }

      const currentPos = player.getCurrentTime();
      const targetPos = getExpectedPosition(updatedState);

      if (updatedState.state === PlaybackState.PLAYING) {
        // If we are significantly off from the target position (> 1.2s), seek cleanly
        if (Math.abs(currentPos - targetPos) > 1.2) {
          lastHardSeekTimeRef.current = now;
          player.seekTo(targetPos);
        }
        player.play();
        player.setRate(1.0);
        isSteeringRef.current = false;
        setEffectiveRate(1.0);
      } else if (updatedState.state === PlaybackState.PAUSED) {
        player.pause();
        if (Math.abs(currentPos - updatedState.positionSeconds) > 0.4) {
          player.seekTo(updatedState.positionSeconds);
        }
        player.setRate(1.0);
        isSteeringRef.current = false;
        setEffectiveRate(1.0);
      }
    };

    const onQueueUpdated = (updatedState: RoomPlaybackState) => {
      setRoomState(updatedState);
    };

    const onReactionReceived = (reaction: ReactionEvent) => {
      setReactions((prev) => [...prev.slice(-20), reaction]);
    };

    const onSpectatorsUpdated = (event: { spectators: SpectatorInfo[] }) => {
      setSpectators(event.spectators);
    };

    watchServiceClient.on(WatchServiceClientEvent.PlaybackUpdated, onPlaybackUpdated);
    watchServiceClient.on(WatchServiceClientEvent.QueueUpdated, onQueueUpdated);
    watchServiceClient.on(WatchServiceClientEvent.ReactionReceived, onReactionReceived);
    watchServiceClient.on(WatchServiceClientEvent.SpectatorsUpdated, onSpectatorsUpdated);

    return () => {
      clearInterval(syncInterval);
      watchServiceClient.off(WatchServiceClientEvent.PlaybackUpdated, onPlaybackUpdated);
      watchServiceClient.off(WatchServiceClientEvent.QueueUpdated, onQueueUpdated);
      watchServiceClient.off(WatchServiceClientEvent.ReactionReceived, onReactionReceived);
      watchServiceClient.off(WatchServiceClientEvent.SpectatorsUpdated, onSpectatorsUpdated);
    };
  }, [calibrateClock, getExpectedPosition]);

  // High-precision adaptive synchronization loop (evaluates every 350ms)
  useEffect(() => {
    const loop = setInterval(() => {
      const state = roomStateRef.current;
      const player = playerControllerRef.current;
      if (!state || !state.currentMedia || !player) return;

      const currentPos = player.getCurrentTime();
      const expectedPos = getExpectedPosition(state);
      setExpectedPosition(expectedPos);

      // 1. If room is paused or ended
      if (state.state !== PlaybackState.PLAYING) {
        setSyncStatus("paused");
        if (isSteeringRef.current) {
          isSteeringRef.current = false;
          setEffectiveRate(1.0);
          player.setRate(1.0);
        }
        return;
      }

      // 2. If local player is actively buffering
      if (isBufferingRef.current) {
        setSyncStatus("buffering");
        return;
      }

      const now = Date.now();
      // Enforce cooldown after a hard seek to let the player stabilize
      if (now - lastHardSeekTimeRef.current < 2800) {
        return;
      }
      // Also respect recent local actions
      if (now - lastLocalActionTimeRef.current < 1200) {
        return;
      }

      const driftSeconds = currentPos - expectedPos;
      const currentDriftMs = Math.round(driftSeconds * 1000);
      setDriftMs(currentDriftMs);
      const absDrift = Math.abs(currentDriftMs);

      // Zone 0: In-Sync Deadband (within 500ms is imperceptible and in sync)
      // Use hysteresis: if we were steering, return to in-sync when within 350ms
      const inSyncThreshold = isSteeringRef.current ? 350 : 500;

      if (absDrift <= inSyncThreshold) {
        setSyncStatus("in_sync");
        if (isSteeringRef.current || effectiveRate !== 1.0) {
          isSteeringRef.current = false;
          setEffectiveRate(1.0);
          player.setRate(1.0);
        }
      } else if (absDrift <= 3000) {
        // Zone 1: Micro-Steering (500ms - 3000ms)
        // Seamless rate adjustment without buffering or freezing
        setSyncStatus("steering");
        isSteeringRef.current = true;
        const steerRate = currentDriftMs < 0 ? 1.25 : 0.75;
        if (effectiveRate !== steerRate) {
          setEffectiveRate(steerRate);
          player.setRate(steerRate);
        }
      } else {
        // Zone 2: Large Drift (> 3000ms)
        // Hard seek snap
        setSyncStatus("seeking");
        isSteeringRef.current = false;
        setEffectiveRate(1.0);
        player.setRate(1.0);
        lastHardSeekTimeRef.current = now;
        player.seekTo(expectedPos);
      }
    }, 350);

    return () => clearInterval(loop);
  }, [getExpectedPosition, effectiveRate]);

  // Periodic spectator status reporter (every 3 seconds)
  useEffect(() => {
    const reporter = setInterval(() => {
      const player = playerControllerRef.current;
      const pos = player ? player.getCurrentTime() : 0;
      watchServiceClient.reportStatus({
        currentPosition: pos,
        isBuffering: isBufferingRef.current,
        driftMs: driftMs
      }).catch(() => {});
    }, 3000);

    return () => clearInterval(reporter);
  }, [driftMs]);

  // Instant local feedback + Server broadcast for Play
  const play = useCallback(async (currentTime?: number) => {
    const player = playerControllerRef.current;
    const pos = currentTime !== undefined ? currentTime : (player ? player.getCurrentTime() : 0);
    
    lastHardSeekTimeRef.current = Date.now();
    lastLocalActionTimeRef.current = Date.now();

    // Immediate local feedback
    if (player) {
      player.play();
      player.setRate(1.0);
    }
    isSteeringRef.current = false;
    setEffectiveRate(1.0);

    try {
      const updated = await watchServiceClient.updatePlayback({
        newState: PlaybackState.PLAYING,
        positionSeconds: Math.max(0, pos),
        playbackRate: 1.0
      });
      setRoomState(updated);
    } catch (err) {
      console.error("Failed to update playback (play):", err);
      throw err;
    }
  }, []);

  // Instant local feedback + Server broadcast for Pause
  const pause = useCallback(async (currentTime?: number) => {
    const player = playerControllerRef.current;
    const pos = currentTime !== undefined ? currentTime : (player ? player.getCurrentTime() : 0);

    lastHardSeekTimeRef.current = Date.now();
    lastLocalActionTimeRef.current = Date.now();

    // Immediate local feedback
    if (player) {
      player.pause();
      player.setRate(1.0);
    }
    isSteeringRef.current = false;
    setEffectiveRate(1.0);

    try {
      const updated = await watchServiceClient.updatePlayback({
        newState: PlaybackState.PAUSED,
        positionSeconds: Math.max(0, pos),
        playbackRate: 1.0
      });
      setRoomState(updated);
    } catch (err) {
      console.error("Failed to update playback (pause):", err);
      throw err;
    }
  }, []);

  // Instant local feedback + Server broadcast for Seek
  const seek = useCallback(async (targetSeconds: number) => {
    const state = roomStateRef.current;
    const player = playerControllerRef.current;

    lastHardSeekTimeRef.current = Date.now();
    lastLocalActionTimeRef.current = Date.now();

    if (player) {
      player.seekTo(targetSeconds);
      player.setRate(1.0);
    }
    isSteeringRef.current = false;
    setEffectiveRate(1.0);

    try {
      const updated = await watchServiceClient.updatePlayback({
        newState: state ? state.state : PlaybackState.PLAYING,
        positionSeconds: Math.max(0, targetSeconds),
        playbackRate: 1.0
      });
      setRoomState(updated);
    } catch (err) {
      console.error("Failed to update playback (seek):", err);
      throw err;
    }
  }, []);

  const queueMedia = useCallback(async (url: string, title?: string) => {
    const updated = await watchServiceClient.queueMedia({
      url,
      title: title || "",
      sourceType: 0,
      durationSeconds: 0
    });
    setRoomState(updated);
  }, []);

  const removeFromQueue = useCallback(async (mediaId: string) => {
    const updated = await watchServiceClient.removeFromQueue({ mediaId });
    setRoomState(updated);
  }, []);

  const skipToNext = useCallback(async () => {
    lastHardSeekTimeRef.current = Date.now();
    lastLocalActionTimeRef.current = Date.now();
    const updated = await watchServiceClient.skipToNext();
    setRoomState(updated);
  }, []);

  const toggleDjMode = useCallback(async (enabled: boolean) => {
    const updated = await watchServiceClient.toggleDjMode({ djModeEnabled: enabled });
    setRoomState(updated);
  }, []);

  const sendReaction = useCallback(async (emoji: string) => {
    await watchServiceClient.sendReaction({ emoji });
  }, []);

  const reportPlayerState = useCallback((_position: number, isBuffering: boolean) => {
    isBufferingRef.current = isBuffering;
    if (!isBuffering) {
      // Exited buffering: grant a brief window before evaluating drift
      lastHardSeekTimeRef.current = Date.now();
    }
  }, []);

  const registerPlayerController = useCallback((controller: PlayerController) => {
    playerControllerRef.current = controller;
  }, []);

  return {
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
  };
}