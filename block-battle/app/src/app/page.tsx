"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import CreateBet from "@/components/CreateBet";
import ManageBet from "@/components/ManageBet";
import OpenBets from "@/components/OpenBets";
import QuickPlay from "@/components/QuickPlay";

type Tab = "play" | "browse" | "create" | "manage";

function HomeContent() {
  const [activeTab, setActiveTab] = useState<Tab>("play");
  const searchParams = useSearchParams();
  const betParam = searchParams.get("bet");

  // Auto-switch to play tab if bet parameter is present
  useEffect(() => {
    if (betParam) {
      setActiveTab("play");
    }
  }, [betParam]);

  return (
    <div className="min-h-screen bg-[#050509] overflow-x-hidden">
      {/* Modern Web3 background with subtle gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Subtle noise texture */}
        <svg className="absolute inset-0 opacity-[0.02] w-full h-full">
          <filter id="noiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noiseFilter)" />
        </svg>

        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 left-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[128px]" />
      </div>

      {/* Modern Web3 Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0E0E10]/90 border-b border-white/[0.08] relative">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                <span className="text-xl">🎲</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  Block Battle
                </h1>
              </div>
            </div>

            {/* Nav Tabs - Center */}
            <div className="hidden md:flex items-center gap-1 bg-white/[0.03] rounded-full p-1 border border-white/[0.06]">
              {[
                { id: "play" as Tab, label: "Play" },
                { id: "browse" as Tab, label: "Browse" },
                { id: "create" as Tab, label: "Create" },
                { id: "manage" as Tab, label: "Manage" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/20"
                      : "text-gray-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right: Wallet + Devnet Badge */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-400 font-medium">Devnet</span>
              </div>
              <Header />
            </div>
          </div>
        </div>
      </nav>

      {/* Modern Hero Section - Only on Play tab */}
      {activeTab === "play" && (
        <section className="relative py-20 md:py-32">
          <div className="max-w-[1200px] mx-auto px-6 relative z-10">
            <div className="text-center space-y-8 max-w-4xl mx-auto">
              {/* Main Heading */}
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-bold text-white leading-[1.1] tracking-tight">
                  Block Battle
                </h1>
                <div className="text-4xl md:text-6xl font-bold">
                  <span className="bg-gradient-to-r from-purple-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
                    Pick. Bet. Win.
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-lg md:text-xl text-[#A1A1AA] max-w-2xl mx-auto leading-relaxed">
                Decentralized block-based betting on Solana. Choose your lucky block and compete for the prize pool.
              </p>

              {/* Feature Pills */}
              <div className="flex gap-4 justify-center flex-wrap pt-4">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] rounded-full border border-white/[0.08]">
                  <span className="text-lg">⚡</span>
                  <span className="text-sm text-gray-300">Instant Settlement</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] rounded-full border border-white/[0.08]">
                  <span className="text-lg">🔒</span>
                  <span className="text-sm text-gray-300">Trustless Escrow</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] rounded-full border border-white/[0.08]">
                  <span className="text-lg">👥</span>
                  <span className="text-sm text-gray-300">Up to 100 Players</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Content */}
      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-5xl mx-auto">
          {activeTab === "play" && <QuickPlay betAddress={betParam} />}
          {activeTab === "browse" && <OpenBets />}
          {activeTab === "create" && <CreateBet />}
          {activeTab === "manage" && <ManageBet />}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-900 mt-20 py-8 relative z-10">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-gray-600">
            Built on Solana • Powered by Anchor Framework
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050509]" />}>
      <HomeContent />
    </Suspense>
  );
}
