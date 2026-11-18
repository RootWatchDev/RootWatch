import { Client, RootServerException } from "@rootsdk/server-app";
import {
  MediaItem,
  MediaSourceType,
  PlaybackState,
  QueueMediaRequest,
  ReactionEvent,
  RemoveQueueRequest,
  RoomPlaybackState,
  SendReactionRequest,
  SpectatorInfo,
  SpectatorListEvent,
  SpectatorStatusReport,
  TimeSyncRequest,
  TimeSyncResponse,
  ToggleDjModeRequest,
  UpdatePlaybackRequest
} from "@rootwatch/gen-shared";
import { WatchServiceBase } from "@rootwatch/gen-server";

export class WatchService extends WatchServiceBase {
  private roomState: RoomPlaybackState = {
    currentMedia: undefined,
    state: PlaybackState.PAUSED,
    positionSeconds: 0,
    updatedAtServerMs: BigInt(Date.now()),
    playbackRate: 1.0,
    controlledByUserId: "",
    controlledByUsername: "",
    playlist: [],
    djModeEnabled: false,
    hostUserId: ""
  };

  private spectators: Map<string, SpectatorInfo> = new Map();
  private lastSpectatorBroadcastMs: number = 0;
  private lastReactionByUser: Map<string, number> = new Map();

  constructor() {
    super();
  }

  // --- NTP-style Time Synchronization ---
  async syncTime(request: TimeSyncRequest, _client: Client): Promise<TimeSyncResponse> {
    const now = BigInt(Date.now());
    return {
      clientSendTimeMs: request.clientSendTimeMs,
      serverReceiveTimeMs: now,
      serverSendTimeMs: now
    };
  }

  // --- Retrieve authoritative room state ---
  async getRoomState(client: Client): Promise<RoomPlaybackState> {
    if (!this.roomState.hostUserId) {
      this.roomState.hostUserId = client.userId;
    }
    return this.getSynchronizedState();
  }

  // --- Play/Pause/Seek Playback Updates ---
  async updatePlayback(request: UpdatePlaybackRequest, client: Client): Promise<RoomPlaybackState> {
    console.log(`[WatchService] updatePlayback requested: state=${request.newState === PlaybackState.PLAYING ? "PLAYING" : "PAUSED"}, pos=${request.positionSeconds.toFixed(2)}s by user=${client.userId}`);
    this.assertDjPermission(client.userId);

    if (!this.roomState.currentMedia) {
      return this.getSynchronizedState();
    }

    const now = BigInt(Date.now());
    this.roomState.positionSeconds = Math.max(0, request.positionSeconds);
    this.roomState.state = request.newState;
    this.roomState.playbackRate = request.playbackRate > 0 ? request.playbackRate : 1.0;
    this.roomState.updatedAtServerMs = now;
    this.roomState.controlledByUserId = client.userId;
    this.roomState.controlledByUsername = `User ${client.userId.slice(0, 6)}`;

    // Broadcast synchronized state to all clients
    const updated = this.getSynchronizedState();
    this.broadcastPlaybackUpdated(updated, "all");
    return updated;
  }

  // --- Add Media to Queue ---
  async queueMedia(request: QueueMediaRequest, client: Client): Promise<RoomPlaybackState> {
    const parsed = this.parseMediaUrl(request.url, request.title, client);

    if (!this.roomState.currentMedia) {
      this.roomState.currentMedia = parsed;
      this.roomState.positionSeconds = 0;
      this.roomState.updatedAtServerMs = BigInt(Date.now());
      this.roomState.state = PlaybackState.PAUSED;
      this.broadcastPlaybackUpdated(this.getSynchronizedState(), "all");
    } else {
      this.roomState.playlist.push(parsed);
      this.broadcastQueueUpdated(this.getSynchronizedState(), "all");
    }

    return this.getSynchronizedState();
  }

  // --- Remove Media from Queue ---
  async removeFromQueue(request: RemoveQueueRequest, client: Client): Promise<RoomPlaybackState> {
    this.assertDjPermission(client.userId);

    this.roomState.playlist = this.roomState.playlist.filter((item) => item.id !== request.mediaId);
    this.broadcastQueueUpdated(this.getSynchronizedState(), "all");
    return this.getSynchronizedState();
  }

  // --- Skip to Next Media in Queue ---
  async skipToNext(client: Client): Promise<RoomPlaybackState> {
    this.assertDjPermission(client.userId);

    if (this.roomState.playlist.length > 0) {
      const nextMedia = this.roomState.playlist.shift()!;
      this.roomState.currentMedia = nextMedia;
      this.roomState.positionSeconds = 0;
      this.roomState.updatedAtServerMs = BigInt(Date.now());
      this.roomState.state = PlaybackState.PLAYING;
    } else {
      this.roomState.currentMedia = undefined;
      this.roomState.state = PlaybackState.ENDED;
      this.roomState.positionSeconds = 0;
      this.roomState.updatedAtServerMs = BigInt(Date.now());
    }

    const updated = this.getSynchronizedState();
    this.broadcastPlaybackUpdated(updated, "all");
    return updated;
  }

  // --- Toggle DJ / Host Mode ---
  async toggleDjMode(request: ToggleDjModeRequest, client: Client): Promise<RoomPlaybackState> {
    this.roomState.djModeEnabled = request.djModeEnabled;
    this.roomState.hostUserId = client.userId;
    console.log(`[WatchService] DJ Mode set to ${request.djModeEnabled} by user ${client.userId}`);

    const updated = this.getSynchronizedState();
    this.broadcastPlaybackUpdated(updated, "all");
    return updated;
  }

  // --- Real-time Reactions ---
  async sendReaction(request: SendReactionRequest, client: Client): Promise<void> {
    const now = Date.now();
    const last = this.lastReactionByUser.get(client.userId) || 0;
    if (now - last < 800) {
      // Cooldown active, drop flood requests
      return;
    }
    this.lastReactionByUser.set(client.userId, now);

    const event: ReactionEvent = {
      id: Math.random().toString(36).substring(2, 9),
      userId: client.userId,
      username: `User ${client.userId.slice(0, 6)}`,
      emoji: request.emoji || "🔥",
      timestampMs: BigInt(now)
    };

    this.broadcastReactionReceived(event, "all");
  }

  // --- Spectator Presence & Drift Reporting ---
  async reportStatus(request: SpectatorStatusReport, client: Client): Promise<void> {
    const now = Date.now();
    const info: SpectatorInfo = {
      userId: client.userId,
      username: `User ${client.userId.slice(0, 6)}`,
      isBuffering: request.isBuffering,
      driftMs: request.driftMs,
      inSync: Math.abs(request.driftMs) <= 500,
      lastSeenMs: BigInt(now)
    };

    this.spectators.set(client.userId, info);

    // Prune stale spectators (> 30s)
    for (const [uid, spec] of this.spectators.entries()) {
      if (now - Number(spec.lastSeenMs) > 30000) {
        this.spectators.delete(uid);
      }
    }

    // Throttle spectator broadcasts to once every 2 seconds
    if (now - this.lastSpectatorBroadcastMs > 2000) {
      this.lastSpectatorBroadcastMs = now;
      const listEvent: SpectatorListEvent = {
        spectators: Array.from(this.spectators.values())
      };
      this.broadcastSpectatorsUpdated(listEvent, "all");
    }
  }

  // Handle member detachment
  public removeSpectator(userId: string) {
    if (this.spectators.has(userId)) {
      this.spectators.delete(userId);
      if (this.roomState.hostUserId === userId) {
        const remaining = Array.from(this.spectators.keys());
        this.roomState.hostUserId = remaining.length > 0 ? remaining[0] : "";
        console.log(`[WatchService] Host ${userId} disconnected. New host: ${this.roomState.hostUserId}`);
      }
      const listEvent: SpectatorListEvent = {
        spectators: Array.from(this.spectators.values())
      };
      this.broadcastSpectatorsUpdated(listEvent, "all");
    }
  }

  // --- Helper Methods ---
  private assertDjPermission(userId: string) {
    if (this.roomState.djModeEnabled && this.roomState.hostUserId && this.roomState.hostUserId !== userId) {
      console.warn(`[WatchService] DJ permission denied for user ${userId}. Current host is ${this.roomState.hostUserId}`);
      throw new RootServerException(1001, "DJ Mode is active. Only the host can control playback.");
    }
  }

  private getSynchronizedState(): RoomPlaybackState {
    return {
      ...this.roomState,
      playlist: [...this.roomState.playlist]
    };
  }

  private parseMediaUrl(url: string, customTitle: string, client: Client): MediaItem {
    const trimmed = url.trim();
    const id = Math.random().toString(36).substring(2, 9);

    // YouTube regex pattern
    const ytMatch = trimmed.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i
    );

    if (ytMatch && ytMatch[1]) {
      const ytId = ytMatch[1];
      return {
        id,
        url: `https://www.youtube.com/watch?v=${ytId}`,
        title: customTitle.trim() || `YouTube Video (${ytId})`,
        thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
        durationSeconds: 0,
        sourceType: MediaSourceType.MEDIA_SOURCE_YOUTUBE,
        queuedByUserId: client.userId,
        queuedByUsername: `User ${client.userId.slice(0, 6)}`
      };
    }

    // Direct MP4 / WebM / HLS stream
    const isDirect = /\.(mp4|webm|m3u8|ogg)($|\?)/i.test(trimmed);
    const fileName = trimmed.split("/").pop()?.split("?")[0] || "Direct Video Stream";

    return {
      id,
      url: trimmed,
      title: customTitle.trim() || fileName,
      thumbnailUrl: "",
      durationSeconds: 0,
      sourceType: isDirect ? MediaSourceType.MEDIA_SOURCE_DIRECT : MediaSourceType.MEDIA_SOURCE_YOUTUBE,
      queuedByUserId: client.userId,
      queuedByUsername: `User ${client.userId.slice(0, 6)}`
    };
  }
}

export const watchService = new WatchService();
