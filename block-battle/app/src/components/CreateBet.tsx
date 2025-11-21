"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useBlockBattle } from "@/lib/useBlockBattle";
import { useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";

export default function CreateBet() {
  const { connected, publicKey } = useWallet();
  const { createBet } = useBlockBattle();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    minDeposit: "0.1",
    arbiter: "",
    lockTime: "300", // 5 minutes in seconds
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const arbiterPubkey = new PublicKey(formData.arbiter);
      const result = await createBet(
        parseFloat(formData.minDeposit),
        arbiterPubkey,
        parseInt(formData.lockTime)
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
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h3 className="text-xl font-semibold mb-2 text-white">Connect Wallet</h3>
        <p className="text-[#A1A1AA] text-sm">Connect your wallet to create a pool</p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">
          Create New Pool
        </h2>
        <p className="text-sm text-[#A1A1AA]">Set up a new betting pool</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Minimum Deposit (SOL)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={formData.minDeposit}
            onChange={(e) => setFormData({ ...formData, minDeposit: e.target.value })}
            className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-[#71717A] focus:outline-none focus:border-purple-500 transition-all"
            placeholder="0.1"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Arbiter Address
          </label>
          <input
            type="text"
            value={formData.arbiter}
            onChange={(e) => setFormData({ ...formData, arbiter: e.target.value })}
            className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-[#71717A] focus:outline-none focus:border-purple-500 transition-all font-mono text-sm"
            placeholder="Public key of the arbiter"
            required
          />
          <p className="text-xs text-[#A1A1AA] mt-2">Who will reveal the winner</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Lock Time (seconds)
          </label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "1min", value: "60" },
              { label: "5min", value: "300" },
              { label: "15min", value: "900" },
              { label: "1hr", value: "3600" },
            ].map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setFormData({ ...formData, lockTime: preset.value })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.lockTime === preset.value
                    ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white"
                    : "bg-white/[0.03] text-[#A1A1AA] hover:bg-white/[0.06] hover:text-white border border-white/[0.06]"
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
            className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-[#71717A] focus:outline-none focus:border-purple-500 transition-all"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/30"
        >
          {loading ? "Creating..." : "Create Pool"}
        </button>
      </form>

      <div className="mt-6 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
        <p className="text-sm text-[#A1A1AA] text-center">
          You can create multiple pools. Manage them in the <span className="text-purple-400 font-medium">"Manage"</span> tab.
        </p>
      </div>
    </div>
  );
}
