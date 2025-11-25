"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useBlockBattle } from "@/lib/useBlockBattle";
import { PROGRAM_ID } from "@/lib/anchor";
import { betsCache } from "@/lib/betsCache";
import { getExplorerUrl } from "@/lib/explorer";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

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
  claimTxHash?: string; // Transaction hash of the claim
  isAutomatic?: boolean; // true = automatic mode, false = arbiter mode
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);

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
          offset += 1;

          // bump(1)
          offset += 1;

          // is_automatic(1)
          const isAutomatic = data.readUInt8(offset) === 1;

          const statusStr = status === 0 ? 'open' : status === 1 ? 'revealed' : 'cancelled';

          pools.push({
            address: account.pubkey.toBase58(),
            totalPool: totalPool / 1e9,
            playerCount,
            status: statusStr,
            lockTime,
            winnerBlock,
            isAutomatic,
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

            // bump(1)
            offset += 1;

            // is_automatic(1)
            const isAutomatic = data.readUInt8(offset) === 1;
            offset += 1;

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
                isAutomatic,
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
      setShowDetailsModal(true);
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
      <div className="bg-gradient-to-br from-black to-gray-950 border-4 border-gray-800 p-16 text-center relative overflow-hidden" style={{clipPath: 'polygon(0 16px, 16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px))'}}>
        <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
        {/* Corner decorations */}
        <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-orange-900/30"></div>
        <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-orange-900/30"></div>
        <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-orange-900/30"></div>
        <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-orange-900/30"></div>
        <div className="relative z-10">
          <div className="text-6xl mb-4">💀</div>
          <h3 className="text-xl pixel-font mb-2 text-gray-100" style={{textShadow: "4px 4px 0px #000, 8px 8px 20px rgba(0, 0, 0, 0.8)"}}>CONNECT WALLET</h3>
          <p className="text-sm pixel-font text-gray-600">Connect to manage your dungeons of death</p>
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
          <div className="bg-gradient-to-br from-gray-900/90 to-black/90 border-4 border-gray-800  p-8 text-center" style={{clipPath: 'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))'}}>
            <div className="inline-block animate-spin h-16 w-16 border-b-4 border-gray-800 mb-4"></div>
            <p className="pixel-font text-gray-500 text-lg">Loading dungeon data...</p>
            <p className="pixel-font text-gray-500 text-xs mt-2">This may take a few seconds</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-gradient-to-br from-black to-gray-950 border-4 border-gray-800 p-8 relative overflow-hidden" style={{clipPath: 'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))'}}>
        <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
        {/* Corner decorations */}
        <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-orange-900/30"></div>
        <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-orange-900/30"></div>
        <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-orange-900/30"></div>
        <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-orange-900/30"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="inline-block mb-2">
                <span className="text-5xl filter drop-shadow-[0_0_20px_rgba(255,0,0,0.3)]">💀</span>
              </div>
              <h2 className="text-3xl pixel-font text-gray-100 mb-1"
                  style={{ textShadow: "4px 4px 0px #000, 8px 8px 20px rgba(0, 0, 0, 0.8)" }}>
                DUNGEON MASTER
              </h2>
              <p className="text-sm pixel-font text-gray-600">Manage your death traps & claim spoils</p>
            </div>
            <button
              onClick={manualRefresh}
              disabled={searchingPools || loading}
              className="px-4 py-2 bg-gradient-to-r from-gray-800 to-black hover:from-gray-700 hover:to-gray-900 text-white pixel-font text-xs transition-all border-2 border-gray-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{clipPath: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)'}}
            >
              {searchingPools ? "LOADING..." : "🔄 REFRESH"}
            </button>
          </div>
        </div>
      </div>

      {/* My Pools Grid */}
      <div className="bg-gradient-to-br from-black to-gray-950 border-4 border-gray-800/30  p-8 relative overflow-hidden" style={{clipPath: 'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))'}}>
        <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🏰</span>
            <h3 className="text-xl pixel-font text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-500">YOUR DUNGEONS</h3>
          </div>

          {searchingPools ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin  h-8 w-8 border-b-4 border-gray-800 mb-4"></div>
              <p className="pixel-font text-gray-500">Loading your dungeons...</p>
            </div>
          ) : myPools.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📭</div>
              <p className="pixel-font text-gray-500 mb-2">NO DUNGEONS CREATED</p>
              <p className="text-sm pixel-font text-gray-500">Forge one in the 🔨 tab!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myPools.map((pool) => (
                <button
                  key={pool.address}
                  onClick={() => loadPoolDetails(pool.address)}
                  disabled={loading}
                  className={`p-5  border-2 transition-all text-left relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedPool === pool.address
                      ? "bg-gradient-to-br from-orange-900/30 to-red-900/30 border-orange-700 shadow-lg shadow-orange-500/50"
                      : "bg-gradient-to-br from-gray-900/20 to-black/20 border-gray-800/30 hover:border-gray-800 hover:shadow-lg hover:shadow-gray-500/30"
                  }`}
                  style={{clipPath: 'polygon(0 10px, 10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px))'}}
                >
                  <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 pixel-font text-[10px] border-2 ${
                          pool.status === 'open' ? 'bg-gray-800/20 text-gray-400 border-gray-800/50' :
                          pool.status === 'revealed' ? 'bg-yellow-950/20 text-yellow-700 border-yellow-900/50' :
                          'bg-red-500/20 text-red-400 border-red-500/50'
                        }`} style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                          {pool.status.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 pixel-font text-[10px] border ${
                          pool.isAutomatic
                            ? 'bg-gray-800/20 text-gray-400 border-gray-700/50'
                            : 'bg-yellow-950/20 text-yellow-500 border-yellow-700/50'
                        }`} style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                          {pool.isAutomatic ? '⚡ AUTO' : '👑 ARBITER'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-black/30  p-3 border border-yellow-500/20" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                        <p className="text-xs pixel-font text-yellow-300 mb-1">💰 TOTAL POOL</p>
                        <p className="text-white pixel-font text-lg">
                          {pool.totalPool.toFixed(4)} SOL
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="bg-black/30 p-2 border border-gray-800/20 flex-1" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                          <p className="text-[10px] pixel-font text-gray-500">👥 PLAYERS</p>
                          <p className="text-white pixel-font text-sm">{pool.playerCount}</p>
                        </div>
                        {pool.winnerBlock && (
                          <div className="bg-black/30 p-2 border border-yellow-900/20 flex-1" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                            <p className="text-[10px] pixel-font text-yellow-700">🏆 WINNER</p>
                            <p className="text-white pixel-font text-sm">#{pool.winnerBlock}</p>
                          </div>
                        )}
                      </div>

                      {/* Lock Time / Arbiter Info */}
                      <div className={`bg-black/30 p-2 border ${pool.isAutomatic ? 'border-green-800/30' : 'border-yellow-700/30'}`} style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                        {pool.isAutomatic ? (
                          <>
                            <p className="text-[10px] pixel-font text-green-500">⏰ AUTO-REVEAL</p>
                            <p className="text-white pixel-font text-xs">
                              {pool.status === 'open' ? (
                                Date.now() / 1000 > pool.lockTime ? (
                                  <span className="text-green-400">Ready to reveal!</span>
                                ) : (
                                  new Date(pool.lockTime * 1000).toLocaleString()
                                )
                              ) : (
                                'Revealed'
                              )}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] pixel-font text-yellow-500">👑 ARBITER MODE</p>
                            <p className="text-white pixel-font text-xs">
                              {pool.status === 'open' ? 'Waiting for arbiter' : 'Revealed by arbiter'}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-800/30">
                      <p className="text-[10px] text-gray-500 font-mono truncate">
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
      <div className="bg-gradient-to-br from-black to-gray-950 border-4 border-orange-700/30  p-8 relative overflow-hidden" style={{clipPath: 'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))'}}>
        <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🎯</span>
            <h3 className="text-xl pixel-font text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">YOUR QUESTS</h3>
            <button
              onClick={() => findJoinedPools()}
              disabled={searchingPools}
              className="ml-auto px-3 py-1 bg-gray-700/20 hover:bg-gray-700/30 border border-orange-700/50 text-gray-500 pixel-font text-xs  transition-all disabled:opacity-50"
              style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}
            >
              {searchingPools ? "LOADING..." : "🔍 SEARCH"}
            </button>
          </div>

          {searchingPools ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin  h-8 w-8 border-b-4 border-orange-700 mb-4"></div>
              <p className="pixel-font text-gray-500">Loading your quests...</p>
            </div>
          ) : joinedPools.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🎯</div>
              <p className="pixel-font text-gray-500 mb-2">NO QUESTS FOUND</p>
              <p className="text-sm pixel-font text-gray-500">Click 🔍 SEARCH above to find your participated dungeons</p>
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
                    <div className="bg-gradient-to-br from-gray-900/30 to-black/30  p-4 border-2 border-gray-800/30" style={{clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))'}}>
                      <p className="text-[10px] pixel-font text-gray-400 mb-1">💎 TOTAL INVESTED</p>
                      <p className="text-white pixel-font text-lg">{totalInvested.toFixed(4)} SOL</p>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-950/30 to-orange-950/30  p-4 border-2 border-yellow-900/30" style={{clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))'}}>
                      <p className="text-[10px] pixel-font text-yellow-700 mb-1">💰 TOTAL WON</p>
                      <p className="text-white pixel-font text-lg">{totalWon.toFixed(4)} SOL</p>
                    </div>
                    <div className={`bg-gradient-to-br  p-4 border-2 ${
                      netProfit >= 0
                        ? 'from-yellow-900/30 to-orange-800/30 border-yellow-500/30'
                        : 'from-red-900/30 to-red-800/30 border-red-500/30'
                    }`} style={{clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))'}}>
                      <p className="text-[10px] pixel-font mb-1" style={{ color: netProfit >= 0 ? '#fcd34d' : '#f87171' }}>
                        {netProfit >= 0 ? '📈 NET PROFIT' : '📉 NET LOSS'}
                      </p>
                      <p className={`pixel-font text-lg ${netProfit >= 0 ? 'text-yellow-300' : 'text-red-300'}`}>
                        {netProfit >= 0 ? '+' : ''}{netProfit.toFixed(4)} SOL
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-900/30 to-black/30  p-4 border-2 border-gray-800/30" style={{clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))'}}>
                      <p className="text-[10px] pixel-font text-gray-500 mb-1">🎯 WIN RATE</p>
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
                    className={`p-5  border-2 transition-all relative overflow-hidden group ${
                      didWin
                        ? "bg-gradient-to-br from-yellow-950/30 to-orange-950/30 border-yellow-900 shadow-lg shadow-yellow-900/50"
                        : "bg-gradient-to-br from-gray-900/20 to-black/20 border-orange-700/30"
                    }`}
                    style={{clipPath: 'polygon(0 10px, 10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px))'}}
                  >
                    <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-3 py-1 pixel-font text-[10px] border-2 ${
                            pool.status === 'open' ? 'bg-gray-800/20 text-gray-400 border-gray-800/50' :
                            pool.status === 'revealed' ? 'bg-yellow-950/20 text-yellow-700 border-yellow-900/50' :
                            'bg-red-500/20 text-red-400 border-red-500/50'
                          }`} style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                            {pool.status.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 pixel-font text-[10px] border ${
                            pool.isAutomatic
                              ? 'bg-gray-800/20 text-gray-400 border-gray-700/50'
                              : 'bg-yellow-950/20 text-yellow-500 border-yellow-700/50'
                          }`} style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                            {pool.isAutomatic ? '⚡ AUTO' : '👑 ARBITER'}
                          </span>
                        </div>
                        {didWin && (
                          <span className="px-3 py-1 pixel-font text-[10px] bg-yellow-500/30 text-yellow-300 border-2 border-yellow-500 shadow-lg animate-pulse" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                            🏆 VICTORY
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        {/* Investment & Winnings Row */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-black/30  p-3 border border-blue-500/30" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                            <p className="text-xs pixel-font text-blue-300 mb-1">💎 INVESTED</p>
                            <p className="text-white pixel-font text-lg">
                              {pool.myDeposit?.toFixed(4) || '0.0000'} SOL
                            </p>
                          </div>
                          {didWin && (
                            <div className="bg-black/30  p-3 border border-yellow-500/30" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                              <p className="text-xs pixel-font text-yellow-300 mb-1">💰 WINNINGS</p>
                              <p className="text-white pixel-font text-lg">
                                {pool.totalPool.toFixed(4)} SOL
                              </p>
                            </div>
                          )}
                          {!didWin && (
                            <div className="bg-black/30  p-3 border border-red-500/20" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                              <p className="text-xs pixel-font text-red-400 mb-1">😢 LOST</p>
                              <p className="text-red-300 pixel-font text-lg">
                                -{pool.myDeposit?.toFixed(4) || '0.0000'} SOL
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="bg-black/30  p-3 border border-orange-700/30 flex-1 text-center" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                            <p className="text-[10px] pixel-font text-gray-500 mb-1">🚪 YOUR DOOR</p>
                            <p className="text-orange-500 pixel-font text-2xl font-bold">{pool.myChosenBlock}</p>
                          </div>
                          {pool.winnerBlock && (
                            <div className={`bg-black/30  p-3 border flex-1 text-center ${
                              didWin ? 'border-green-500/50' : 'border-red-500/30'
                            }`} style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
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

                        <div className="bg-black/30 p-2 border border-gray-800/20" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                          <p className="text-[10px] pixel-font text-gray-500">👥 ADVENTURERS: <span className="text-white">{pool.playerCount}</span></p>
                        </div>

                        {/* Lock Time / Arbiter Info for joined pools */}
                        {pool.status === 'open' && (
                          <div className={`bg-black/30 p-2 border ${pool.isAutomatic ? 'border-green-800/30' : 'border-yellow-700/30'}`} style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                            {pool.isAutomatic ? (
                              <p className="text-[10px] pixel-font text-green-500">
                                ⏰ AUTO-REVEAL: {Date.now() / 1000 > pool.lockTime ? (
                                  <span className="text-green-400">Ready!</span>
                                ) : (
                                  <span className="text-white">{new Date(pool.lockTime * 1000).toLocaleString()}</span>
                                )}
                              </p>
                            ) : (
                              <p className="text-[10px] pixel-font text-yellow-500">
                                👑 ARBITER MODE: <span className="text-white">Waiting for arbiter to reveal</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {didWin && !pool.alreadyClaimed && (
                        <button
                          onClick={async () => {
                            try {
                              setLoading(true);
                              const betPDA = new PublicKey(pool.address);
                              const txHash = await claimWinnings(betPDA);

                              // Update pool with claim tx hash and mark as claimed
                              setJoinedPools(prev => prev.map(p =>
                                p.address === pool.address
                                  ? { ...p, alreadyClaimed: true, claimTxHash: txHash }
                                  : p
                              ));

                              toast.success("Treasure claimed! 🎉");
                            } catch (error: any) {
                              console.error(error);
                              // Check if error is because already claimed
                              if (error?.message?.includes("already") || error?.message?.includes("claimed")) {
                                toast.error("Already claimed!");
                                // Mark as claimed without tx hash
                                setJoinedPools(prev => prev.map(p =>
                                  p.address === pool.address
                                    ? { ...p, alreadyClaimed: true }
                                    : p
                                ));
                              }
                            } finally {
                              setLoading(false);
                            }
                          }}
                          disabled={loading}
                          className="w-full mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white pixel-font text-sm py-3 px-6  transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-4 border-green-400"
                          style={{clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))'}}
                        >
                          {loading ? "CLAIMING..." : "💰 CLAIM TREASURE 💰"}
                        </button>
                      )}

                      {didWin && pool.alreadyClaimed && (
                        <div className="w-full mt-4 space-y-2">
                          <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 text-green-300 pixel-font  p-4 text-center border-2 border-green-500/50" style={{clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))'}}>
                            <p className="text-sm mb-2">✅ TREASURE CLAIMED</p>
                            <p className="text-xs text-green-400">
                              You won <span className="font-bold text-yellow-300">{pool.totalPool.toFixed(4)} SOL</span>!
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              Profit: +{(pool.totalPool - (pool.myDeposit || 0)).toFixed(4)} SOL
                            </p>
                          </div>
                          {pool.claimTxHash && (
                            <button
                              onClick={() => window.open(getExplorerUrl(pool.claimTxHash!), "_blank")}
                              className="w-full bg-black/50 hover:bg-black/70 border-2 border-orange-700/50 hover:border-orange-700 text-gray-500 hover:text-white pixel-font text-xs py-2 px-4  transition-all flex items-center justify-center gap-2"
                              style={{clipPath: 'polygon(0 6px, 6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px))'}}
                            >
                              🔍 VIEW CLAIM TRANSACTION
                            </button>
                          )}
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-orange-700/30">
                        <p className="text-[10px] text-gray-500 font-mono truncate">
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

      {/* Dungeon Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedPool && poolDetails && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Overlay */}
            <motion.div
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setShowDetailsModal(false)}
            />

            {/* Modal Content */}
            <motion.div
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 100 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
              <div className="bg-gradient-to-br from-black to-gray-950 border-4 border-gray-800 p-8 relative overflow-hidden" style={{clipPath: 'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))'}}>
                <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
                {/* Corner decorations */}
                <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-orange-900/30"></div>
                <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-orange-900/30"></div>
                <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-orange-900/30"></div>
                <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-orange-900/30"></div>

                {/* Close Button */}
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center bg-red-900/50 hover:bg-red-900 border-2 border-red-500 text-red-300 hover:text-white transition-all"
                  style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}
                >
                  ✕
                </button>

                <div className="relative z-10">
            <div className="mb-6 text-center">
              <div className="inline-block mb-2">
                <span className="text-5xl filter drop-shadow-[0_0_20px_rgba(255,0,0,0.3)]">💀</span>
              </div>
              <h3 className="text-2xl pixel-font text-gray-100 mb-2"
                  style={{ textShadow: "4px 4px 0px #000, 8px 8px 20px rgba(0, 0, 0, 0.8)" }}>
                DUNGEON DETAILS
              </h3>
              <p className="text-[10px] text-gray-600 font-mono">{selectedPool}</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20  p-6 border-2 border-yellow-500/30 mb-6" style={{clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))'}}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/30  p-3 border border-yellow-500/20 text-center" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                  <p className="text-[10px] pixel-font text-yellow-300 mb-1">💰 POOL</p>
                  <p className="text-white pixel-font text-sm">
                    {(poolDetails.totalPool.toNumber() / 1e9).toFixed(4)}
                  </p>
                </div>
                <div className="bg-black/30  p-3 border border-gray-800/20 text-center" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                  <p className="text-[10px] pixel-font text-gray-500 mb-1">👥 PLAYERS</p>
                  <p className="text-white pixel-font text-sm">{poolDetails.playerCount}</p>
                </div>
                <div className="bg-black/30  p-3 border border-orange-700/20 text-center" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                  <p className="text-[10px] pixel-font text-gray-500 mb-1">🎫 ENTRY</p>
                  <p className="text-white pixel-font text-sm">
                    {(poolDetails.minDeposit.toNumber() / 1e9).toFixed(4)}
                  </p>
                </div>
                <div className="bg-black/30  p-3 border border-gray-800/20 text-center" style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                  <p className="text-[10px] pixel-font text-gray-400 mb-1">📊 STATUS</p>
                  <span className={`inline-block px-2 py-1 pixel-font text-[10px] border ${
                    status === 'open' ? 'bg-gray-800/20 text-gray-400 border-gray-800/50' :
                    status === 'revealed' ? 'bg-yellow-950/20 text-yellow-700 border-yellow-900/50' :
                    'bg-red-500/20 text-red-400 border-red-500/50'
                  }`} style={{clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'}}>
                    {status?.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Mode and Lock Time Info */}
              <div className={`mt-4 p-4 border-2 ${poolDetails.isAutomatic ? 'bg-gray-900/30 border-gray-700/50' : 'bg-yellow-950/30 border-yellow-700/50'}`} style={{clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))'}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{poolDetails.isAutomatic ? '⚡' : '👑'}</span>
                    <div>
                      <p className={`pixel-font text-sm font-bold ${poolDetails.isAutomatic ? 'text-gray-300' : 'text-yellow-400'}`}>
                        {poolDetails.isAutomatic ? 'AUTOMATIC MODE' : 'ARBITER MODE'}
                      </p>
                      <p className="text-[10px] pixel-font text-gray-500">
                        {poolDetails.isAutomatic ? 'Winner revealed automatically after timer' : 'Arbiter reveals the winner manually'}
                      </p>
                    </div>
                  </div>
                  {poolDetails.isAutomatic && status === 'open' && (
                    <div className="text-right">
                      <p className="text-[10px] pixel-font text-gray-500">⏰ REVEAL TIME</p>
                      {Date.now() / 1000 > poolDetails.lockTime.toNumber() ? (
                        <p className="pixel-font text-sm text-green-400">Ready to reveal!</p>
                      ) : (
                        <p className="pixel-font text-sm text-white">
                          {new Date(poolDetails.lockTime.toNumber() * 1000).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                  {!poolDetails.isAutomatic && status === 'open' && (
                    <div className="text-right">
                      <p className="text-[10px] pixel-font text-yellow-500">👑 ARBITER</p>
                      <p className="pixel-font text-[10px] text-white font-mono">
                        {poolDetails.arbiter.toBase58().slice(0, 8)}...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Arbiter: Reveal Winner */}
            {isArbiter && status === 'open' && (
              <div className="space-y-4">
                <div className="bg-yellow-950/20 border-2 border-yellow-900  p-4 mb-4 text-center" style={{clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))'}}>
                  <span className="text-2xl">👑</span>
                  <p className="text-yellow-700 pixel-font text-sm mt-2">YOU ARE THE DUNGEON MASTER</p>
                  <p className="text-yellow-600 pixel-font text-xs mt-1">CHOOSE THE TREASURE DOOR</p>
                </div>

                <label className="block text-sm pixel-font text-yellow-300 mb-3 text-center">
                  🗝️ SELECT WINNING DOOR 🗝️
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((block) => (
                    <button
                      key={block}
                      onClick={() => setWinningBlock(block)}
                      className={`aspect-square  pixel-font text-lg transition-all border-2 ${
                        winningBlock === block
                          ? "bg-gradient-to-br from-yellow-500 to-orange-500 text-white scale-105 shadow-lg shadow-yellow-500/50 border-yellow-400"
                          : "bg-black/50 hover:bg-gray-900/50 text-gray-500 hover:text-white border-gray-800/30 hover:border-gray-800"
                      }`}
                      style={{clipPath: 'polygon(0 6px, 6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px))'}}
                    >
                      {block}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleReveal}
                  disabled={loading || winningBlock === null || poolDetails.playerCount < 2}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white pixel-font text-lg py-4 px-6  transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-4 border-yellow-400"
                  style={{clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))'}}
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
              <div className="bg-gradient-to-br from-yellow-950/20 to-orange-950/20 border-2 border-yellow-900  p-6 text-center" style={{clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))'}}>
                <div className="text-5xl mb-3">🎉</div>
                <p className="text-yellow-600 pixel-font text-xl mb-2">
                  TREASURE REVEALED!
                </p>
                <p className="text-yellow-700 pixel-font text-2xl mb-3">
                  DOOR {poolDetails.winnerBlock}
                </p>
                <p className="text-sm pixel-font text-gray-500">
                  Winners claim in ⚔️ PLAY tab
                </p>
              </div>
            )}

            {/* Cancel Bet */}
            {status === 'open' && (
              <button
                onClick={handleCancel}
                disabled={loading}
                className="w-full bg-black/50 hover:bg-red-900/30 border-2 border-red-500/30 hover:border-red-500 text-red-400 hover:text-red-300 pixel-font text-sm py-3 px-6  transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                style={{clipPath: 'polygon(0 6px, 6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px))'}}
              >
                {loading ? "CANCELLING..." : "❌ CANCEL DUNGEON"}
              </button>
            )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
