"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DungeonLayout from "@/components/pixel-dungeon/DungeonLayout";
import DungeonHeader from "@/components/pixel-dungeon/DungeonHeader";
import CreateBet from "@/components/CreateBet";
import ManageBet from "@/components/ManageBet";
import OpenBets from "@/components/OpenBets";
import QuickPlayPixel from "@/components/QuickPlayPixel";
import { motion } from "framer-motion";
import "@/styles/pixel-dungeon.css";

type Tab = "browse" | "create" | "manage";

const TAB_ICONS: Record<Tab, string> = {
  browse: "🗺️",
  create: "🔨",
  manage: "👑",
};

function HomeContent() {
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const searchParams = useSearchParams();
  const betParam = searchParams.get("bet");

  // If there's a bet parameter, we're viewing a specific pool
  const isViewingPool = !!betParam;

  return (
    <DungeonLayout>
      {/* Pixel Dungeon Header */}
      <DungeonHeader />

      {/* Navigation Tabs - Hide when viewing a specific pool */}
      {!isViewingPool && (
        <nav className="sticky top-20 z-40 backdrop-blur-xl bg-[#0E0E10]/90 border-b-4 border-purple-500/30 relative">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="flex justify-center py-4">
              <div className="inline-flex items-center gap-2 bg-black/50 rounded-full p-1.5 border-4 border-purple-500/30">
                {[
                  { id: "browse" as Tab, label: "BROWSE" },
                  { id: "create" as Tab, label: "CREATE" },
                  { id: "manage" as Tab, label: "MANAGE" },
                ].map((tab) => (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-2.5 rounded-full pixel-font text-xs transition-all ${
                      activeTab === tab.id
                        ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/50"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.05]"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="mr-2">{TAB_ICONS[tab.id]}</span>
                    {tab.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Content */}
      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-5xl mx-auto">
          {isViewingPool ? (
            <>
              {/* Back button */}
              <button
                onClick={() => window.history.back()}
                className="mb-6 px-4 py-2 bg-black/50 hover:bg-black/70 border-2 border-purple-500/50 text-purple-300 hover:text-white pixel-font text-xs rounded-lg transition-all"
              >
                ← BACK TO DUNGEONS
              </button>
              <QuickPlayPixel betAddress={betParam} />
            </>
          ) : (
            <>
              {activeTab === "browse" && <OpenBets />}
              {activeTab === "create" && <CreateBet />}
              {activeTab === "manage" && <ManageBet />}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t-4 border-purple-500/30 mt-20 py-8 relative z-10 bg-black/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs pixel-font text-purple-300">
            BUILT ON SOLANA • POWERED BY PIXEL MAGIC ✨
          </p>
        </div>
      </footer>
    </DungeonLayout>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050509] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500 mb-4"></div>
          <p className="pixel-font text-purple-300">LOADING DUNGEON...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
