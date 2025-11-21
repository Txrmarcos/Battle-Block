"use client";

import { useState } from "react";
import DungeonLayout from "@/components/pixel-dungeon/DungeonLayout";
import DungeonHeader from "@/components/pixel-dungeon/DungeonHeader";
import PixelDungeonGrid from "@/components/pixel-dungeon/PixelDungeonGrid";
import VictoryModal from "@/components/pixel-dungeon/VictoryModal";
import { useDungeonReveal } from "@/hooks/useDungeonReveal";
import { motion } from "framer-motion";
import "@/styles/pixel-dungeon.css";

export default function DemoPage() {
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [playerBlock, setPlayerBlock] = useState<number | null>(null);
  const [prizeAmount] = useState(2.5);

  const {
    isRevealing,
    showVictory,
    winnerBlock,
    startReveal,
    closeVictory,
    reset,
  } = useDungeonReveal();

  const handleJoin = () => {
    if (selectedBlock) {
      setPlayerBlock(selectedBlock);
    }
  };

  const handleReveal = () => {
    // Random winner for demo
    const randomWinner = Math.floor(Math.random() * 25) + 1;
    startReveal(randomWinner, playerBlock || undefined);
  };

  const handleReset = () => {
    reset();
    setSelectedBlock(null);
    setPlayerBlock(null);
  };

  const handleClaim = () => {
    closeVictory();
    setTimeout(() => {
      handleReset();
    }, 500);
  };

  return (
    <DungeonLayout>
      <DungeonHeader />

      {/* Hero Section */}
      <section className="relative py-12 md:py-20">
        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <div className="text-center space-y-6 max-w-4xl mx-auto">
            <motion.div
              className="space-y-4"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold pixel-font text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400"
                  style={{
                    textShadow: "4px 4px 0px #000, 6px 6px 0px rgba(168, 85, 247, 0.3)",
                  }}>
                🗝️ PIXEL DUNGEON 🗝️
              </h1>
              <div className="text-2xl md:text-4xl pixel-font">
                <span className="text-yellow-300"
                      style={{
                        textShadow: "3px 3px 0px #000",
                      }}>
                  DEMO MODE
                </span>
              </div>
            </motion.div>

            <motion.p
              className="text-base md:text-lg pixel-font text-cyan-300 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Choose your door, test your luck, and claim the treasure!
            </motion.p>

            {/* Feature Pills */}
            <motion.div
              className="flex gap-4 justify-center flex-wrap pt-4"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <FeaturePill icon="⚡" text="Instant Animation" />
              <FeaturePill icon="🎮" text="8-Bit Graphics" />
              <FeaturePill icon="🏆" text="Epic Cutscenes" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Demo Stats */}
          <motion.div
            className="dungeon-bg rounded-2xl border-4 border-cyan-500/30 p-6 stone-texture"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <DemoStatBox
                icon="💰"
                label="PRIZE POOL"
                value={`${prizeAmount} SOL`}
                color="yellow"
              />
              <DemoStatBox
                icon="🎯"
                label="YOUR DOOR"
                value={playerBlock ? `#${playerBlock}` : "Not Selected"}
                color="cyan"
              />
              <DemoStatBox
                icon="🏆"
                label="WINNER"
                value={winnerBlock ? `Door ${winnerBlock}` : "???"}
                color="purple"
              />
              <DemoStatBox
                icon={isRevealing ? "⏳" : "✅"}
                label="STATUS"
                value={isRevealing ? "REVEALING" : playerBlock ? "READY" : "WAITING"}
                color="green"
              />
            </div>
          </motion.div>

          {/* Dungeon Grid */}
          <PixelDungeonGrid
            selectedBlock={selectedBlock}
            onSelectBlock={setSelectedBlock}
            winnerBlock={winnerBlock || undefined}
            isRevealing={isRevealing}
            disabled={!!playerBlock && !isRevealing}
            playerBlock={playerBlock || undefined}
          />

          {/* Control Buttons */}
          <div className="max-w-2xl mx-auto space-y-4">
            {!playerBlock && (
              <motion.button
                onClick={handleJoin}
                disabled={!selectedBlock}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 border-4 border-green-400 rounded-xl pixel-font text-xl md:text-2xl text-white hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed pixel-button shadow-lg glow-cyan"
                whileHover={{ scale: selectedBlock ? 1.02 : 1 }}
                whileTap={{ scale: selectedBlock ? 0.98 : 1 }}
              >
                {selectedBlock ? `⚔️ LOCK IN DOOR ${selectedBlock} ⚔️` : "🔒 SELECT A DOOR"}
              </motion.button>
            )}

            {playerBlock && !isRevealing && !winnerBlock && (
              <motion.button
                onClick={handleReveal}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-cyan-600 border-4 border-purple-400 rounded-xl pixel-font text-xl md:text-2xl text-white hover:from-purple-500 hover:to-cyan-500 transition-all pixel-button shadow-lg glow-purple"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                🎲 REVEAL WINNER 🎲
              </motion.button>
            )}

            {winnerBlock && (
              <motion.button
                onClick={handleReset}
                className="w-full py-3 bg-gradient-to-r from-gray-700 to-gray-800 border-4 border-gray-600 rounded-xl pixel-font text-lg text-white hover:from-gray-600 hover:to-gray-700 transition-all pixel-button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                🔄 RESET DEMO
              </motion.button>
            )}
          </div>

          {/* Instructions */}
          <motion.div
            className="bg-gradient-to-br from-purple-900/20 to-cyan-900/20 border-4 border-purple-500/30 rounded-2xl p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <h3 className="text-xl pixel-font text-purple-300 mb-4 text-center">
              📜 HOW TO PLAY 📜
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-center">
              <InstructionStep
                number="1"
                title="CHOOSE"
                description="Click a door (1-25)"
                icon="🚪"
              />
              <InstructionStep
                number="2"
                title="LOCK IN"
                description="Confirm your choice"
                icon="🔒"
              />
              <InstructionStep
                number="3"
                title="REVEAL"
                description="Watch the magic happen!"
                icon="✨"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Victory Modal */}
      <VictoryModal
        isOpen={showVictory}
        onClose={closeVictory}
        onClaim={handleClaim}
        prizeAmount={prizeAmount}
        winningBlock={winnerBlock || 0}
      />
    </DungeonLayout>
  );
}

// Helper Components
function FeaturePill({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border-2 border-white/[0.08] rounded-full">
      <span className="text-lg">{icon}</span>
      <span className="text-xs md:text-sm pixel-font text-gray-300">{text}</span>
    </div>
  );
}

function DemoStatBox({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    yellow: "from-yellow-600/20 to-yellow-500/20 border-yellow-500",
    cyan: "from-cyan-600/20 to-cyan-500/20 border-cyan-500",
    purple: "from-purple-600/20 to-purple-500/20 border-purple-500",
    green: "from-green-600/20 to-green-500/20 border-green-500",
  };

  return (
    <motion.div
      className={`bg-gradient-to-br ${colorMap[color]} border-4 rounded-xl p-4 text-center`}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className="text-3xl md:text-4xl mb-2">{icon}</div>
      <p className="text-xs pixel-font text-gray-400 mb-1">{label}</p>
      <p className="text-sm md:text-lg pixel-font text-white font-bold truncate">{value}</p>
    </motion.div>
  );
}

function InstructionStep({
  number,
  title,
  description,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-4xl">{icon}</div>
      <div className="inline-block px-3 py-1 bg-cyan-500/20 border-2 border-cyan-500 rounded-lg">
        <span className="pixel-font text-cyan-300 text-sm">STEP {number}</span>
      </div>
      <p className="pixel-font text-white text-sm">{title}</p>
      <p className="pixel-font text-gray-400 text-xs">{description}</p>
    </div>
  );
}
