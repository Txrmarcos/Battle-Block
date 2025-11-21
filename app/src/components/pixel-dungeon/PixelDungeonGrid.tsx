"use client";

import { useState, useEffect, useMemo } from "react";
import PixelDoor, { DoorState, TrapType } from "./PixelDoor";
import { motion, AnimatePresence } from "framer-motion";

const TOTAL_DOORS = 25;
const TRAP_TYPES: TrapType[] = ["arrow", "poison", "skeleton", "slime", "spikes", "curse"];

interface PixelDungeonGridProps {
  selectedBlock: number | null;
  onSelectBlock: (block: number) => void;
  winnerBlock?: number;
  isRevealing?: boolean;
  disabled?: boolean;
  playerBlock?: number;
}

export default function PixelDungeonGrid({
  selectedBlock,
  onSelectBlock,
  winnerBlock,
  isRevealing = false,
  disabled = false,
  playerBlock
}: PixelDungeonGridProps) {
  const [doorStates, setDoorStates] = useState<Record<number, DoorState>>({});

  // Initialize random trap types - OTIMIZADO com useMemo
  const trapTypes = useMemo(() => {
    const types: Record<number, TrapType> = {};
    for (let i = 1; i <= TOTAL_DOORS; i++) {
      types[i] = TRAP_TYPES[Math.floor(Math.random() * TRAP_TYPES.length)];
    }
    return types;
  }, []); // Só calcula uma vez

  // Update door states based on selection
  useEffect(() => {
    const newStates: Record<number, DoorState> = {};
    for (let i = 1; i <= TOTAL_DOORS; i++) {
      if (isRevealing) {
        if (i === winnerBlock) {
          newStates[i] = "opening";
        } else {
          newStates[i] = "idle";
        }
      } else {
        newStates[i] = i === selectedBlock ? "selected" : "idle";
      }
    }
    setDoorStates(newStates);
  }, [selectedBlock, isRevealing, winnerBlock]);

  // Reveal animation sequence
  useEffect(() => {
    if (isRevealing && winnerBlock) {
      const loserDoors = Array.from({ length: TOTAL_DOORS }, (_, i) => i + 1).filter(
        (n) => n !== winnerBlock
      );

      // Shuffle loser doors for random trap animation
      const shuffled = [...loserDoors].sort(() => Math.random() - 0.5);

      // Trigger trap animations in sequence
      shuffled.forEach((door, index) => {
        setTimeout(() => {
          setDoorStates((prev) => ({
            ...prev,
            [door]: "trapped",
          }));

          // After trap animation, mark as revealed-loser
          setTimeout(() => {
            setDoorStates((prev) => ({
              ...prev,
              [door]: "revealed-loser",
            }));
          }, 1000);
        }, index * 100);
      });

      // Winner door opens after all traps
      setTimeout(() => {
        setDoorStates((prev) => ({
          ...prev,
          [winnerBlock]: "revealed-winner",
        }));
      }, shuffled.length * 100 + 500);
    }
  }, [isRevealing, winnerBlock]);

  const getDoorState = (blockNum: number): DoorState => {
    return doorStates[blockNum] || "idle";
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Dungeon Background */}
      <div className="absolute inset-0 -m-8 bg-gradient-to-b from-[#0f0f1e] via-[#1a1a2e] to-[#0f0f1e] rounded-3xl opacity-90 blur-sm" />

      {/* Torches on sides */}
      <div className="absolute -left-12 top-1/2 -translate-y-1/2">
        <TorchFlame />
      </div>
      <div className="absolute -right-12 top-1/2 -translate-y-1/2">
        <TorchFlame />
      </div>

      {/* Grid Container */}
      <div className="relative z-10 p-8">
        {/* Title */}
        <motion.div
          className="text-center mb-8"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold pixel-font text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]">
            {isRevealing ? "⚔️ REVEALING FATE ⚔️" : "🗝️ CHOOSE YOUR DOOR 🗝️"}
          </h2>
          <p className="text-cyan-300 pixel-font mt-2 text-sm md:text-base">
            {isRevealing
              ? "Only one door contains the treasure..."
              : "One door leads to treasure, the others to traps!"}
          </p>
        </motion.div>

        {/* Door Grid 5x5 */}
        <div className="grid grid-cols-5 gap-3 md:gap-4">
          {Array.from({ length: TOTAL_DOORS }, (_, i) => i + 1).map((blockNum, index) => (
            <motion.div
              key={blockNum}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                delay: index * 0.03,
                type: "spring",
                stiffness: 200,
                damping: 15,
              }}
            >
              <PixelDoor
                blockNumber={blockNum}
                state={getDoorState(blockNum)}
                isWinner={blockNum === winnerBlock}
                trapType={trapTypes[blockNum]}
                onSelect={() => onSelectBlock(blockNum)}
                disabled={disabled || isRevealing}
              />
            </motion.div>
          ))}
        </div>

        {/* Player's Choice Indicator */}
        {playerBlock && !isRevealing && (
          <motion.div
            className="mt-6 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 border-2 border-cyan-500 rounded-xl">
              <span className="text-2xl">🎯</span>
              <span className="pixel-font text-cyan-300">
                You chose Door <span className="text-cyan-100 font-bold">{playerBlock}</span>
              </span>
            </div>
          </motion.div>
        )}

        {/* Atmospheric Particles - REDUZIDO para 3 */}
        <AnimatePresence>
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-purple-400 rounded-full opacity-30 will-change-transform pointer-events-none"
              style={{
                left: `${25 + i * 25}%`,
                top: `${30 + i * 15}%`,
              }}
              animate={{
                y: [-20, -40],
                opacity: [0.3, 0, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                delay: i * 0.8,
                ease: "easeInOut",
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Floor Shadow */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/60 to-transparent rounded-b-3xl" />
    </div>
  );
}

// Torch Flame Component
function TorchFlame() {
  return (
    <div className="relative">
      {/* Torch Holder */}
      <div className="w-6 h-32 bg-gradient-to-b from-[#4a3728] to-[#2d1f16] rounded-sm border-2 border-[#1a1410]" />

      {/* Flame */}
      <motion.div
        className="absolute -top-8 left-1/2 -translate-x-1/2 w-8 h-12 bg-gradient-to-t from-orange-600 via-yellow-500 to-yellow-300 rounded-full"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Flame Glow */}
      <motion.div
        className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-orange-400 rounded-full blur-xl opacity-40"
        animate={{
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
        }}
      />
    </div>
  );
}
