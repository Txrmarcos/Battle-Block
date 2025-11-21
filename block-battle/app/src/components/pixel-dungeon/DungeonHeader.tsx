"use client";

import { motion } from "framer-motion";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

type Tab = "browse" | "create" | "manage";

const TAB_ICONS: Record<Tab, string> = {
  browse: "🗺️",
  create: "🔨",
  manage: "👑",
};

interface DungeonHeaderProps {
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
  showNavigation?: boolean;
}

export default function DungeonHeader({ activeTab, onTabChange, showNavigation = true }: DungeonHeaderProps) {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0E0E10]/90 border-b-4 border-purple-500/30 relative crt-effect">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between h-20 gap-8">
          {/* Logo with Pixel Art Style */}
          <motion.div
            className="flex items-center gap-3 flex-shrink-0"
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {/* Animated Logo Icon */}
            <motion.div
              className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-cyan-600 border-4 border-purple-400 flex items-center justify-center pixel-art"
              animate={{
                boxShadow: [
                  "0 0 20px rgba(168, 85, 247, 0.5)",
                  "0 0 40px rgba(168, 85, 247, 0.8)",
                  "0 0 20px rgba(168, 85, 247, 0.5)",
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            >
              <motion.span
                className="text-2xl"
                animate={{
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              >
                🗝️
              </motion.span>

              {/* Corner decorations */}
              <div className="absolute -top-1 -left-1 w-2 h-2 bg-yellow-400 rounded-sm" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-sm" />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-yellow-400 rounded-sm" />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-yellow-400 rounded-sm" />
            </motion.div>

            {/* Title */}
            <div>
              <motion.h1
                className="text-xl font-bold pixel-font text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400"
                style={{
                  textShadow: "2px 2px 0px #000, 4px 4px 0px rgba(168, 85, 247, 0.3)",
                }}
                animate={{
                  backgroundPosition: ["0%", "100%", "0%"],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                }}
              >
                PIXEL DUNGEON
              </motion.h1>
              <p className="text-[10px] pixel-font text-cyan-300/80">
                Block Battle Arena
              </p>
            </div>
          </motion.div>

          {/* Center: Navigation Tabs (only show if not viewing a pool) */}
          {showNavigation && onTabChange && (
            <motion.div
              className="flex-1 flex justify-center"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="relative">
                {/* Glow effect behind tabs */}
                <motion.div
                  className="absolute -inset-2 bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-purple-500/20 rounded-[1.5rem] blur-xl"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />

                <div className="relative flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-[1.5rem] p-1.5 border-2 border-purple-500/40 shadow-[inset_0_1px_0_0_rgba(168,85,247,0.2),0_0_20px_rgba(168,85,247,0.15)]">
                  {[
                    { id: "browse" as Tab, label: "BROWSE" },
                    { id: "create" as Tab, label: "CREATE" },
                    { id: "manage" as Tab, label: "MANAGE" },
                  ].map((tab) => (
                    <motion.button
                      key={tab.id}
                      onClick={() => onTabChange(tab.id)}
                      className={`relative px-5 py-2.5 rounded-[1.2rem] pixel-font text-xs transition-all group overflow-hidden ${
                        activeTab === tab.id
                          ? "text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      animate={activeTab === tab.id ? {
                        boxShadow: [
                          "0 0 20px rgba(168, 85, 247, 0.4)",
                          "0 0 30px rgba(6, 182, 212, 0.4)",
                          "0 0 20px rgba(168, 85, 247, 0.4)",
                        ]
                      } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {/* Active background with gradient */}
                      {activeTab === tab.id && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 bg-gradient-to-br from-purple-600 via-purple-500 to-cyan-600 rounded-[1.2rem]"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                      )}

                      {/* Hover glow */}
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-cyan-500/0 to-purple-500/0 group-hover:from-purple-500/10 group-hover:via-cyan-500/10 group-hover:to-purple-500/10 rounded-[1.2rem] transition-all duration-300" />

                      {/* Content */}
                      <div className="relative z-10 flex items-center gap-2">
                        <motion.span
                          className="text-lg"
                          animate={activeTab === tab.id ? {
                            rotate: [0, -10, 10, 0],
                          } : {}}
                          transition={{ duration: 0.5 }}
                        >
                          {TAB_ICONS[tab.id]}
                        </motion.span>
                        <span className="font-bold">{tab.label}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Right Side: Devnet Badge + Wallet */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Devnet Indicator */}
            <motion.div
              className="hidden sm:flex items-center gap-2 px-3 py-2 bg-green-500/10 border-2 border-green-500/30 rounded-lg pixel-art"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
            >
              <motion.div
                className="w-2 h-2 bg-green-500 rounded-full"
                animate={{
                  opacity: [1, 0.3, 1],
                  boxShadow: [
                    "0 0 5px rgba(34, 197, 94, 0.8)",
                    "0 0 15px rgba(34, 197, 94, 0.8)",
                    "0 0 5px rgba(34, 197, 94, 0.8)",
                  ],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                }}
              />
              <span className="text-xs text-green-400 pixel-font">DEVNET</span>
            </motion.div>

            {/* Wallet Component */}
            <WalletMultiButton />
          </div>
        </div>
      </div>

      {/* Bottom glow effect */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />
    </nav>
  );
}
