"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useBlockBattle } from "@/lib/useBlockBattle";
import { useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

type GameMode = "automatic" | "arbiter";

export default function CreateBet() {
  const { connected, publicKey } = useWallet();
  const { createBet } = useBlockBattle();
  const [loading, setLoading] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>("automatic");
  const [formData, setFormData] = useState({
    minDeposit: "0.1",
    arbiter: "",
    lockTime: "300", // 5 minutes in seconds
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isAutomatic = gameMode === "automatic";

      // For automatic mode, use a placeholder arbiter address (system program)
      // For arbiter mode, use the provided address
      const arbiterPubkey = isAutomatic
        ? PublicKey.default // System program as placeholder
        : new PublicKey(formData.arbiter);

      // For arbiter mode, locktime is not used, so we use current time + 1 year as dummy
      // For automatic mode, use the configured locktime
      const lockTimeSeconds = isAutomatic
        ? parseInt(formData.lockTime)
        : 31536000; // 1 year (not used for arbiter mode)

      const result = await createBet(
        parseFloat(formData.minDeposit),
        arbiterPubkey,
        lockTimeSeconds,
        isAutomatic
      );

      if (result) {
        // Generate shareable URL
        const shareUrl = `${window.location.origin}?bet=${result.betPDA.toBase58()}`;

        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast.success(`Bet created! Share link copied to clipboard!`);
        } catch (err) {
          toast.success(`Bet created! Share: ${result.betPDA.toBase58()}`);
        }

        console.log("Bet created at:", result.betPDA.toBase58());
        console.log("Share URL:", shareUrl);
        setFormData({ minDeposit: "0.1", arbiter: "", lockTime: "300" });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to create pool");
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="bg-gradient-to-br from-[#0f0f1e] to-[#1a1a2e] border-4 border-purple-500/30 rounded-2xl p-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
        <div className="relative z-10">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-xl pixel-font mb-2 text-purple-300">CONNECT WALLET</h3>
          <p className="text-sm text-cyan-300">Connect to forge a new dungeon</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header Banner */}
      <div className="relative">
        <div className="absolute -inset-2 bg-gradient-to-r from-purple-600/30 via-cyan-600/30 to-purple-600/30 rounded-[2.5rem] blur-3xl" />

        <div className="relative bg-gradient-to-br from-[#0a0a15] via-[#15152a] to-[#0a0a15] rounded-[2.5rem] p-10 overflow-hidden border-2 border-purple-500/40 shadow-[inset_0_2px_20px_rgba(0,0,0,0.8),0_0_40px_rgba(168,85,247,0.15)]">
          <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-[0.08] mix-blend-overlay" />

          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-orange-400/30 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0, 0.6, 0],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 text-center">
            <motion.div
              className="inline-block text-7xl mb-4"
              animate={{
                rotate: [0, -10, 10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              🔨
            </motion.div>

            <motion.h2
              className="text-4xl md:text-5xl pixel-font mb-3"
              style={{
                background: "linear-gradient(135deg, #a78bfa 0%, #06b6d4 50%, #a78bfa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 20px rgba(167, 139, 250, 0.5))",
              }}
            >
              FORGE NEW DUNGEON
            </motion.h2>

            <p className="text-sm pixel-font text-cyan-300/80">Create your legendary quest</p>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-b from-purple-600/20 via-cyan-600/20 to-purple-600/20 rounded-[2rem] blur-2xl" />

        <div className="relative bg-gradient-to-br from-[#08080f]/95 via-[#0f0f1a]/95 to-[#08080f]/95 rounded-[2rem] p-8 border-2 border-purple-500/30 shadow-[inset_0_4px_30px_rgba(0,0,0,0.9),0_0_50px_rgba(139,92,246,0.1)] backdrop-blur-sm">
          <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-[0.04]" />

          <div className="relative z-10">

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Game Mode Selection */}
          <div>
            <label className="block text-sm pixel-font text-purple-300/80 mb-4 text-center">
              🎮 SELECT GAME MODE
            </label>
            <div className="grid grid-cols-2 gap-4">
              <motion.button
                type="button"
                onClick={() => setGameMode("automatic")}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`relative p-6 rounded-[1.5rem] pixel-font text-sm transition-all border-2 overflow-hidden group ${
                  gameMode === "automatic"
                    ? "border-cyan-500/60 shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                    : "border-purple-500/30 hover:border-purple-500/50"
                }`}
              >
                {gameMode === "automatic" && (
                  <motion.div
                    layoutId="gameModeActive"
                    className="absolute inset-0 bg-gradient-to-br from-cyan-600/30 via-blue-600/30 to-purple-600/30"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />

                <div className="relative z-10">
                  <motion.div
                    className="text-5xl mb-3"
                    animate={gameMode === "automatic" ? {
                      rotate: [0, -10, 10, 0],
                    } : {}}
                    transition={{ duration: 0.6 }}
                  >
                    ⚡
                  </motion.div>
                  <div className="font-bold mb-2 text-white">AUTOMATIC</div>
                  <div className="text-[10px] text-cyan-300/70">Random reveal after time</div>
                </div>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => setGameMode("arbiter")}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`relative p-6 rounded-[1.5rem] pixel-font text-sm transition-all border-2 overflow-hidden group ${
                  gameMode === "arbiter"
                    ? "border-yellow-500/60 shadow-[0_0_30px_rgba(234,179,8,0.4)]"
                    : "border-purple-500/30 hover:border-purple-500/50"
                }`}
              >
                {gameMode === "arbiter" && (
                  <motion.div
                    layoutId="gameModeActive"
                    className="absolute inset-0 bg-gradient-to-br from-yellow-600/30 via-orange-600/30 to-red-600/30"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />

                <div className="relative z-10">
                  <motion.div
                    className="text-5xl mb-3"
                    animate={gameMode === "arbiter" ? {
                      rotate: [0, -10, 10, 0],
                    } : {}}
                    transition={{ duration: 0.6 }}
                  >
                    👑
                  </motion.div>
                  <div className="font-bold mb-2 text-white">ARBITER</div>
                  <div className="text-[10px] text-yellow-300/70">Manual reveal by judge</div>
                </div>
              </motion.button>
            </div>
          </div>

          <div>
            <label className="block text-sm pixel-font text-purple-300/80 mb-3">
              💰 ENTRY FEE (SOL)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.minDeposit}
                onChange={(e) => setFormData({ ...formData, minDeposit: e.target.value })}
                className="w-full px-5 py-4 bg-black/60 border-2 border-purple-500/40 rounded-2xl text-white placeholder-purple-300/30 focus:outline-none focus:border-cyan-500/60 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all pixel-font shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                placeholder="0.1"
                required
              />
            </div>
          </div>

          {gameMode === "arbiter" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <label className="block text-sm pixel-font text-yellow-300/80 mb-3">
                👑 ARBITER ADDRESS
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.arbiter}
                  onChange={(e) => setFormData({ ...formData, arbiter: e.target.value })}
                  className="w-full px-5 py-4 bg-black/60 border-2 border-yellow-500/40 rounded-2xl text-white placeholder-yellow-300/30 focus:outline-none focus:border-yellow-500/60 focus:shadow-[0_0_20px_rgba(234,179,8,0.2)] transition-all font-mono text-sm shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                  placeholder="Judge's public key..."
                  required
                />
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xs pixel-font text-yellow-400/70 mt-3 flex items-center gap-2"
              >
                <span className="text-base">⚡</span>
                Arbiter reveals the treasure at any time
              </motion.p>
            </motion.div>
          )}

          {gameMode === "automatic" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <label className="block text-sm pixel-font text-cyan-300/80 mb-4">
                ⏰ AUTO-REVEAL TIME
              </label>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: "1MIN", value: "60", icon: "⚡" },
                  { label: "5MIN", value: "300", icon: "⏱️" },
                  { label: "15MIN", value: "900", icon: "⏳" },
                  { label: "1HR", value: "3600", icon: "🕐" },
                ].map((preset) => (
                  <motion.button
                    key={preset.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, lockTime: preset.value })}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative px-3 py-3 rounded-2xl pixel-font text-xs transition-all border-2 overflow-hidden ${
                      formData.lockTime === preset.value
                        ? "border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                        : "border-purple-500/30 hover:border-cyan-500/50"
                    }`}
                  >
                    {formData.lockTime === preset.value && (
                      <motion.div
                        layoutId="timePreset"
                        className="absolute inset-0 bg-gradient-to-br from-cyan-600/40 via-blue-600/40 to-purple-600/40"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                    <div className="absolute inset-0 bg-black/50" />
                    <div className="relative z-10">
                      <div className="text-lg mb-1">{preset.icon}</div>
                      <div className={`font-bold ${formData.lockTime === preset.value ? 'text-white' : 'text-cyan-300/70'}`}>
                        {preset.label}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="60"
                  value={formData.lockTime}
                  onChange={(e) => setFormData({ ...formData, lockTime: e.target.value })}
                  className="w-full px-5 py-4 bg-black/60 border-2 border-cyan-500/40 rounded-2xl text-white placeholder-cyan-300/30 focus:outline-none focus:border-cyan-500/60 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all pixel-font shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                  placeholder="Custom time in seconds..."
                  required
                />
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xs pixel-font text-cyan-400/70 mt-3 flex items-center gap-2"
              >
                <span className="text-base">⚡</span>
                Winner revealed automatically after timer expires
              </motion.p>
            </motion.div>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={!loading ? { scale: 1.02, y: -3 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
            className="relative w-full mt-2 py-5 rounded-[1.5rem] pixel-font text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
          >
            {/* Animated gradient background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-600 to-green-600"
              animate={!loading ? {
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              } : {}}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              style={{ backgroundSize: '200% 200%' }}
            />

            {/* Shine effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />

            {/* Border glow */}
            <div className="absolute inset-0 rounded-[1.5rem] border-3 border-green-400/60 shadow-[0_0_30px_rgba(16,185,129,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]" />

            {/* Content */}
            <span className="relative z-10 text-white font-bold flex items-center justify-center gap-3">
              {loading ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    ⚒️
                  </motion.span>
                  FORGING DUNGEON...
                </>
              ) : (
                <>
                  <motion.span
                    animate={{ rotate: [0, -15, 15, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                  >
                    ⚔️
                  </motion.span>
                  FORGE DUNGEON
                  <motion.span
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                  >
                    ⚔️
                  </motion.span>
                </>
              )}
            </span>
          </motion.button>
        </form>

        {/* Info panel */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative mt-6"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600/20 via-cyan-600/20 to-purple-600/20 rounded-[1.5rem] blur-lg" />

          <div className="relative bg-gradient-to-br from-purple-900/20 via-black/40 to-cyan-900/20 backdrop-blur-sm rounded-[1.5rem] p-5 border-2 border-purple-500/30 overflow-hidden">
            {/* Texture overlay */}
            <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-[0.03]" />

            {/* Content */}
            <div className="relative z-10 space-y-3">
              <p className="text-xs pixel-font text-purple-300/90 text-center flex items-center justify-center gap-2">
                <span className="text-sm">✨</span>
                CREATE MULTIPLE DUNGEONS • MANAGE IN 👑 TAB
              </p>

              <div className="h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

              <AnimatePresence mode="wait">
                {gameMode === "automatic" ? (
                  <motion.p
                    key="automatic"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="text-xs pixel-font text-cyan-400/90 text-center flex items-center justify-center gap-2"
                  >
                    <span className="text-sm">⚡</span>
                    Winner auto-reveals after time • No arbiter needed
                  </motion.p>
                ) : (
                  <motion.p
                    key="arbiter"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="text-xs pixel-font text-yellow-400/90 text-center flex items-center justify-center gap-2"
                  >
                    <span className="text-sm">👑</span>
                    Arbiter reveals winner at any time • No time limit
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
