"use client";

import { motion } from "framer-motion";
import { useState } from "react";

export type DoorState = "idle" | "selected" | "opening" | "trapped" | "revealed-winner" | "revealed-loser";
export type TrapType = "arrow" | "poison" | "skeleton" | "slime" | "spikes" | "curse";

interface PixelDoorProps {
  blockNumber: number;
  state: DoorState;
  isWinner?: boolean;
  trapType?: TrapType;
  onSelect?: () => void;
  disabled?: boolean;
}

export default function PixelDoor({
  blockNumber,
  state,
  isWinner,
  trapType = "arrow",
  onSelect,
  disabled
}: PixelDoorProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getTrapColor = () => {
    switch (trapType) {
      case "arrow": return "#8B4513";
      case "poison": return "#9333ea";
      case "skeleton": return "#f5f5f5";
      case "slime": return "#22c55e";
      case "spikes": return "#71717a";
      case "curse": return "#dc2626";
      default: return "#8B4513";
    }
  };

  const getTrapEmoji = () => {
    switch (trapType) {
      case "arrow": return "🏹";
      case "poison": return "☠️";
      case "skeleton": return "💀";
      case "slime": return "🟢";
      case "spikes": return "⚔️";
      case "curse": return "👻";
      default: return "🏹";
    }
  };

  return (
    <motion.button
      onClick={() => !disabled && onSelect?.()}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      disabled={disabled || state === "revealed-loser"}
      className="relative w-full aspect-square cursor-pointer disabled:cursor-not-allowed"
      initial={{ scale: 1, opacity: 1 }}
      whileHover={state === "idle" || state === "selected" ? {
        scale: 1.05,
        rotate: [0, -1, 1, 0],
        transition: { duration: 0.3 }
      } : {}}
    >
      {/* Door Container */}
      <div className="relative w-full h-full pixel-art">

        {/* IDLE or SELECTED State */}
        {(state === "idle" || state === "selected") && (
          <motion.div
            className="relative w-full h-full"
            animate={{
              y: isHovered ? [-2, 0, -2] : 0,
            }}
            transition={{ duration: 0.6, repeat: isHovered ? Infinity : 0 }}
          >
            {/* Door Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#4a3728] to-[#2d1f16] rounded-lg border-4 border-[#1a1410] shadow-2xl">
              {/* Wood Texture */}
              <div className="absolute inset-2 bg-[#3d2b1f] opacity-30"
                   style={{
                     backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 4px, #2d1f16 4px, #2d1f16 8px)`
                   }}
              />

              {/* Door Planks */}
              <div className="absolute inset-0 flex flex-col justify-around p-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-1 bg-[#1a1410] opacity-50" />
                ))}
              </div>

              {/* Metal Bands */}
              <div className="absolute left-1 right-1 top-[20%] h-2 bg-gradient-to-r from-[#4a4a4a] via-[#6b6b6b] to-[#4a4a4a] shadow-inner" />
              <div className="absolute left-1 right-1 bottom-[20%] h-2 bg-gradient-to-r from-[#4a4a4a] via-[#6b6b6b] to-[#4a4a4a] shadow-inner" />

              {/* Door Handle */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gradient-to-br from-[#d4af37] to-[#8b7355] shadow-lg" />

              {/* Block Number */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-[#d4af37] pixel-font drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]"
                      style={{ textShadow: "2px 2px 0px #1a1410" }}>
                  {blockNumber}
                </span>
              </div>

              {/* Selection Glow */}
              {state === "selected" && (
                <motion.div
                  className="absolute -inset-1 rounded-lg border-4 border-purple-500"
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    boxShadow: [
                      "0 0 20px rgba(168, 85, 247, 0.5)",
                      "0 0 40px rgba(168, 85, 247, 1)",
                      "0 0 20px rgba(168, 85, 247, 0.5)"
                    ]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}

              {/* Torch Flicker (on hover) */}
              {isHovered && (
                <>
                  <motion.div
                    className="absolute -top-8 left-1/2 -translate-x-1/2 w-4 h-6 bg-gradient-to-t from-orange-500 via-yellow-400 to-yellow-200 rounded-full"
                    animate={{
                      opacity: [0.7, 1, 0.7],
                      scale: [0.9, 1.1, 0.9],
                    }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute -top-8 left-1/2 -translate-x-1/2 w-8 h-8 bg-yellow-400 rounded-full blur-md opacity-50"
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* TRAPPED State - Door breaks */}
        {state === "trapped" && (
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1, rotate: 0, opacity: 1 }}
            animate={{
              scale: [1, 1.1, 0],
              rotate: [0, -10, 10, -5, 180],
              opacity: [1, 1, 0.5, 0],
              y: [0, -20, 40],
            }}
            transition={{ duration: 1, ease: "easeInOut" }}
          >
            <div className="relative w-full h-full bg-gradient-to-b from-[#4a3728] to-[#2d1f16] rounded-lg border-4 border-[#1a1410]">
              {/* Trap Icon */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center text-6xl"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: [0, 1.5, 1], rotate: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <span className="drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">
                  {getTrapEmoji()}
                </span>
              </motion.div>
            </div>

            {/* Particles */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-sm"
                style={{
                  left: "50%",
                  top: "50%",
                  backgroundColor: getTrapColor(),
                }}
                initial={{ scale: 0, x: 0, y: 0 }}
                animate={{
                  scale: [0, 1, 0],
                  x: [0, (Math.random() - 0.5) * 100],
                  y: [0, (Math.random() - 0.5) * 100],
                  opacity: [1, 1, 0],
                }}
                transition={{
                  duration: 0.8,
                  delay: 0.3 + i * 0.05,
                }}
              />
            ))}
          </motion.div>
        )}

        {/* REVEALED LOSER State - Destroyed door */}
        {state === "revealed-loser" && (
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <div className="text-4xl">❌</div>
          </div>
        )}

        {/* OPENING / REVEALED WINNER State - Opening door with treasure */}
        {(state === "opening" || state === "revealed-winner") && (
          <div className="relative w-full h-full">
            {/* Door Opening Animation */}
            <motion.div
              className="absolute inset-0 origin-left"
              initial={{ rotateY: 0 }}
              animate={{ rotateY: -120 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-[#4a3728] to-[#2d1f16] rounded-lg border-4 border-[#1a1410]" />
            </motion.div>

            {/* Treasure Chest Reveal */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8, type: "spring" }}
            >
              {/* Chest */}
              <div className="relative">
                <motion.div
                  className="text-6xl"
                  animate={{
                    y: [-5, 0, -5],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  💰
                </motion.div>

                {/* Golden Glow */}
                <motion.div
                  className="absolute inset-0 -m-4 bg-yellow-400 rounded-full blur-xl opacity-60"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.4, 0.7, 0.4],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />

                {/* Sparkles */}
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 bg-yellow-300 rounded-full"
                    style={{
                      left: "50%",
                      top: "50%",
                    }}
                    animate={{
                      x: [0, Math.cos(i * 45 * Math.PI / 180) * 30],
                      y: [0, Math.sin(i * 45 * Math.PI / 180) * 30],
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
            </motion.div>

            {/* Coins Falling */}
            {state === "revealed-winner" && [...Array(15)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-2xl"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  top: "-10%",
                }}
                initial={{ y: 0, opacity: 1, rotate: 0 }}
                animate={{
                  y: 150,
                  opacity: [1, 1, 0],
                  rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
                }}
                transition={{
                  duration: 1.5 + Math.random(),
                  delay: 1 + i * 0.1,
                  ease: "easeIn",
                }}
              >
                🪙
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Floor Shadow */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-2 bg-black/40 rounded-full blur-sm" />
    </motion.button>
  );
}
