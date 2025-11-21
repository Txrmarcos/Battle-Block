"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useBlockBattle } from "@/lib/useBlockBattle";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "@/lib/anchor";
import toast from "react-hot-toast";

const TOTAL_BLOCKS = 25;

interface ActivePool {
  address: string;
  minDeposit: number;
  totalPool: number;
  playerCount: number;
  lockTime: number;
}

interface QuickPlayProps {
  betAddress?: string | null;
}

export default function QuickPlay({ betAddress }: QuickPlayProps) {
  console.log("🚀 QuickPlay component rendering", { betAddress });

  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const { joinBet, getBetData } = useBlockBattle();

  console.log("📊 QuickPlay state - connected:", connected, "publicKey:", publicKey?.toBase58());

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [activePool, setActivePool] = useState<ActivePool | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [myChosenBlock, setMyChosenBlock] = useState<number | null>(null);

  // Find the most popular open bet
  const findActivePool = async () => {
    console.log("🔍 Searching for active pools...");
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      console.log(`📦 Found ${accounts.length} total accounts`);

      let bestPool: ActivePool | null = null;
      const currentTime = Math.floor(Date.now() / 1000);

      for (const account of accounts) {
        try {
          const data = account.account.data;
          console.log(`📄 Account ${account.pubkey.toBase58()}, size: ${data.length}`);

          let offset = 8;

          // Skip creator
          offset += 32;
          // Skip arbiter
          offset += 32;

          const minDeposit = Number(data.readBigUInt64LE(offset));
          offset += 8;

          const totalPool = Number(data.readBigUInt64LE(offset));
          offset += 8;

          const lockTime = Number(data.readBigInt64LE(offset));
          offset += 8;

          // DEBUG: Print bytes around status/player_count area
          console.log(`   🔍 Bytes at offset ${offset}:`, Array.from(data.slice(offset, offset + 10)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));

          // winner_block is Option<u8> - check the discriminant
          const hasWinnerBlock = data.readUInt8(offset);
          offset += 1;
          if (hasWinnerBlock) {
            offset += 1; // skip the value
          }

          const status = data.readUInt8(offset);
          offset += 1;

          const playerCount = data.readUInt8(offset);

          console.log(`   Status: ${status}, LockTime: ${lockTime}, Current: ${currentTime}, Players: ${playerCount}`);

          // Find open bets that haven't locked yet with most players
          if (status === 0 && lockTime > currentTime && playerCount < 100) {
            console.log(`   ✅ Valid pool found!`);
            if (!bestPool || playerCount > bestPool.playerCount) {
              bestPool = {
                address: account.pubkey.toBase58(),
                minDeposit: minDeposit / 1e9,
                totalPool: totalPool / 1e9,
                playerCount,
                lockTime,
              };
            }
          } else {
            console.log(`   ❌ Not valid: status=${status}, locked=${lockTime <= currentTime}, full=${playerCount >= 100}`);
          }
        } catch (err) {
          console.error("Error parsing account:", err);
        }
      }

      console.log(`🎯 Best pool found:`, bestPool);
      setActivePool(bestPool);
      setSearching(false);
      return bestPool;
    } catch (error) {
      console.error("Error finding pool:", error);
      setSearching(false);
      return null;
    }
  };

  // Load specific bet from URL parameter
  const loadSpecificBet = async (address: string) => {
    console.log("🎯 Loading specific bet:", address);
    try {
      setSearching(true);
      const betPDA = new PublicKey(address);
      const betData = await getBetData(betPDA);

      if (!betData) {
        console.error("❌ Bet not found");
        toast.error("Bet not found");
        setSearching(false);
        return;
      }

      // Check if bet is open
      const status = Object.keys(betData.status)[0];
      if (status !== 'open') {
        console.error("❌ Bet is not open");
        toast.error("This bet is no longer accepting players");
        setSearching(false);
        return;
      }

      const pool: ActivePool = {
        address: address,
        minDeposit: betData.minDeposit.toNumber() / 1e9,
        totalPool: betData.totalPool.toNumber() / 1e9,
        playerCount: betData.playerCount,
        lockTime: betData.lockTime.toNumber(),
      };

      setActivePool(pool);
      console.log("✅ Loaded specific bet:", pool);

      // Check if user already joined this pool
      if (publicKey) {
        await checkIfJoined(address);
      }

      setSearching(false);
    } catch (error) {
      console.error("Error loading specific bet:", error);
      toast.error("Failed to load bet");
      setSearching(false);
    }
  };

  // Check if user already joined and get their chosen block
  const checkIfJoined = async (poolAddress: string) => {
    if (!publicKey) {
      console.log("❌ Cannot check if joined - no public key");
      return false;
    }

    try {
      console.log("🔍 Checking if user joined pool:", poolAddress);
      const betData = await getBetData(new PublicKey(poolAddress));

      if (!betData) {
        console.log("❌ No bet data found");
        return false;
      }

      console.log("📋 Bet data:", {
        players: betData.players.map((p: PublicKey) => p.toBase58()),
        chosenBlocks: betData.chosenBlocks,
        myKey: publicKey.toBase58()
      });

      // Find player index
      const playerIndex = betData.players.findIndex(
        (player: PublicKey) => player.toBase58() === publicKey.toBase58()
      );

      console.log("🔎 Player index:", playerIndex);

      if (playerIndex !== -1) {
        // User has joined - get their chosen block
        const chosenBlock = betData.chosenBlocks[playerIndex];
        setHasJoined(true);
        setMyChosenBlock(chosenBlock);
        console.log(`✅ You already joined this pool with block ${chosenBlock}`);
        return true;
      } else {
        setHasJoined(false);
        setMyChosenBlock(null);
        console.log("ℹ️ You haven't joined this pool yet");
        return false;
      }
    } catch (error) {
      console.error("❌ Error checking if joined:", error);
      return false;
    }
  };

  useEffect(() => {
    console.log("🎮 QuickPlay mounted, connected:", connected, "betAddress:", betAddress);

    if (betAddress) {
      // Load specific bet from URL
      loadSpecificBet(betAddress);
    } else if (connected) {
      // Find active pool normally
      findActivePool().catch(err => {
        console.error("❌ Error in findActivePool:", err);
        setSearching(false);
      });
      const interval = setInterval(() => {
        findActivePool().catch(err => console.error("❌ Interval error:", err));
      }, 10000);
      return () => clearInterval(interval);
    } else {
      setSearching(false);
    }
  }, [connected, betAddress]);

  useEffect(() => {
    if (activePool && publicKey) {
      console.log("🔄 Checking if user joined pool:", activePool.address);
      checkIfJoined(activePool.address);
    } else if (activePool && !publicKey) {
      console.log("⚠️ Pool loaded but wallet not connected - cannot check if joined");
    }
  }, [activePool, publicKey]);

  const handleQuickPlay = async () => {
    if (!activePool || selectedBlock === null || !publicKey) return;

    setLoading(true);
    try {
      const betPDA = new PublicKey(activePool.address);
      await joinBet(betPDA, selectedBlock, activePool.minDeposit);

      setHasJoined(true);
      toast.success("You're in! Good luck! 🎲");

      // Refresh pool data
      await findActivePool();
    } catch (error: any) {
      console.error("Error joining:", error);
      toast.error(error.message || "Failed to join");
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
        <div className="text-6xl mb-6">🎮</div>
        <h2 className="text-2xl font-bold text-white mb-3">Connect Wallet to Play</h2>
        <p className="text-[#A1A1AA] text-sm">
          Start betting on blocks in seconds
        </p>
      </div>
    );
  }

  if (searching) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-12 text-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#A1A1AA] text-sm">Searching for active pools...</p>
      </div>
    );
  }

  if (!activePool) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
        <div className="text-5xl mb-4">🎯</div>
        <h2 className="text-xl font-bold text-white mb-2">No Active Pools</h2>
        <p className="text-[#A1A1AA] text-sm mb-6">
          Be the first! Create a pool and start the game.
        </p>
        <button
          onClick={() => {
            const tabs = document.querySelectorAll('button');
            tabs.forEach(tab => {
              if (tab.textContent?.includes('Create')) {
                tab.click();
              }
            });
          }}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-purple-500/20"
        >
          Create Pool
        </button>
      </div>
    );
  }

  if (hasJoined) {
    const timeLeft = Math.max(0, activePool.lockTime - Math.floor(Date.now() / 1000));
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
      <div className="bg-white/[0.02] border border-green-500/30 rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">You're In!</h2>
          <p className="text-[#A1A1AA] text-sm">Good luck!</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-center">
            <p className="text-[#A1A1AA] text-xs mb-1 uppercase tracking-wide">Prize Pool</p>
            <p className="text-xl font-bold text-green-400">{activePool.totalPool.toFixed(2)} SOL</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-center">
            <p className="text-[#A1A1AA] text-xs mb-1 uppercase tracking-wide">Players</p>
            <p className="text-xl font-bold text-white">{activePool.playerCount}</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-center">
            <p className="text-[#A1A1AA] text-xs mb-1 uppercase tracking-wide">Time Left</p>
            <p className="text-xl font-bold text-white font-mono">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </p>
          </div>
        </div>

        <p className="text-center text-[#71717A] text-xs">
          Check "Manage" tab to claim if you win
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
      {/* Pool Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 text-center group hover:border-purple-500/30 transition-all">
          <p className="text-[#A1A1AA] text-xs mb-2 uppercase tracking-wide font-medium">Entry</p>
          <p className="text-2xl font-bold text-white">{activePool.minDeposit} SOL</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 text-center group hover:border-purple-500/30 transition-all">
          <p className="text-[#A1A1AA] text-xs mb-2 uppercase tracking-wide font-medium">Prize Pool</p>
          <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            {activePool.totalPool.toFixed(2)} SOL
          </p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 text-center group hover:border-purple-500/30 transition-all">
          <p className="text-[#A1A1AA] text-xs mb-2 uppercase tracking-wide font-medium">Players</p>
          <p className="text-2xl font-bold text-white">{activePool.playerCount}<span className="text-[#71717A]">/100</span></p>
        </div>
      </div>

      {/* Already Joined Message */}
      {hasJoined && myChosenBlock && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <p className="text-green-400 font-semibold text-center flex items-center justify-center gap-2">
            <span className="text-xl">✓</span>
            You already joined with Block {myChosenBlock}
          </p>
        </div>
      )}

      {/* Block Selection */}
      <div className="mb-8">
        <label className="block text-lg font-semibold text-white mb-6 text-center tracking-tight">
          {hasJoined ? "Your Chosen Block" : "Choose Your Block"}
        </label>
        <div className="grid grid-cols-5 gap-2.5">
          {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((block) => {
            const isMyBlock = hasJoined && block === myChosenBlock;
            const isSelected = selectedBlock === block;

            return (
              <button
                key={block}
                onClick={() => !hasJoined && setSelectedBlock(block)}
                disabled={hasJoined}
                className={`aspect-square rounded-xl font-bold text-lg transition-all ${
                  isMyBlock
                    ? "bg-gradient-to-br from-green-500 to-emerald-500 text-white scale-105 shadow-lg shadow-green-500/50 border-2 border-green-400 ring-2 ring-green-400/30"
                    : isSelected
                    ? "bg-gradient-to-br from-purple-500 to-cyan-500 text-white scale-105 shadow-lg shadow-purple-500/50 border border-purple-400/50"
                    : hasJoined
                    ? "bg-white/[0.02] text-[#52525B] border border-white/[0.04] cursor-not-allowed opacity-50"
                    : "bg-white/[0.03] hover:bg-white/[0.06] text-[#A1A1AA] hover:text-white border border-white/[0.06] hover:border-purple-500/30"
                }`}
              >
                {block}
              </button>
            );
          })}
        </div>
      </div>

      {/* Play Button */}
      {hasJoined ? (
        <div className="space-y-4">
          <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl text-center">
            <p className="text-[#A1A1AA] text-sm">
              Waiting for arbiter to reveal the winner...
            </p>
          </div>
          <p className="text-center text-[#71717A] text-xs">
            Winners will be able to claim their prizes after the reveal
          </p>
        </div>
      ) : (
        <>
          <button
            onClick={handleQuickPlay}
            disabled={loading || selectedBlock === null}
            className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-bold text-lg py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                Joining...
              </span>
            ) : selectedBlock ? (
              `Play Block ${selectedBlock}`
            ) : (
              "Select a Block"
            )}
          </button>

          <p className="text-center text-[#71717A] text-xs mt-6">
            Multiple winners split the prize pool proportionally
          </p>
        </>
      )}
    </div>
  );
}
