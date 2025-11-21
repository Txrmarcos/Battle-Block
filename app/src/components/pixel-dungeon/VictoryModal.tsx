"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface VictoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaim: () => void;
  prizeAmount: number;
  winningBlock: number;
}

export default function VictoryModal({
  isOpen,
  onClose,
  onClaim,
  prizeAmount,
  winningBlock
}: VictoryModalProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setPhase(0);
      const timers = [
        setTimeout(() => setPhase(1), 500),
        setTimeout(() => setPhase(2), 1500),
        setTimeout(() => setPhase(3), 2500),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />

          {/* Modal Content */}
          <motion.div
            className="relative w-full max-w-2xl"
            initial={{ scale: 0.5, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.5, y: 100 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            {/* Pixel Border Frame */}
            <div className="relative bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1e] rounded-3xl border-8 border-[#d4af37] shadow-2xl overflow-hidden">

              {/* Corner Decorations */}
              <div className="absolute top-0 left-0 w-16 h-16 bg-[#d4af37] clip-corner-tl" />
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#d4af37] clip-corner-tr" />
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-[#d4af37] clip-corner-bl" />
              <div className="absolute bottom-0 right-0 w-16 h-16 bg-[#d4af37] clip-corner-br" />

              {/* Fireworks Background */}
              <div className="absolute inset-0">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      left: `${20 + Math.random() * 60}%`,
                      top: `${20 + Math.random() * 60}%`,
                      backgroundColor: ["#ff0080", "#00ffff", "#ffff00", "#ff8000"][i % 4],
                    }}
                    animate={{
                      scale: [0, 2, 0],
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>

              {/* Content */}
              <div className="relative z-10 p-12 space-y-8">

                {/* Phase 1: Flash */}
                <AnimatePresence>
                  {phase >= 1 && (
                    <motion.div
                      className="text-center"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      <div className="text-8xl mb-4">🎉</div>
                      <motion.h2
                        className="text-5xl md:text-6xl font-bold pixel-font text-yellow-300 drop-shadow-[0_0_20px_rgba(255,215,0,1)]"
                        style={{
                          textShadow: "4px 4px 0px #8b7355, 8px 8px 0px #000",
                        }}
                        animate={{
                          scale: [1, 1.1, 1],
                        }}
                        transition={{
                          duration: 0.5,
                          repeat: Infinity,
                        }}
                      >
                        VICTORY!
                      </motion.h2>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Phase 2: Treasure Chest */}
                <AnimatePresence>
                  {phase >= 2 && (
                    <motion.div
                      className="flex justify-center"
                      initial={{ y: -50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="relative">
                        {/* Chest */}
                        <motion.div
                          className="text-9xl"
                          animate={{
                            y: [-10, 0, -10],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        >
                          💰
                        </motion.div>

                        {/* Golden Rays */}
                        {[...Array(8)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute top-1/2 left-1/2 w-1 bg-yellow-400"
                            style={{
                              height: "60px",
                              transformOrigin: "top",
                              transform: `rotate(${i * 45}deg)`,
                            }}
                            animate={{
                              opacity: [0.3, 0.8, 0.3],
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              delay: i * 0.1,
                            }}
                          />
                        ))}

                        {/* Sparkles */}
                        {[...Array(20)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute w-2 h-2 bg-yellow-300 rounded-full"
                            style={{
                              left: "50%",
                              top: "50%",
                            }}
                            animate={{
                              x: [0, (Math.random() - 0.5) * 100],
                              y: [0, (Math.random() - 0.5) * 100],
                              opacity: [0, 1, 0],
                              scale: [0, 1.5, 0],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              delay: i * 0.1,
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Phase 3: Text and Reward */}
                <AnimatePresence>
                  {phase >= 3 && (
                    <motion.div
                      className="text-center space-y-6"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                    >
                      {/* Message */}
                      <div className="space-y-3">
                        <motion.p
                          className="text-2xl md:text-3xl pixel-font text-cyan-300"
                          style={{
                            textShadow: "2px 2px 0px #000",
                          }}
                        >
                          YOU FOUND THE TREASURE!
                        </motion.p>

                        <motion.p
                          className="text-xl pixel-font text-purple-300"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                        >
                          Door #{winningBlock} held the riches!
                        </motion.p>
                      </div>

                      {/* Prize Amount */}
                      <motion.div
                        className="bg-gradient-to-r from-yellow-600/20 via-yellow-500/30 to-yellow-600/20 border-4 border-yellow-500 rounded-2xl p-6"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: "spring" }}
                      >
                        <p className="text-sm pixel-font text-yellow-200 mb-2">YOUR REWARD</p>
                        <motion.p
                          className="text-5xl md:text-6xl font-bold pixel-font text-yellow-300"
                          style={{
                            textShadow: "3px 3px 0px #8b7355",
                          }}
                          animate={{
                            scale: [1, 1.05, 1],
                          }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                          }}
                        >
                          {prizeAmount.toFixed(4)} SOL
                        </motion.p>
                      </motion.div>

                      {/* Claim Button */}
                      <motion.button
                        onClick={onClaim}
                        className="group relative w-full px-8 py-5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl border-4 border-green-400 shadow-lg overflow-hidden"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.7 }}
                      >
                        {/* Button Shine Effect */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                          animate={{
                            x: ["-100%", "100%"],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatDelay: 1,
                          }}
                        />

                        <span className="relative pixel-font text-3xl text-white font-bold drop-shadow-lg">
                          💎 CLAIM REWARD 💎
                        </span>
                      </motion.button>

                      {/* Close Button */}
                      <motion.button
                        onClick={onClose}
                        className="text-sm pixel-font text-gray-400 hover:text-gray-200 transition-colors"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                      >
                        Close
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Coin Rain */}
                {phase >= 2 && [...Array(30)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute text-3xl"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: "-10%",
                    }}
                    animate={{
                      y: ["0vh", "110vh"],
                      rotate: [0, 360],
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                      duration: 3 + Math.random() * 2,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: "linear",
                    }}
                  >
                    🪙
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
