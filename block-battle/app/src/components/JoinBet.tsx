"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useBlockBattle } from "@/lib/useBlockBattle";
import { useWallet } from "@solana/wallet-adapter-react";

const TOTAL_BLOCKS = 25;

export default function JoinBet() {
  const { connected } = useWallet();
  const { joinBet, getBetData } = useBlockBattle();
  const [loading, setLoading] = useState(false);
  const [betAddress, setBetAddress] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState("0.1");
  const [betData, setBetData] = useState<any>(null);

  // Auto-load from URL parameter (shared link)
  useEffect(() => {
    // Check URL for shared bet
    const urlParams = new URLSearchParams(window.location.search);
    const betParam = urlParams.get('bet');

    if (betParam && !betAddress) {
      // Shared link
      setBetAddress(betParam);
      handleLoadBet();
    }
  }, []);

  // Handle loading bet when address changes from URL
  useEffect(() => {
    if (betAddress && !betData) {
      handleLoadBet();
    }
  }, [betAddress]);

  const handleLoadBet = async () => {
    if (!betAddress) return;

    try {
      const betPDA = new PublicKey(betAddress);
      const data = await getBetData(betPDA);
      setBetData(data);
    } catch (error) {
      console.error("Error loading bet:", error);
    }
  };

  const handleJoin = async () => {
    if (!betAddress || selectedBlock === null) return;

    setLoading(true);
    try {
      const betPDA = new PublicKey(betAddress);
      await joinBet(betPDA, selectedBlock, parseFloat(depositAmount));
      setBetAddress("");
      setSelectedBlock(null);
      setDepositAmount("0.1");
      setBetData(null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h3 className="text-xl font-semibold mb-2">Connect Wallet</h3>
        <p className="text-gray-400">Connect your wallet to join a bet</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
          <span className="text-2xl">🎲</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Join Bet</h2>
          <p className="text-sm text-gray-400">Enter an existing battle</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Bet Address
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={betAddress}
              onChange={(e) => setBetAddress(e.target.value)}
              className="flex-1 px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
              placeholder="Bet PDA address (or create one first)"
            />
            <button
              onClick={handleLoadBet}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
            >
              Load
            </button>
          </div>
        </div>

        {betData && (
          <>
            <div className="bg-black/30 rounded-xl p-4 border border-gray-700">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Min Deposit</p>
                  <p className="text-white font-semibold">
                    {(betData.minDeposit.toNumber() / 1e9).toFixed(2)} SOL
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Total Pool</p>
                  <p className="text-white font-semibold">
                    {(betData.totalPool.toNumber() / 1e9).toFixed(2)} SOL
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Players</p>
                  <p className="text-white font-semibold">{betData.playerCount}/100</p>
                </div>
                <div>
                  <p className="text-gray-400">Status</p>
                  <p className="text-white font-semibold">
                    {Object.keys(betData.status)[0].toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Choose Your Block (1-25)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((block) => (
                  <button
                    key={block}
                    onClick={() => setSelectedBlock(block)}
                    className={`aspect-square rounded-xl font-bold text-lg transition-all ${
                      selectedBlock === block
                        ? "bg-gradient-to-br from-blue-500 to-purple-500 text-white scale-105 shadow-lg"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                    }`}
                  >
                    {block}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Deposit Amount (SOL)
              </label>
              <input
                type="number"
                step="0.01"
                min={betData.minDeposit.toNumber() / 1e9}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="0.1"
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={loading || selectedBlock === null}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/50"
            >
              {loading ? "Joining..." : selectedBlock ? `Join with Block ${selectedBlock}` : "Select a Block"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
