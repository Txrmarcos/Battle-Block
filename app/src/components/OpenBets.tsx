"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { useBetsList } from "@/hooks/useBetsList";
import { getExplorerAddressUrl } from "@/lib/explorer";

export default function OpenBets() {
  const { bets, loading, error, loadOpenBets, invalidateCache } = useBetsList();

  useEffect(() => {
    loadOpenBets();
  }, [loadOpenBets]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleRefresh = async () => {
    invalidateCache();
    const result = await loadOpenBets(true);
    if (result) {
      toast.success(`Encontradas ${result.length} apostas abertas!`);
    }
  };

  const copyShareLink = (betAddress: string) => {
    const shareUrl = `${window.location.origin}?bet=${betAddress}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied!");
  };

  const joinBet = (betAddress: string) => {
    // Navigate with bet parameter
    window.location.href = `${window.location.origin}?bet=${betAddress}`;
  };

  return (
    <div className="space-y-8">
      {/* Header Section - More dynamic */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        {/* Atmospheric glow */}
        <div className="absolute -inset-2 bg-gradient-to-r from-purple-600/20 via-cyan-600/20 to-purple-600/20 rounded-[2.5rem] blur-3xl" />

        <div className="relative bg-gradient-to-br from-[#0a0a15] via-[#15152a] to-[#0a0a15] rounded-[2.5rem] p-8 overflow-hidden border-2 border-purple-500/30 shadow-[inset_0_2px_20px_rgba(0,0,0,0.8),0_0_40px_rgba(168,85,247,0.1)]">
          {/* Texture overlay */}
          <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-[0.06] mix-blend-overlay" />

          {/* Floating particles - REDUZIDO para 3 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-purple-400/30 rounded-full will-change-transform"
                style={{
                  left: `${25 + i * 25}%`,
                  top: `${35 + i * 15}%`,
                }}
                animate={{
                  y: [0, -35, 0],
                  opacity: [0, 0.6, 0],
                }}
                transition={{
                  duration: 4.5,
                  repeat: Infinity,
                  delay: i * 0.8,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="text-6xl"
                animate={{
                  rotate: [0, -5, 5, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                🗺️
              </motion.div>
              <div>
                <motion.h2
                  className="text-3xl md:text-4xl pixel-font mb-1"
                  style={{
                    background: "linear-gradient(135deg, #a78bfa 0%, #06b6d4 50%, #a78bfa 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 0 20px rgba(167, 139, 250, 0.5))",
                  }}
                >
                  ACTIVE DUNGEONS
                </motion.h2>
                <p className="text-sm pixel-font text-purple-300/70">Choose your quest, brave adventurer</p>
              </div>
            </div>

            <motion.button
              onClick={handleRefresh}
              disabled={loading}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white pixel-font text-xs rounded-2xl transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(168,85,247,0.3)] border-2 border-purple-400/50 disabled:cursor-not-allowed"
            >
              {loading ? "CARREGANDO..." : "🔄 ATUALIZAR"}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Dungeon List */}
      <div className="relative z-10">

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-sm pixel-font text-purple-300">Loading dungeons...</p>
          </div>
        ) : bets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="pixel-font text-purple-300">NO ACTIVE DUNGEONS</p>
            <p className="text-sm pixel-font text-cyan-300 mt-2">Create one in the 🔨 tab!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bets.map((bet, index) => (
              <motion.div
                key={bet.address}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative group"
              >
                {/* Hover glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/0 via-cyan-600/0 to-purple-600/0 group-hover:from-purple-600/30 group-hover:via-cyan-600/30 group-hover:to-purple-600/30 rounded-[1.5rem] blur-xl transition-all duration-500" />

                <div className="relative bg-gradient-to-br from-[#0a0a15]/90 via-[#12121f]/90 to-[#0a0a15]/90 rounded-[1.5rem] p-6 border-2 border-purple-500/30 group-hover:border-cyan-500/50 transition-all duration-300 backdrop-blur-sm shadow-[inset_0_1px_10px_rgba(0,0,0,0.8),0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden">
                  {/* Stone texture */}
                  <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" />

                  {/* Subtle animated shimmer */}
                  <motion.div
                    className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-purple-500/5 to-transparent"
                    animate={{
                      x: ['-200%', '200%'],
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "linear",
                      repeatDelay: 5,
                    }}
                  />

                  <div className="relative z-10">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-3">
                        {/* Dungeon type badge with floating animation */}
                        <motion.div
                          className={`relative flex items-center gap-2 px-4 py-2 rounded-2xl border-2 ${
                            bet.isAutomatic
                              ? 'bg-gradient-to-br from-cyan-600/20 to-blue-600/20 border-cyan-500/40'
                              : 'bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border-yellow-500/40'
                          } shadow-lg`}
                          animate={{
                            y: [0, -3, 0],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: index * 0.2,
                          }}
                        >
                          <span className="text-3xl">{bet.isAutomatic ? "⚡" : "👑"}</span>
                          <div>
                            <p className={`text-[11px] pixel-font font-bold ${bet.isAutomatic ? 'text-cyan-300' : 'text-yellow-300'}`}>
                              {bet.isAutomatic ? 'AUTOMATIC' : 'ARBITER'}
                            </p>
                            <p className="text-[9px] pixel-font text-gray-400 font-mono">
                              {bet.address.slice(0, 6)}...{bet.address.slice(-4)}
                            </p>
                          </div>
                        </motion.div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <motion.button
                          onClick={() => window.open(getExplorerAddressUrl(bet.address), "_blank")}
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 bg-black/50 hover:bg-black/70 border border-cyan-500/40 hover:border-cyan-500 text-cyan-300 hover:text-white pixel-font text-[10px] rounded-xl transition-all shadow-lg"
                          title="View on Solana Explorer"
                        >
                          🔍
                        </motion.button>
                        <motion.button
                          onClick={() => copyShareLink(bet.address)}
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 bg-black/50 hover:bg-black/70 border border-purple-500/40 hover:border-purple-500 text-purple-300 hover:text-white pixel-font text-[10px] rounded-xl transition-all shadow-lg"
                        >
                          📋
                        </motion.button>
                        <motion.button
                          onClick={() => joinBet(bet.address)}
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white pixel-font text-[11px] rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-green-400/50"
                        >
                          ⚔️ ENTER
                        </motion.button>
                      </div>
                    </div>

                    {/* Stats row - flowing pills instead of grid */}
                    <div className="flex flex-wrap items-center gap-3">
                      <StatBadge icon="💰" label="Entry" value={`${bet.minDeposit.toFixed(2)} SOL`} color="purple" />
                      <StatBadge icon="🏆" label="Pool" value={`${bet.totalPool.toFixed(2)} SOL`} color="cyan" />
                      <StatBadge icon="👥" label="Players" value={`${bet.playerCount}/100`} color="yellow" />
                      <StatBadge
                        icon={bet.isAutomatic ? "⚡" : "⏰"}
                        label={bet.isAutomatic ? "Auto" : "Lock"}
                        value={new Date(bet.lockTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        color="green"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Stat badge component for dungeon cards
function StatBadge({
  icon,
  label,
  value,
  color = "purple",
}: {
  icon: string;
  label: string;
  value: string;
  color?: "purple" | "cyan" | "yellow" | "green";
}) {
  const colorClasses = {
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-300",
    cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
    yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
    green: "bg-green-500/10 border-green-500/30 text-green-300",
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm ${colorClasses[color]}`}
    >
      <span className="text-sm">{icon}</span>
      <div className="text-left">
        <p className="text-[8px] pixel-font opacity-70 leading-none">{label}</p>
        <p className="text-[11px] pixel-font font-bold text-white leading-none mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}
