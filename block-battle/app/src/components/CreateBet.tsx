"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useBlockBattle } from "@/lib/useBlockBattle";
import { useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";

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
    <div className="bg-gradient-to-br from-[#0f0f1e] to-[#1a1a2e] border-4 border-purple-500/30 rounded-2xl p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
      <div className="relative z-10">
        <div className="mb-8 text-center">
          <div className="inline-block mb-4">
            <span className="text-5xl">🔨</span>
          </div>
          <h2 className="text-3xl pixel-font text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mb-2"
              style={{ textShadow: "3px 3px 0px #000" }}>
            FORGE NEW DUNGEON
          </h2>
          <p className="text-sm pixel-font text-purple-300">Create your legendary quest</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Game Mode Selection */}
          <div>
            <label className="block text-sm pixel-font text-purple-300 mb-3 text-center">
              🎮 GAME MODE
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGameMode("automatic")}
                className={`p-4 rounded-xl pixel-font text-sm transition-all border-2 ${
                  gameMode === "automatic"
                    ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-purple-400 shadow-lg shadow-purple-500/50"
                    : "bg-black/50 text-purple-300 border-purple-500/30 hover:border-purple-500"
                }`}
              >
                <div className="text-3xl mb-2">⚡</div>
                <div className="font-bold mb-1">AUTOMATIC</div>
                <div className="text-[10px] opacity-80">Random reveal after time</div>
              </button>
              <button
                type="button"
                onClick={() => setGameMode("arbiter")}
                className={`p-4 rounded-xl pixel-font text-sm transition-all border-2 ${
                  gameMode === "arbiter"
                    ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-purple-400 shadow-lg shadow-purple-500/50"
                    : "bg-black/50 text-purple-300 border-purple-500/30 hover:border-purple-500"
                }`}
              >
                <div className="text-3xl mb-2">👑</div>
                <div className="font-bold mb-1">ARBITER</div>
                <div className="text-[10px] opacity-80">Manual reveal by judge</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm pixel-font text-purple-300 mb-2">
              💰 ENTRY FEE (SOL)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.minDeposit}
              onChange={(e) => setFormData({ ...formData, minDeposit: e.target.value })}
              className="w-full px-4 py-3 bg-black/50 border-2 border-purple-500/50 rounded-xl text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-500 transition-all pixel-font"
              placeholder="0.1"
              required
            />
          </div>

          {gameMode === "arbiter" && (
            <div>
              <label className="block text-sm pixel-font text-purple-300 mb-2">
                👑 ARBITER ADDRESS
              </label>
              <input
                type="text"
                value={formData.arbiter}
                onChange={(e) => setFormData({ ...formData, arbiter: e.target.value })}
                className="w-full px-4 py-3 bg-black/50 border-2 border-purple-500/50 rounded-xl text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-500 transition-all font-mono text-sm"
                placeholder="Public key of the arbiter"
                required
              />
              <p className="text-xs pixel-font text-cyan-300 mt-2">⚡ Arbiter reveals the treasure at any time</p>
            </div>
          )}

          {gameMode === "automatic" && (
            <div>
              <label className="block text-sm pixel-font text-purple-300 mb-2">
                ⏰ AUTO-REVEAL TIME
              </label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label: "1MIN", value: "60" },
                { label: "5MIN", value: "300" },
                { label: "15MIN", value: "900" },
                { label: "1HR", value: "3600" },
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, lockTime: preset.value })}
                  className={`px-3 py-2 rounded-lg pixel-font text-xs transition-all border-2 ${
                    formData.lockTime === preset.value
                      ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-purple-400 shadow-lg shadow-purple-500/50"
                      : "bg-black/50 text-purple-300 border-purple-500/30 hover:border-purple-500 hover:text-white"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
              <input
                type="number"
                min="60"
                value={formData.lockTime}
                onChange={(e) => setFormData({ ...formData, lockTime: e.target.value })}
                className="w-full px-4 py-3 bg-black/50 border-2 border-purple-500/50 rounded-xl text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-500 transition-all pixel-font"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white pixel-font text-lg py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-4 border-green-400"
          >
            {loading ? "FORGING..." : "⚔️ FORGE DUNGEON ⚔️"}
          </button>
        </form>

        <div className="mt-6 p-4 bg-purple-500/10 border-2 border-purple-500/30 rounded-xl">
          <p className="text-xs pixel-font text-purple-300 text-center mb-2">
            ✨ CREATE MULTIPLE DUNGEONS • MANAGE IN 👑 TAB
          </p>
          {gameMode === "automatic" ? (
            <p className="text-xs pixel-font text-cyan-400 text-center">
              ⚡ Winner auto-reveals after time • No arbiter needed
            </p>
          ) : (
            <p className="text-xs pixel-font text-yellow-400 text-center">
              👑 Arbiter reveals winner at any time • No time limit
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
