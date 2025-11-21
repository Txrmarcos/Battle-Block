"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useBlockBattle } from "@/lib/useBlockBattle";
import { PROGRAM_ID } from "@/lib/anchor";
import { betsCache } from "@/lib/betsCache";
import toast from "react-hot-toast";

const TOTAL_BLOCKS = 25;

interface PoolInfo {
  address: string;
  totalPool: number;
  playerCount: number;
  status: string;
  lockTime: number;
  winnerBlock?: number;
  myChosenBlock?: number;
  alreadyClaimed?: boolean;
  myDeposit?: number; // How much the user invested
}

export default function ManageBet() {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const { revealWinner, cancelBet, getBetData, claimWinnings } = useBlockBattle();

  const [loading, setLoading] = useState(false);
  const [searchingPools, setSearchingPools] = useState(false);
  const [myPools, setMyPools] = useState<PoolInfo[]>([]);
  const [joinedPools, setJoinedPools] = useState<PoolInfo[]>([]);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [poolDetails, setPoolDetails] = useState<any>(null);
  const [winningBlock, setWinningBlock] = useState<number | null>(null);

  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  // Find all pools created by the connected user
  const findMyPools = useCallback(async (forceRefresh = false) => {
    if (!publicKey) return;

    const walletAddress = publicKey.toBase58();

    // Check cache first
    if (!forceRefresh) {
      const cachedPools = betsCache.getMyPools(walletAddress);
      if (cachedPools) {
        setMyPools(cachedPools);
        return;
      }
    }

    // Check if already loading
    if (betsCache.isLoading(`myPools-${walletAddress}`)) {
      console.log("⏸️ Already loading pools, skipping...");
      return;
    }

    console.log("🔍 Searching for pools created by:", walletAddress);
    setSearchingPools(true);

    try {
      const pools = await betsCache.dedupeRequest(`myPools-${walletAddress}`, async () => {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 8, // After discriminator
              bytes: publicKey.toBase58(),
            },
          },
        ],
      });

      console.log(`📦 Found ${accounts.length} pools created by you`);

      const pools: PoolInfo[] = [];

      for (const account of accounts) {
        try {
          const data = account.account.data;

          // Parse bytes directly - NO extra RPC calls!
          // Account structure (from Rust):
          // discriminator(8) + creator(32) + arbiter(32) + min_deposit(8) +
          // total_pool(8) + lock_time(8) + winner_block(Option<u8>) +
          // status(1) + player_count(1) + bump(1) + is_automatic(1) + ...

          let offset = 8 + 32 + 32 + 8; // Skip to total_pool

          const totalPool = Number(data.readBigUInt64LE(offset));
          offset += 8;

          const lockTime = Number(data.readBigInt64LE(offset));
          offset += 8;

          // winner_block: Option<u8>
          const hasWinnerBlock = data.readUInt8(offset);
          offset += 1;
          let winnerBlock: number | undefined;
          if (hasWinnerBlock === 1) {
            winnerBlock = data.readUInt8(offset);
            offset += 1;
          }

          const status = data.readUInt8(offset);
          offset += 1;

          const playerCount = data.readUInt8(offset);

          const statusStr = status === 0 ? 'open' : status === 1 ? 'revealed' : 'cancelled';

          pools.push({
            address: account.pubkey.toBase58(),
            totalPool: totalPool / 1e9,
            playerCount,
            status: statusStr,
            lockTime,
            winnerBlock,
          });
        } catch (err) {
          console.error("Error parsing pool:", account.pubkey.toBase58(), err);
        }
      }

        // Sort by status (open first) then by player count
        pools.sort((a, b) => {
          if (a.status === 'open' && b.status !== 'open') return -1;
          if (a.status !== 'open' && b.status === 'open') return 1;
          return b.playerCount - a.playerCount;
        });

        return pools;
      });

      // Update cache
      betsCache.setMyPools(walletAddress, pools);
      setMyPools(pools);
      console.log("✅ Loaded pools:", pools);
    } catch (error) {
      console.error("Error finding pools:", error);
      toast.error("Failed to load your pools");
    } finally {
      setSearchingPools(false);
    }
  }, [publicKey, connection]);

  // Find all pools where user participated as a player
  const findJoinedPools = useCallback(async () => {
    if (!publicKey) return;

    // Check if already searching
    if (betsCache.isLoading(`joinedPools-${publicKey.toBase58()}`)) {
      console.log("⏸️ Already searching for joined pools...");
      return;
    }

    console.log("🔍 Searching for pools where you participated...");
    setSearchingPools(true);

    try {
      const joined = await betsCache.dedupeRequest(`joinedPools-${publicKey.toBase58()}`, async () => {
        // Get all bet accounts - NO dataSlice, we need full data
        const accounts = await connection.getProgramAccounts(PROGRAM_ID);

        console.log(`📦 Found ${accounts.length} total pools`);

        const foundPools: PoolInfo[] = [];

        // Limit to last 20 accounts (most recent)
        const MAX_ACCOUNTS = 20;
        const accountsToCheck = accounts.slice(-MAX_ACCOUNTS);

        // Process in small batches to avoid blocking
        const BATCH_SIZE = 5;
        for (let i = 0; i < accountsToCheck.length; i += BATCH_SIZE) {
          const batch = accountsToCheck.slice(i, i + BATCH_SIZE);

          // Give browser time to breathe
          await new Promise(resolve => setTimeout(resolve, 0));

          for (const account of batch) {
            try {
              const data = account.account.data;

            // Parse bytes directly
            let offset = 8 + 32 + 32 + 8; // Skip to total_pool

            const totalPool = Number(data.readBigUInt64LE(offset));
            offset += 8;

            const lockTime = Number(data.readBigInt64LE(offset));
            offset += 8;

            // winner_block: Option<u8>
            const hasWinnerBlock = data.readUInt8(offset);
            offset += 1;
            let winnerBlock: number | undefined;
            if (hasWinnerBlock === 1) {
              winnerBlock = data.readUInt8(offset);
              offset += 1;
            }

            const status = data.readUInt8(offset);
            offset += 1;

            const playerCount = data.readUInt8(offset);
            offset += 1;

            // Skip bump(1) + is_automatic(1)
            offset += 2;

            if (playerCount === 0) continue;

            // Read players Vec
            const playersVecLen = data.readUInt32LE(offset);
            offset += 4;

            let playerIndex = -1;
            const myPubkeyStr = publicKey.toBase58();

            // Check if user is in this pool
            for (let j = 0; j < Math.min(playersVecLen, 100); j++) {
              const playerPubkey = new PublicKey(data.subarray(offset, offset + 32));
              if (playerPubkey.toBase58() === myPubkeyStr) {
                playerIndex = j;
                break;
              }
              offset += 32;
            }

            if (playerIndex !== -1) {
              // Calculate offset to chosen_blocks Vec
              offset = 8 + 32 + 32 + 8 + 8 + 8 + (hasWinnerBlock ? 2 : 1) + 1 + 1 + 1 + 1 + 4 + (32 * playersVecLen) + 4;

              // Read chosen_blocks Vec
              const block = data.readUInt8(offset + playerIndex);

              // Move to deposits Vec (after chosen_blocks)
              offset += playersVecLen; // skip chosen_blocks
              offset += 4; // skip deposits Vec length (u32)

              // Read my deposit (u64 = 8 bytes)
              let myDeposit = 0;
              try {
                myDeposit = Number(data.readBigUInt64LE(offset + (playerIndex * 8))) / 1e9;
              } catch (err) {
                myDeposit = 0;
              }

              // Move to claimed Vec (after deposits)
              offset += playersVecLen * 8; // skip all deposits (each is 8 bytes)
              offset += 4; // skip claimed Vec length (u32)

              // Read if this player already claimed
              let alreadyClaimed = false;
              try {
                alreadyClaimed = data.readUInt8(offset + playerIndex) === 1;
              } catch (err) {
                // If can't read, assume not claimed
                alreadyClaimed = false;
              }

              const statusStr = status === 0 ? 'open' : status === 1 ? 'revealed' : 'cancelled';

              foundPools.push({
                address: account.pubkey.toBase58(),
                totalPool: totalPool / 1e9,
                playerCount,
                status: statusStr,
                lockTime,
                winnerBlock,
                myChosenBlock: block,
                myDeposit,
                alreadyClaimed,
              });

              console.log(`✅ Found pool - Block ${block}, Invested: ${myDeposit} SOL, Claimed: ${alreadyClaimed}`);
            }
            } catch (err) {
              // Silently skip errored pools
            }
          }
        }

        // Sort: revealed first, then by pool size
        foundPools.sort((a, b) => {
          if (a.status === 'revealed' && b.status !== 'revealed') return -1;
          if (a.status !== 'revealed' && b.status === 'revealed') return 1;
          return b.totalPool - a.totalPool;
        });

        console.log(`✅ You participated in ${foundPools.length} pools`);
        return foundPools;
      });

      setJoinedPools(joined);
    } catch (error) {
      console.error("Error finding joined pools:", error);
      toast.error("Failed to load joined pools");
    } finally {
      setSearchingPools(false);
    }
  }, [publicKey, connection]);

  // Load detailed data for selected pool
  const loadPoolDetails = async (address: string) => {
    if (loading || searchingPools) {
      console.log("⏸️ Skipping loadPoolDetails - already loading");
      return;
    }

    console.log("🔍 Loading pool details for:", address);
    setLoading(true);

    // Safety timeout to force loading to false after 20 seconds
    const safetyTimeout = setTimeout(() => {
      console.error("🚨 SAFETY TIMEOUT: Forcing loading to false after 20s");
      setLoading(false);
      toast.error("Request timed out. Please try again.");
    }, 20000);

    try {
      const betPDA = new PublicKey(address);

      // Create timeout wrapper
      const timeoutMs = 15000; // 15 seconds max
      const fetchWithTimeout = Promise.race([
        getBetData(betPDA),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs/1000}s`)), timeoutMs)
        )
      ]) as Promise<any>;

      const data = await fetchWithTimeout;

      if (!data) {
        throw new Error("Pool data not found or fetch failed");
      }

      console.log("✅ Pool details loaded successfully");
      setPoolDetails(data);
      setSelectedPool(address);
      clearTimeout(safetyTimeout);
    } catch (error: any) {
      console.error("❌ Error loading pool details:", error.message || error);
      toast.error(`Failed to load pool: ${error.message || "Unknown error"}`);
      setSelectedPool(null);
      setPoolDetails(null);
      clearTimeout(safetyTimeout);
    } finally {
      clearTimeout(safetyTimeout);
      setLoading(false);
      console.log("✅ Loading state reset");
    }
  };

  const handleReveal = async () => {
    if (!selectedPool || winningBlock === null) return;

    setLoading(true);
    try {
      const betPDA = new PublicKey(selectedPool);
      await revealWinner(betPDA, winningBlock);
      await loadPoolDetails(selectedPool);
      await findMyPools(); // Refresh list
      setWinningBlock(null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedPool) return;

    setLoading(true);
    try {
      const betPDA = new PublicKey(selectedPool);
      await cancelBet(betPDA);
      setSelectedPool(null);
      setPoolDetails(null);
      await findMyPools(); // Refresh list
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = useCallback(async () => {
    if (isLoadingRef.current) {
      console.log("⏸️ Already loading, skipping refresh");
      return;
    }

    console.log("🔄 Refreshing all pools...");
    isLoadingRef.current = true;
    setSearchingPools(true);
    try {
      // Only load "My Pools" for now - joined pools is too heavy
      await findMyPools();
      // TODO: Optimize joined pools search or make it on-demand
      hasLoadedRef.current = true;
    } finally {
      setSearchingPools(false);
      isLoadingRef.current = false;
    }
  }, [findMyPools]);

  const manualRefresh = useCallback(async () => {
    console.log("🔄 Manual refresh triggered");
    hasLoadedRef.current = false; // Allow manual refresh
    await refreshAll();
  }, [refreshAll]);

  // Initialize from cache on mount
  useEffect(() => {
    if (connected && publicKey) {
      const cachedPools = betsCache.getMyPools(publicKey.toBase58());
      if (cachedPools) {
        console.log("📦 Loading pools from cache");
        setMyPools(cachedPools);
        hasLoadedRef.current = true;
      }
    }
  }, [connected, publicKey]);

  useEffect(() => {
    if (connected && publicKey && !hasLoadedRef.current && !isLoadingRef.current) {
      console.log("🚀 Initial load of pools");
      refreshAll();
    } else if (!connected || !publicKey) {
      console.log("👋 Wallet disconnected, clearing data");
      setMyPools([]);
      setJoinedPools([]);
      setSelectedPool(null);
      setPoolDetails(null);
      hasLoadedRef.current = false;
      isLoadingRef.current = false;
    }
  }, [connected, publicKey, refreshAll]);

  if (!connected) {
    return (
      <div className="bg-gradient-to-br from-[#0f0f1e] to-[#1a1a2e] border-4 border-purple-500/30 rounded-2xl p-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
        <div className="relative z-10">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-xl pixel-font mb-2 text-purple-300">CONNECT WALLET</h3>
          <p className="text-sm pixel-font text-cyan-300">Connect to manage your dungeons</p>
        </div>
      </div>
    );
  }

  const status = poolDetails ? Object.keys(poolDetails.status)[0] : null;
  const isArbiter = poolDetails && publicKey && poolDetails.arbiter.toBase58() === publicKey.toBase58();

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-gradient-to-br from-purple-900/90 to-cyan-900/90 border-4 border-purple-500 rounded-2xl p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500 mb-4"></div>
            <p className="pixel-font text-purple-300 text-lg">Loading dungeon data...</p>
            <p className="pixel-font text-cyan-300 text-xs mt-2">This may take a few seconds</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0f0f1e] to-[#1a1a2e] border-4 border-purple-500/30 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="inline-block mb-2">
                <span className="text-5xl">👑</span>
              </div>
              <h2 className="text-3xl pixel-font text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mb-1"
                  style={{ textShadow: "3px 3px 0px #000" }}>
                DUNGEON MASTER
              </h2>
              <p className="text-sm pixel-font text-purple-300">Manage your quests & reveal treasures</p>
            </div>
            <button
              onClick={manualRefresh}
              disabled={searchingPools || loading}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white pixel-font text-xs rounded-xl transition-all border-2 border-purple-400 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searchingPools ? "LOADING..." : "🔄 REFRESH"}
            </button>
          </div>
        </div>
      </div>

      {/* My Pools Grid */}
      <div className="bg-gradient-to-br from-[#0f0f1e] to-[#1a1a2e] border-4 border-purple-500/30 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🏰</span>
            <h3 className="text-xl pixel-font text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">YOUR DUNGEONS</h3>
          </div>

          {searchingPools ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-4 border-purple-500 mb-4"></div>
              <p className="pixel-font text-purple-300">Loading your dungeons...</p>
            </div>
          ) : myPools.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📭</div>
              <p className="pixel-font text-purple-300 mb-2">NO DUNGEONS CREATED</p>
              <p className="text-sm pixel-font text-cyan-300">Forge one in the 🔨 tab!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myPools.map((pool) => (
                <button
                  key={pool.address}
                  onClick={() => loadPoolDetails(pool.address)}
                  disabled={loading}
                  className={`p-5 rounded-xl border-2 transition-all text-left relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedPool === pool.address
                      ? "bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border-cyan-500 shadow-lg shadow-cyan-500/50"
                      : "bg-gradient-to-br from-purple-900/20 to-cyan-900/20 border-purple-500/30 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/30"
                  }`}
                >
                  <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`px-3 py-1 rounded-full pixel-font text-[10px] border-2 ${
                        pool.status === 'open' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' :
                        pool.status === 'revealed' ? 'bg-green-500/20 text-green-400 border-green-500/50' :
                        'bg-red-500/20 text-red-400 border-red-500/50'
                      }`}>
                        {pool.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-black/30 rounded-lg p-3 border border-yellow-500/20">
                        <p className="text-xs pixel-font text-yellow-300 mb-1">💰 TOTAL POOL</p>
                        <p className="text-white pixel-font text-lg">
                          {pool.totalPool.toFixed(4)} SOL
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="bg-black/30 rounded-lg p-2 border border-purple-500/20 flex-1">
                          <p className="text-[10px] pixel-font text-purple-300">👥 PLAYERS</p>
                          <p className="text-white pixel-font text-sm">{pool.playerCount}</p>
                        </div>
                        {pool.winnerBlock && (
                          <div className="bg-black/30 rounded-lg p-2 border border-green-500/20 flex-1">
                            <p className="text-[10px] pixel-font text-green-300">🏆 WINNER</p>
                            <p className="text-white pixel-font text-sm">#{pool.winnerBlock}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-purple-500/30">
                      <p className="text-[10px] text-purple-300 font-mono truncate">
                        {pool.address.slice(0, 8)}...{pool.address.slice(-8)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Joined Pools Grid - Now using cache! */}
      <div className="bg-gradient-to-br from-[#0f0f1e] to-[#1a1a2e] border-4 border-cyan-500/30 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🎯</span>
            <h3 className="text-xl pixel-font text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">YOUR QUESTS</h3>
            <button
              onClick={() => findJoinedPools()}
              disabled={searchingPools}
              className="ml-auto px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 pixel-font text-xs rounded-lg transition-all disabled:opacity-50"
            >
              {searchingPools ? "LOADING..." : "🔍 SEARCH"}
            </button>
          </div>

          {searchingPools ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-4 border-cyan-500 mb-4"></div>
              <p className="pixel-font text-cyan-300">Loading your quests...</p>
            </div>
          ) : joinedPools.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🎯</div>
              <p className="pixel-font text-cyan-300 mb-2">NO QUESTS FOUND</p>
              <p className="text-sm pixel-font text-purple-300">Click 🔍 SEARCH above to find your participated dungeons</p>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              {(() => {
                const totalInvested = joinedPools.reduce((sum, p) => sum + (p.myDeposit || 0), 0);
                const totalWon = joinedPools
                  .filter(p => p.status === 'revealed' && p.winnerBlock === p.myChosenBlock && p.alreadyClaimed)
                  .reduce((sum, p) => sum + p.totalPool, 0);
                const netProfit = totalWon - totalInvested;
                const wins = joinedPools.filter(p => p.status === 'revealed' && p.winnerBlock === p.myChosenBlock).length;
                const losses = joinedPools.filter(p => p.status === 'revealed' && p.winnerBlock !== p.myChosenBlock).length;

                return (
                  <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 rounded-xl p-4 border-2 border-blue-500/30">
                      <p className="text-[10px] pixel-font text-blue-300 mb-1">💎 TOTAL INVESTED</p>
                      <p className="text-white pixel-font text-lg">{totalInvested.toFixed(4)} SOL</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-900/30 to-emerald-800/30 rounded-xl p-4 border-2 border-green-500/30">
                      <p className="text-[10px] pixel-font text-green-300 mb-1">💰 TOTAL WON</p>
                      <p className="text-white pixel-font text-lg">{totalWon.toFixed(4)} SOL</p>
                    </div>
                    <div className={`bg-gradient-to-br rounded-xl p-4 border-2 ${
                      netProfit >= 0
                        ? 'from-yellow-900/30 to-orange-800/30 border-yellow-500/30'
                        : 'from-red-900/30 to-red-800/30 border-red-500/30'
                    }`}>
                      <p className="text-[10px] pixel-font mb-1" style={{ color: netProfit >= 0 ? '#fcd34d' : '#f87171' }}>
                        {netProfit >= 0 ? '📈 NET PROFIT' : '📉 NET LOSS'}
                      </p>
                      <p className={`pixel-font text-lg ${netProfit >= 0 ? 'text-yellow-300' : 'text-red-300'}`}>
                        {netProfit >= 0 ? '+' : ''}{netProfit.toFixed(4)} SOL
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 rounded-xl p-4 border-2 border-purple-500/30">
                      <p className="text-[10px] pixel-font text-purple-300 mb-1">🎯 WIN RATE</p>
                      <p className="text-white pixel-font text-lg">
                        {wins}/{wins + losses}
                        {wins + losses > 0 && <span className="text-sm ml-1">({((wins / (wins + losses)) * 100).toFixed(0)}%)</span>}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Pool Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {joinedPools.map((pool) => {
                const didWin = pool.status === 'revealed' && pool.winnerBlock === pool.myChosenBlock;

                return (
                  <div
                    key={pool.address}
                    className={`p-5 rounded-xl border-2 transition-all relative overflow-hidden group ${
                      didWin
                        ? "bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-green-500 shadow-lg shadow-green-500/50"
                        : "bg-gradient-to-br from-cyan-900/20 to-purple-900/20 border-cyan-500/30"
                    }`}
                  >
                    <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-3">
                        <span className={`px-3 py-1 rounded-full pixel-font text-[10px] border-2 ${
                          pool.status === 'open' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' :
                          pool.status === 'revealed' ? 'bg-green-500/20 text-green-400 border-green-500/50' :
                          'bg-red-500/20 text-red-400 border-red-500/50'
                        }`}>
                          {pool.status.toUpperCase()}
                        </span>
                        {didWin && (
                          <span className="px-3 py-1 rounded-full pixel-font text-[10px] bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500 shadow-lg animate-pulse">
                            🏆 VICTORY
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        {/* Investment & Winnings Row */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-black/30 rounded-lg p-3 border border-blue-500/30">
                            <p className="text-xs pixel-font text-blue-300 mb-1">💎 INVESTED</p>
                            <p className="text-white pixel-font text-lg">
                              {pool.myDeposit?.toFixed(4) || '0.0000'} SOL
                            </p>
                          </div>
                          {didWin && (
                            <div className="bg-black/30 rounded-lg p-3 border border-yellow-500/30">
                              <p className="text-xs pixel-font text-yellow-300 mb-1">💰 WINNINGS</p>
                              <p className="text-white pixel-font text-lg">
                                {pool.totalPool.toFixed(4)} SOL
                              </p>
                            </div>
                          )}
                          {!didWin && (
                            <div className="bg-black/30 rounded-lg p-3 border border-red-500/20">
                              <p className="text-xs pixel-font text-red-400 mb-1">😢 LOST</p>
                              <p className="text-red-300 pixel-font text-lg">
                                -{pool.myDeposit?.toFixed(4) || '0.0000'} SOL
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="bg-black/30 rounded-lg p-3 border border-cyan-500/30 flex-1 text-center">
                            <p className="text-[10px] pixel-font text-cyan-300 mb-1">🚪 YOUR DOOR</p>
                            <p className="text-cyan-400 pixel-font text-2xl font-bold">{pool.myChosenBlock}</p>
                          </div>
                          {pool.winnerBlock && (
                            <div className={`bg-black/30 rounded-lg p-3 border flex-1 text-center ${
                              didWin ? 'border-green-500/50' : 'border-red-500/30'
                            }`}>
                              <p className="text-[10px] pixel-font mb-1" style={{ color: didWin ? '#4ade80' : '#f87171' }}>
                                {didWin ? '🏆 WINNER' : '❌ WINNER'}
                              </p>
                              <p className={`pixel-font text-2xl font-bold ${
                                didWin ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {pool.winnerBlock}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="bg-black/30 rounded-lg p-2 border border-purple-500/20">
                          <p className="text-[10px] pixel-font text-purple-300">👥 ADVENTURERS: <span className="text-white">{pool.playerCount}</span></p>
                        </div>
                      </div>

                      {didWin && !pool.alreadyClaimed && (
                        <button
                          onClick={async () => {
                            try {
                              setLoading(true);
                              const betPDA = new PublicKey(pool.address);
                              await claimWinnings(betPDA);

                              // Remove this pool from the list after successful claim
                              setJoinedPools(prev => prev.filter(p => p.address !== pool.address));

                              toast.success("Treasure claimed! 🎉");
                            } catch (error: any) {
                              console.error(error);
                              // Check if error is because already claimed
                              if (error?.message?.includes("already") || error?.message?.includes("claimed")) {
                                toast.error("Already claimed!");
                                // Remove from list anyway
                                setJoinedPools(prev => prev.filter(p => p.address !== pool.address));
                              }
                            } finally {
                              setLoading(false);
                            }
                          }}
                          disabled={loading}
                          className="w-full mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white pixel-font text-sm py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-4 border-green-400"
                        >
                          {loading ? "CLAIMING..." : "💰 CLAIM TREASURE 💰"}
                        </button>
                      )}

                      {didWin && pool.alreadyClaimed && (
                        <div className="w-full mt-4 bg-gradient-to-r from-green-900/50 to-emerald-900/50 text-green-300 pixel-font rounded-xl p-4 text-center border-2 border-green-500/50">
                          <p className="text-sm mb-2">✅ TREASURE CLAIMED</p>
                          <p className="text-xs text-green-400">
                            You won <span className="font-bold text-yellow-300">{pool.totalPool.toFixed(4)} SOL</span>!
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            Profit: +{(pool.totalPool - (pool.myDeposit || 0)).toFixed(4)} SOL
                          </p>
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-cyan-500/30">
                        <p className="text-[10px] text-cyan-300 font-mono truncate">
                          {pool.address.slice(0, 8)}...{pool.address.slice(-8)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
      </div>

      {/* Selected Pool Details */}
      {selectedPool && poolDetails && (
        <div className="bg-gradient-to-br from-[#0f0f1e] to-[#1a1a2e] border-4 border-yellow-500/30 rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
          <div className="relative z-10">
            <div className="mb-6 text-center">
              <div className="inline-block mb-2">
                <span className="text-5xl">📜</span>
              </div>
              <h3 className="text-2xl pixel-font text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 mb-2"
                  style={{ textShadow: "3px 3px 0px #000" }}>
                DUNGEON SCROLL
              </h3>
              <p className="text-[10px] text-yellow-300 font-mono">{selectedPool}</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 rounded-xl p-6 border-2 border-yellow-500/30 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/30 rounded-lg p-3 border border-yellow-500/20 text-center">
                  <p className="text-[10px] pixel-font text-yellow-300 mb-1">💰 POOL</p>
                  <p className="text-white pixel-font text-sm">
                    {(poolDetails.totalPool.toNumber() / 1e9).toFixed(4)}
                  </p>
                </div>
                <div className="bg-black/30 rounded-lg p-3 border border-purple-500/20 text-center">
                  <p className="text-[10px] pixel-font text-purple-300 mb-1">👥 PLAYERS</p>
                  <p className="text-white pixel-font text-sm">{poolDetails.playerCount}</p>
                </div>
                <div className="bg-black/30 rounded-lg p-3 border border-cyan-500/20 text-center">
                  <p className="text-[10px] pixel-font text-cyan-300 mb-1">🎫 ENTRY</p>
                  <p className="text-white pixel-font text-sm">
                    {(poolDetails.minDeposit.toNumber() / 1e9).toFixed(4)}
                  </p>
                </div>
                <div className="bg-black/30 rounded-lg p-3 border border-green-500/20 text-center">
                  <p className="text-[10px] pixel-font text-green-300 mb-1">📊 STATUS</p>
                  <span className={`inline-block px-2 py-1 rounded pixel-font text-[10px] border ${
                    status === 'open' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' :
                    status === 'revealed' ? 'bg-green-500/20 text-green-400 border-green-500/50' :
                    'bg-red-500/20 text-red-400 border-red-500/50'
                  }`}>
                    {status?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Arbiter: Reveal Winner */}
            {isArbiter && status === 'open' && (
              <div className="space-y-4">
                <div className="bg-green-500/20 border-2 border-green-500 rounded-xl p-4 mb-4 text-center">
                  <span className="text-2xl">👑</span>
                  <p className="text-green-300 pixel-font text-sm mt-2">YOU ARE THE DUNGEON MASTER</p>
                  <p className="text-green-400 pixel-font text-xs mt-1">CHOOSE THE TREASURE DOOR</p>
                </div>

                <label className="block text-sm pixel-font text-yellow-300 mb-3 text-center">
                  🗝️ SELECT WINNING DOOR 🗝️
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((block) => (
                    <button
                      key={block}
                      onClick={() => setWinningBlock(block)}
                      className={`aspect-square rounded-xl pixel-font text-lg transition-all border-2 ${
                        winningBlock === block
                          ? "bg-gradient-to-br from-yellow-500 to-orange-500 text-white scale-105 shadow-lg shadow-yellow-500/50 border-yellow-400"
                          : "bg-black/50 hover:bg-purple-900/50 text-purple-300 hover:text-white border-purple-500/30 hover:border-purple-500"
                      }`}
                    >
                      {block}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleReveal}
                  disabled={loading || winningBlock === null || poolDetails.playerCount < 2}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white pixel-font text-lg py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-4 border-yellow-400"
                >
                  {loading ? "REVEALING..." : winningBlock ? `⚡ REVEAL DOOR ${winningBlock} ⚡` : "SELECT A DOOR"}
                </button>
                {poolDetails.playerCount < 2 && (
                  <p className="text-sm pixel-font text-red-400 text-center animate-pulse">⚠️ NEED 2+ PLAYERS TO REVEAL</p>
                )}
              </div>
            )}

            {/* Status Messages */}
            {status === 'revealed' && (
              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500 rounded-xl p-6 text-center">
                <div className="text-5xl mb-3">🎉</div>
                <p className="text-green-300 pixel-font text-xl mb-2">
                  TREASURE REVEALED!
                </p>
                <p className="text-green-400 pixel-font text-2xl mb-3">
                  DOOR {poolDetails.winnerBlock}
                </p>
                <p className="text-sm pixel-font text-cyan-300">
                  Winners claim in ⚔️ PLAY tab
                </p>
              </div>
            )}

            {/* Cancel Bet */}
            {status === 'open' && (
              <button
                onClick={handleCancel}
                disabled={loading}
                className="w-full bg-black/50 hover:bg-red-900/30 border-2 border-red-500/30 hover:border-red-500 text-red-400 hover:text-red-300 pixel-font text-sm py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {loading ? "CANCELLING..." : "❌ CANCEL DUNGEON"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
