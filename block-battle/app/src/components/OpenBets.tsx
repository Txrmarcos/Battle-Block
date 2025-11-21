"use client";

import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PROGRAM_ID } from "@/lib/anchor";
import { PublicKey } from "@solana/web3.js";
import toast from "react-hot-toast";

interface OpenBet {
  address: string;
  creator: string;
  minDeposit: number;
  totalPool: number;
  playerCount: number;
  lockTime: number;
  isAutomatic: boolean;
}

export default function OpenBets() {
  const { connection } = useConnection();
  const [bets, setBets] = useState<OpenBet[]>([]);
  const [loading, setLoading] = useState(false);

  const loadOpenBets = async () => {
    setLoading(true);
    try {
      // Get all program accounts (bets)
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            // Filter for accounts with discriminator for BetAccount
            dataSize: 8 + 32 + 32 + 8 + 8 + 8 + 2 + 1 + 1 + 1 + 4 + (32 * 100) + 4 + 100 + 4 + (8 * 100) + 4 + 100,
          },
        ],
      });

      const openBets: OpenBet[] = [];

      for (const account of accounts) {
        try {
          // Parse account data (simplified - you'd use Anchor deserialization in production)
          const data = account.account.data;

          // Skip discriminator (8 bytes)
          let offset = 8;

          // Read creator (32 bytes)
          const creator = new PublicKey(data.slice(offset, offset + 32));
          offset += 32;

          // Skip arbiter (32 bytes)
          offset += 32;

          // Read min_deposit (8 bytes)
          const minDeposit = Number(data.readBigUInt64LE(offset));
          offset += 8;

          // Read total_pool (8 bytes)
          const totalPool = Number(data.readBigUInt64LE(offset));
          offset += 8;

          // Read lock_time (8 bytes)
          const lockTime = Number(data.readBigInt64LE(offset));
          offset += 8;

          // winner_block is Option<u8> - check discriminant
          const hasWinnerBlock = data.readUInt8(offset);
          offset += 1;
          if (hasWinnerBlock) {
            offset += 1; // skip the value
          }

          // Read status (1 byte)
          const status = data.readUInt8(offset);
          offset += 1;

          // Read player_count (1 byte)
          const playerCount = data.readUInt8(offset);
          offset += 1;

          // Skip bump (1 byte)
          offset += 1;

          // Read is_automatic (1 byte)
          const isAutomatic = data.readUInt8(offset) === 1;

          // Only show open bets (status = 0)
          if (status === 0) {
            openBets.push({
              address: account.pubkey.toBase58(),
              creator: creator.toBase58(),
              minDeposit: minDeposit / 1e9, // Convert to SOL
              totalPool: totalPool / 1e9,
              playerCount,
              lockTime,
              isAutomatic,
            });
          }
        } catch (err) {
          console.error("Error parsing bet account:", err);
        }
      }

      // Sort by newest first
      openBets.sort((a, b) => b.lockTime - a.lockTime);

      setBets(openBets);
      toast.success(`Found ${openBets.length} open bets!`);
    } catch (error) {
      console.error("Error loading bets:", error);
      toast.error("Failed to load open bets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpenBets();
  }, []);

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
    <div className="bg-gradient-to-br from-[#0f0f1e] to-[#1a1a2e] border-4 border-purple-500/30 rounded-2xl p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="text-center flex-1">
            <div className="inline-block mb-2">
              <span className="text-5xl">🗺️</span>
            </div>
            <h2 className="text-3xl pixel-font text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mb-1"
                style={{ textShadow: "3px 3px 0px #000" }}>
              ACTIVE DUNGEONS
            </h2>
            <p className="text-sm pixel-font text-purple-300">Choose your quest</p>
          </div>
          <button
            onClick={loadOpenBets}
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white pixel-font text-xs rounded-lg transition-all disabled:opacity-50 shadow-lg border-2 border-purple-400"
          >
            {loading ? "LOADING..." : "🔄 REFRESH"}
          </button>
        </div>

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
          <div className="space-y-3">
            {bets.map((bet) => (
              <div
                key={bet.address}
                className="bg-gradient-to-br from-purple-900/20 to-cyan-900/20 rounded-xl p-5 border-2 border-purple-500/30 hover:border-cyan-500/50 transition-all group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{bet.isAutomatic ? "⚡" : "👑"}</span>
                      <div>
                        <p className="text-xs font-mono text-purple-300">
                          {bet.address.slice(0, 8)}...{bet.address.slice(-8)}
                        </p>
                        <span className={`text-[10px] pixel-font ${bet.isAutomatic ? 'text-cyan-400' : 'text-yellow-400'}`}>
                          {bet.isAutomatic ? 'AUTO' : 'ARBITER'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyShareLink(bet.address)}
                        className="px-3 py-1.5 bg-black/50 hover:bg-black/70 border-2 border-purple-500/50 text-purple-300 pixel-font text-[10px] rounded-lg transition-all"
                      >
                        📋 COPY
                      </button>
                      <button
                        onClick={() => joinBet(bet.address)}
                        className="px-4 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white pixel-font text-[10px] rounded-lg transition-all shadow-lg border-2 border-green-400"
                      >
                        ⚔️ ENTER
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-xs">
                    <div className="bg-black/30 rounded-lg p-2 border border-purple-500/20">
                      <p className="text-purple-300 mb-1 pixel-font text-[10px]">💰 ENTRY</p>
                      <p className="text-white pixel-font text-sm">{bet.minDeposit.toFixed(2)}</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2 border border-cyan-500/20">
                      <p className="text-cyan-300 mb-1 pixel-font text-[10px]">🏆 POOL</p>
                      <p className="text-white pixel-font text-sm">{bet.totalPool.toFixed(2)}</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2 border border-yellow-500/20">
                      <p className="text-yellow-300 mb-1 pixel-font text-[10px]">👥 PLAYERS</p>
                      <p className="text-white pixel-font text-sm">{bet.playerCount}<span className="text-purple-300">/100</span></p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2 border border-green-500/20">
                      <p className="text-green-300 mb-1 pixel-font text-[10px]">
                        {bet.isAutomatic ? "⚡ AUTO" : "⏰ LOCK"}
                      </p>
                      <p className="text-white pixel-font text-sm">
                        {new Date(bet.lockTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
