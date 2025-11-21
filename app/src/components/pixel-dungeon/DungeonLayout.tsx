"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface DungeonLayoutProps {
  children: ReactNode;
}

export default function DungeonLayout({ children }: DungeonLayoutProps) {
  return (
    <div className="min-h-screen bg-[#050509] relative overflow-hidden">
      {/* Dungeon Background Layers */}
      <div className="absolute inset-0">
        {/* Base dungeon gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f1e] via-[#1a1a2e] to-[#050509]" />

        {/* Stone texture overlay */}
        <div className="absolute inset-0 stone-texture opacity-20" />

        {/* Gradient orbs (kept from original) */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 left-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[128px]" />

        {/* Floating dust particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [-20, -60],
              opacity: [0, 0.5, 0],
            }}
            transition={{
              duration: 4 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}

        {/* Ambient torch glow effects */}
        <motion.div
          className="absolute top-32 left-8 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
          }}
        />
        <motion.div
          className="absolute top-32 right-8 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"
          animate={{
            opacity: [0.6, 0.3, 0.6],
            scale: [1.2, 1, 1.2],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
          }}
        />

        {/* CRT scanline effect */}
        <div className="scanline" />
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Bottom floor shadow */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </div>
  );
}
