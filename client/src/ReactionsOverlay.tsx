import React, { useState, useEffect, useRef } from "react";
import { ReactionEvent } from "@rootwatch/gen-shared";

interface ReactionsOverlayProps {
  reactions: ReactionEvent[];
  onSendReaction: (emoji: string) => void;
}

interface FloatingParticle {
  id: string;
  emoji: string;
  username: string;
  xOffset: number;
}

const EMOJI_COOLDOWN_MS = 1200;

export const ReactionsOverlay: React.FC<ReactionsOverlayProps> = ({
  reactions,
  onSendReaction
}) => {
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const [isOnCooldown, setIsOnCooldown] = useState<boolean>(false);
  const lastReactionTimeRef = useRef<number>(0);
  const availableEmojis = ["🍿", "🔥", "❤️", "😂", "👏", "🚀", "🎉"];

  // When a new reaction arrives from server
  useEffect(() => {
    if (reactions.length === 0) return;
    const latest = reactions[reactions.length - 1];

    const newParticle: FloatingParticle = {
      id: `${latest.id}-${Date.now()}-${Math.random()}`,
      emoji: latest.emoji,
      username: latest.username,
      xOffset: (Math.random() - 0.5) * 80
    };

    setParticles((prev) => [...prev, newParticle]);

    // Cleanup particle after 2.5s
    const timer = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
    }, 2500);

    return () => clearTimeout(timer);
  }, [reactions]);

  const handleSendReaction = (emoji: string) => {
    const now = Date.now();
    if (now - lastReactionTimeRef.current < EMOJI_COOLDOWN_MS) {
      return;
    }
    lastReactionTimeRef.current = now;
    setIsOnCooldown(true);
    onSendReaction(emoji);

    setTimeout(() => {
      setIsOnCooldown(false);
    }, EMOJI_COOLDOWN_MS);
  };

  return (
    <div className="reactions-overlay-container">
      {/* Floating particles viewport */}
      <div className="particles-canvas">
        {particles.map((p) => (
          <div
            key={p.id}
            className="floating-emoji"
            style={{ transform: `translateX(${p.xOffset}px)` }}
          >
            <span className="emoji-char">{p.emoji}</span>
            <span className="emoji-user">{p.username}</span>
          </div>
        ))}
      </div>

      {/* Quick reaction action bar with cooldown support */}
      <div className={`reactions-action-bar ${isOnCooldown ? "cooldown-active" : ""}`}>
        {availableEmojis.map((emoji) => (
          <button
            key={emoji}
            className={`reaction-trigger-btn ${isOnCooldown ? "btn-cooling" : ""}`}
            onClick={() => handleSendReaction(emoji)}
            disabled={isOnCooldown}
            title={isOnCooldown ? "Reaction on cooldown (1.2s)" : `React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        {isOnCooldown && (
          <span className="cooldown-pill" title="Emoji cooldown active">⏳</span>
        )}
      </div>
    </div>
  );
};
