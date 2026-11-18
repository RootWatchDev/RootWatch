# 📜 Changelog

All notable changes to the **RootWatch** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-18

### 🎉 Initial Pre-Release

#### Added
- **Sub-Second Adaptive Synchronization Engine**:
  - Virtual server timeline with micro-steering drift compensation (±0.05x rate scaling).
  - Deadband thresholding (±500ms) to ensure smooth playback without constant stuttering.
- **Multi-Source Cinema Player**:
  - Full support for YouTube videos and livestreams.
  - Native HTML5 support for direct MP4 and HLS streams (e.g. Big Buck Bunny, Sintel).
  - Custom glassmorphic player controls with glowing timeline scrubber, play/pause, volume slider, and fullscreen.
- **Collaborative Playlist Queue**:
  - Shared room queue with real-time add/remove/skip controls.
  - 1-click **Quick Add** presets for instant streaming (Lofi Girl, Synthwave Radio, 4K Open Movies).
- **DJ Mode & Room Permissions**:
  - Switch between **Free-for-All Mode** (anyone can control playback) and **DJ Mode** (only room host can play/pause/seek).
- **Spectator Presence & Sync Health**:
  - Real-time presence indicators showing connected users and their sync state (`🟢 In-Sync`, `🟡 Steering`, `🔄 Buffering`).
  - Active room metric (e.g. `3/4 In Sync`).
- **Interactive Floating Reactions**:
  - Real-time animated emoji particles (🍿, 🔥, ❤️, 👏, 🎉) floating over the cinema screen.
  - 1.2s client cooldown with visual hourglass (`⏳`) indicator and server-side rate limiting to prevent spam.
- **Store & Compliance Assets**:
  - Custom 1024x1024 neon app icon and 2400x900 showcase banner.
  - Public privacy policy compliant with YouTube ToS, GDPR, and COPPA.
