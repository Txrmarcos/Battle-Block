"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useBlockBattle } from "@/lib/useBlockBattle";
import { PROGRAM_ID } from "@/lib/anchor";
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
  hasClaimed?: boolean;
  isAutomatic?: boolean;
}

export default function ManageBet() {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const { revealWinner, autoRevealWinner, cancelBet, getBetData, claimWinnings } = useBlockBattle();

  const [loading, setLoading] = useState(false);
  const [searchingPools, setSearchingPools] = useState(false);
  const [myPools, setMyPools] = useState<PoolInfo[]>([]);
  const [joinedPools, setJoinedPools] = useState<PoolInfo[]>([]);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [poolDetails, setPoolDetails] = useState<any>(null);
  const [winningBlock, setWinningBlock] = useState<number | null>(null);

  // Find all pools created by the connected user
  const findMyPools = async () => {
    if (!publicKey) return;

    console.log("🔍 Searching for pools created by:", publicKey.toBase58());
    setSearchingPools(true);

    try {
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
      const currentTime = Math.floor(Date.now() / 1000);

      for (const account of accounts) {
        try {
          const data = account.account.data;
          let offset = 8;

          // Skip creator
          offset += 32;
          // Skip arbiter
          offset += 32;

          // Skip min_deposit
          offset += 8;

          const totalPool = Number(data.readBigUInt64LE(offset));
          offset += 8;

          const lockTime = Number(data.readBigInt64LE(offset));
          offset += 8;

          // winner_block is Option<u8>
          const hasWinnerBlock = data.readUInt8(offset);
          offset += 1;
          let winnerBlock: number | undefined;
          if (hasWinnerBlock) {
            winnerBlock = data.readUInt8(offset);
            offset += 1;
          }

          const status = data.readUInt8(offset);
          offset += 1;

          const playerCount = data.readUInt8(offset);
          offset += 1;

          // Skip bump
          offset += 1;

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
          console.error("Error parsing pool:", err);
        }
      }

      // Sort by status (open first) then by player count
      pools.sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return b.playerCount - a.playerCount;
      });

      setMyPools(pools);
      console.log("✅ Loaded pools:", pools);
    } catch (error) {
      console.error("Error finding pools:", error);
      toast.error("Failed to load your pools");
    } finally {
      setSearchingPools(false);
    }
  };

  // Find all pools where user participated as a player
  const findJoinedPools = async () => {
    if (!publicKey) return;

    console.log("🔍 Searching for pools where you participated...");
    setSearchingPools(true);

    try {
      // Get all bet accounts
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      console.log(`📦 Found ${accounts.length} total pools`);

      const joined: PoolInfo[] = [];

      for (const account of accounts) {
        try {
          const betData = await getBetData(account.pubkey);

          // Check if user is in players array
          const playerIndex = betData.players.findIndex(
            (player: PublicKey) => player.toBase58() === publicKey.toBase58()
          );

          if (playerIndex !== -1) {
            // User is a player in this pool
            const myBlock = betData.chosenBlocks[playerIndex];
            const status = Object.keys(betData.status)[0];
            const hasClaimed = betData.claimed[playerIndex];

            joined.push({
              address: account.pubkey.toBase58(),
              totalPool: betData.totalPool.toNumber() / 1e9,
              playerCount: betData.playerCount,
              status,
              lockTime: betData.lockTime.toNumber(),
              winnerBlock: betData.winnerBlock,
              myChosenBlock: myBlock,
              hasClaimed,
            });

            console.log(`✅ Found pool ${account.pubkey.toBase58().slice(0, 8)}... - You chose block ${myBlock} - Claimed: ${hasClaimed}`);
          }
        } catch (err) {
          console.error("Error parsing joined pool:", err);
        }
      }

      // Sort: revealed first (so user can see if they won), then by pool size
      joined.sort((a, b) => {
        if (a.status === 'revealed' && b.status !== 'revealed') return -1;
        if (a.status !== 'revealed' && b.status === 'revealed') return 1;
        return b.totalPool - a.totalPool;
      });

      setJoinedPools(joined);
      console.log(`✅ You participated in ${joined.length} pools`);
    } catch (error) {
      console.error("Error finding joined pools:", error);
      toast.error("Failed to load joined pools");
    } finally {
      setSearchingPools(false);
    }
  };

  // Load detailed data for selected pool
  const loadPoolDetails = async (address: string) => {
    try {
      setLoading(true);
      const betPDA = new PublicKey(address);
      const data = await getBetData(betPDA);
      setPoolDetails(data);
      setSelectedPool(address);
    } catch (error) {
      console.error("Error loading pool details:", error);
      toast.error("Failed to load pool details");
    } finally {
      setLoading(false);
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

  const handleAutoReveal = async () => {
    if (!selectedPool) return;

    setLoading(true);
    try {
      const betPDA = new PublicKey(selectedPool);
      await autoRevealWinner(betPDA);
      await loadPoolDetails(selectedPool);
      await findMyPools(); // Refresh list
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

  const refreshAll = async () => {
    await Promise.all([findMyPools(), findJoinedPools()]);
  };

  useEffect(() => {
    if (connected && publicKey) {
      refreshAll();
    } else {
      setMyPools([]);
      setJoinedPools([]);
      setSelectedPool(null);
      setPoolDetails(null);
    }
  }, [connected, publicKey]);

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
    <div className="space-y-8">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        {/* Atmospheric glow */}
        <div className="absolute -inset-2 bg-gradient-to-r from-purple-600/30 via-yellow-600/30 to-purple-600/30 rounded-[2.5rem] blur-3xl" />

        <div className="relative bg-gradient-to-br from-[#0a0a15] via-[#15152a] to-[#0a0a15] rounded-[2.5rem] p-10 overflow-hidden border-2 border-yellow-500/40 shadow-[inset_0_2px_20px_rgba(0,0,0,0.8),0_0_40px_rgba(234,179,8,0.15)]">
          {/* Texture overlay */}
          <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-[0.08] mix-blend-overlay" />

          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(10)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-yellow-400/30 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -40, 0],
                  opacity: [0, 0.8, 0],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="text-7xl"
                animate={{
                  rotate: [0, -5, 5, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                👑
              </motion.div>
              <div>
                <motion.h2
                  className="text-4xl md:text-5xl pixel-font mb-2"
                  style={{
                    background: "linear-gradient(135deg, #eab308 0%, #f59e0b 50%, #eab308 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 0 20px rgba(234, 179, 8, 0.5))",
                  }}
                >
                  DUNGEON MASTER
                </motion.h2>
                <p className="text-sm pixel-font text-purple-300/80">Command your realm & reveal treasures</p>
              </div>
            </div>

            <motion.button
              onClick={refreshAll}
              disabled={searchingPools}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white pixel-font text-xs rounded-2xl transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(168,85,247,0.3)] border-2 border-purple-400/50 disabled:cursor-not-allowed"
            >
              {searchingPools ? "LOADING..." : "🔄 REFRESH"}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* My Pools Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <div className="absolute -inset-1 bg-gradient-to-b from-purple-600/20 via-cyan-600/20 to-purple-600/20 rounded-[2rem] blur-2xl" />

        <div className="relative bg-gradient-to-br from-[#08080f]/95 via-[#0f0f1a]/95 to-[#08080f]/95 rounded-[2rem] p-8 border-2 border-purple-500/30 shadow-[inset_0_4px_30px_rgba(0,0,0,0.9),0_0_50px_rgba(139,92,246,0.1)] backdrop-blur-sm">
          <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-[0.04]" />

          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <motion.span
                className="text-4xl"
                animate={{
                  rotate: [0, -5, 5, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                🏰
              </motion.span>
              <h3 className="text-2xl pixel-font" style={{
                background: "linear-gradient(135deg, #a78bfa 0%, #06b6d4 50%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 15px rgba(167, 139, 250, 0.4))",
              }}>
                YOUR DUNGEONS
              </h3>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myPools.map((pool, index) => (
                <motion.button
                  key={pool.address}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => loadPoolDetails(pool.address)}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative group"
                >
                  {/* Hover glow */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600/0 via-cyan-600/0 to-purple-600/0 group-hover:from-purple-600/40 group-hover:via-cyan-600/40 group-hover:to-purple-600/40 rounded-[1.5rem] blur-lg transition-all duration-500" />

                  {/* Card content */}
                  <div className={`relative bg-gradient-to-br from-[#0a0a15]/90 via-[#12121f]/90 to-[#0a0a15]/90 rounded-[1.5rem] p-6 border-2 transition-all duration-300 backdrop-blur-sm shadow-[inset_0_1px_10px_rgba(0,0,0,0.8),0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden text-left ${
                    selectedPool === pool.address
                      ? "border-cyan-500/60 shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                      : "border-purple-500/30 group-hover:border-cyan-500/50"
                  }`}>
                    {/* Texture */}
                    <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" />

                    {/* Animated shimmer */}
                    <motion.div
                      className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-purple-500/5 to-transparent"
                      animate={{
                        x: ['-200%', '200%'],
                      }}
                      transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "linear",
                        repeatDelay: 4,
                      }}
                    />

                    <div className="relative z-10">
                      {/* Status badge */}
                      <div className="flex items-start justify-between mb-4">
                        <motion.span
                          className={`px-4 py-1.5 rounded-full pixel-font text-[10px] border-2 font-bold ${
                            pool.status === 'open' ? 'bg-blue-500/20 text-blue-300 border-blue-500/50' :
                            pool.status === 'revealed' ? 'bg-green-500/20 text-green-300 border-green-500/50' :
                            'bg-red-500/20 text-red-300 border-red-500/50'
                          }`}
                          animate={{ scale: pool.status === 'open' ? [1, 1.05, 1] : 1 }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          {pool.status.toUpperCase()}
                        </motion.span>

                        {pool.isAutomatic !== undefined && (
                          <span className={`text-2xl ${pool.isAutomatic ? '' : ''}`}>
                            {pool.isAutomatic ? '⚡' : '👑'}
                          </span>
                        )}
                      </div>

                      {/* Pool amount - prominent */}
                      <div className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 rounded-2xl p-4 border-2 border-yellow-500/30 mb-4 shadow-lg">
                        <p className="text-xs pixel-font text-yellow-400/80 mb-1">💰 TOTAL POOL</p>
                        <p className="text-white pixel-font text-xl font-bold">
                          {pool.totalPool.toFixed(4)} SOL
                        </p>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex-1 bg-black/40 rounded-xl p-3 border border-purple-500/20">
                          <p className="text-[9px] pixel-font text-purple-400 mb-0.5">👥 PLAYERS</p>
                          <p className="text-white pixel-font text-sm font-bold">{pool.playerCount}</p>
                        </div>
                        {pool.winnerBlock && (
                          <div className="flex-1 bg-black/40 rounded-xl p-3 border border-green-500/30">
                            <p className="text-[9px] pixel-font text-green-400 mb-0.5">🏆 WINNER</p>
                            <p className="text-green-300 pixel-font text-sm font-bold">#{pool.winnerBlock}</p>
                          </div>
                        )}
                      </div>

                      {/* Address */}
                      <div className="pt-3 border-t border-purple-500/20">
                        <p className="text-[9px] text-purple-400/70 font-mono truncate">
                          {pool.address.slice(0, 8)}...{pool.address.slice(-8)}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
      </motion.div>

      {/* Joined Pools Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative"
      >
        <div className="absolute -inset-1 bg-gradient-to-b from-cyan-600/20 via-emerald-600/20 to-cyan-600/20 rounded-[2rem] blur-2xl" />

        <div className="relative bg-gradient-to-br from-[#08080f]/95 via-[#0f0f1a]/95 to-[#08080f]/95 rounded-[2rem] p-8 border-2 border-cyan-500/30 shadow-[inset_0_4px_30px_rgba(0,0,0,0.9),0_0_50px_rgba(6,182,212,0.1)] backdrop-blur-sm">
          <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-[0.04]" />

          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <motion.span
                className="text-4xl"
                animate={{
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                🎯
              </motion.span>
              <h3 className="text-2xl pixel-font" style={{
                background: "linear-gradient(135deg, #06b6d4 0%, #10b981 50%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 15px rgba(6, 182, 212, 0.4))",
              }}>
                YOUR QUESTS
              </h3>
            </div>

          {searchingPools ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-4 border-cyan-500 mb-4"></div>
              <p className="pixel-font text-cyan-300">Loading your quests...</p>
            </div>
          ) : joinedPools.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🗺️</div>
              <p className="pixel-font text-cyan-300 mb-2">NO QUESTS JOINED</p>
              <p className="text-sm pixel-font text-purple-300">Browse dungeons in the 🗺️ tab!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {joinedPools.map((pool, index) => {
                const didWin = pool.status === 'revealed' && pool.winnerBlock === pool.myChosenBlock;

                return (
                  <motion.div
                    key={pool.address}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    className="relative group"
                  >
                    {/* Victory glow */}
                    {didWin && (
                      <motion.div
                        className="absolute -inset-1 bg-gradient-to-r from-green-500/50 via-emerald-500/50 to-green-500/50 rounded-[1.5rem] blur-lg"
                        animate={{
                          opacity: [0.5, 0.8, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    )}

                    {/* Card content */}
                    <div className={`relative bg-gradient-to-br from-[#0a0a15]/90 via-[#12121f]/90 to-[#0a0a15]/90 rounded-[1.5rem] p-6 border-2 transition-all duration-300 backdrop-blur-sm shadow-[inset_0_1px_10px_rgba(0,0,0,0.8),0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden ${
                      didWin
                        ? "border-green-500/60 shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                        : "border-cyan-500/30 group-hover:border-cyan-500/50"
                    }`}>
                      {/* Texture */}
                      <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" />

                      {/* Victory shine */}
                      {didWin && (
                        <motion.div
                          className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-green-400/10 to-transparent"
                          animate={{
                            x: ['-200%', '200%'],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "linear",
                            repeatDelay: 1,
                          }}
                        />
                      )}

                      <div className="relative z-10">
                        {/* Status badges */}
                        <div className="flex items-start justify-between mb-4">
                          <motion.span
                            className={`px-4 py-1.5 rounded-full pixel-font text-[10px] border-2 font-bold ${
                              pool.status === 'open' ? 'bg-blue-500/20 text-blue-300 border-blue-500/50' :
                              pool.status === 'revealed' ? 'bg-green-500/20 text-green-300 border-green-500/50' :
                              'bg-red-500/20 text-red-300 border-red-500/50'
                            }`}
                            animate={{ scale: pool.status === 'revealed' ? [1, 1.05, 1] : 1 }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            {pool.status.toUpperCase()}
                          </motion.span>
                          {didWin && (
                            <motion.span
                              className="px-3 py-1.5 rounded-full pixel-font text-[10px] bg-gradient-to-r from-yellow-500/30 to-orange-500/30 text-yellow-200 border-2 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.5)] font-bold"
                              animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              🏆 VICTORY
                            </motion.span>
                          )}
                        </div>

                        {/* Prize pool - prominent */}
                        <div className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 rounded-2xl p-4 border-2 border-yellow-500/30 mb-4 shadow-lg">
                          <p className="text-xs pixel-font text-yellow-400/80 mb-1">💰 PRIZE POOL</p>
                          <p className="text-white pixel-font text-xl font-bold">
                            {pool.totalPool.toFixed(4)} SOL
                          </p>
                        </div>

                        {/* Door comparison */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1 bg-gradient-to-br from-cyan-600/20 to-blue-600/20 rounded-2xl p-3 border-2 border-cyan-500/40 text-center shadow-lg">
                            <p className="text-[9px] pixel-font text-cyan-400 mb-1">🚪 YOUR DOOR</p>
                            <p className="text-cyan-300 pixel-font text-3xl font-bold">{pool.myChosenBlock}</p>
                          </div>
                          {pool.winnerBlock && (
                            <>
                              <motion.div
                                className="text-2xl"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                              >
                                {didWin ? '✨' : '💔'}
                              </motion.div>
                              <div className={`flex-1 bg-gradient-to-br rounded-2xl p-3 border-2 text-center shadow-lg ${
                                didWin
                                  ? 'from-green-600/20 to-emerald-600/20 border-green-500/40'
                                  : 'from-red-600/20 to-orange-600/20 border-red-500/40'
                              }`}>
                                <p className={`text-[9px] pixel-font mb-1 ${didWin ? 'text-green-400' : 'text-red-400'}`}>
                                  {didWin ? '🏆 WINNER' : '❌ WINNER'}
                                </p>
                                <p className={`pixel-font text-3xl font-bold ${
                                  didWin ? 'text-green-300' : 'text-red-400'
                                }`}>
                                  {pool.winnerBlock}
                                </p>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Player count badge */}
                        <div className="bg-black/40 rounded-xl p-2 border border-purple-500/20 mb-3 text-center">
                          <p className="text-[10px] pixel-font text-purple-400">
                            👥 <span className="text-white font-bold">{pool.playerCount}</span> ADVENTURERS
                          </p>
                        </div>

                        {/* Claim section */}
                        {didWin && (
                          pool.hasClaimed ? (
                            <motion.div
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="bg-gradient-to-r from-gray-700/50 to-gray-600/50 text-gray-300 pixel-font text-sm py-3 rounded-2xl border-2 border-gray-500/50 text-center"
                            >
                              ✅ TREASURE CLAIMED
                            </motion.div>
                          ) : (
                            <motion.button
                              onClick={async () => {
                                try {
                                  setLoading(true);
                                  const betPDA = new PublicKey(pool.address);
                                  await claimWinnings(betPDA);
                                  await refreshAll();
                                  toast.success("Treasure claimed! 🎉");
                                } catch (error) {
                                  console.error(error);
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              disabled={loading}
                              whileHover={{ scale: 1.02, y: -2 }}
                              whileTap={{ scale: 0.98 }}
                              className="relative w-full py-4 rounded-2xl pixel-font text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
                            >
                              {/* Animated gradient */}
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-600 to-green-600"
                                animate={{
                                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                                }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                style={{ backgroundSize: '200% 200%' }}
                              />
                              {/* Border */}
                              <div className="absolute inset-0 rounded-2xl border-3 border-green-400/60 shadow-[0_0_30px_rgba(16,185,129,0.4)]" />
                              {/* Content */}
                              <span className="relative z-10 text-white font-bold flex items-center justify-center gap-2">
                                {loading ? "CLAIMING..." : "💰 CLAIM TREASURE 💰"}
                              </span>
                            </motion.button>
                          )
                        )}

                        {/* Address */}
                        <div className="mt-4 pt-3 border-t border-cyan-500/20">
                          <p className="text-[9px] text-cyan-400/70 font-mono truncate text-center">
                            {pool.address.slice(0, 8)}...{pool.address.slice(-8)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </motion.div>

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
            {isArbiter && status === 'open' && !poolDetails.isAutomatic && (
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

            {/* Automatic: Auto Reveal */}
            {status === 'open' && poolDetails.isAutomatic && (
              <div className="space-y-4">
                <div className="bg-cyan-500/20 border-2 border-cyan-500 rounded-xl p-4 mb-4 text-center">
                  <span className="text-2xl">⚡</span>
                  <p className="text-cyan-300 pixel-font text-sm mt-2">AUTOMATIC MODE</p>
                  <p className="text-cyan-400 pixel-font text-xs mt-1">
                    {Math.floor(Date.now() / 1000) >= poolDetails.lockTime.toNumber()
                      ? "READY TO AUTO-REVEAL!"
                      : `Auto-reveals at ${new Date(poolDetails.lockTime.toNumber() * 1000).toLocaleString()}`}
                  </p>
                </div>

                {Math.floor(Date.now() / 1000) >= poolDetails.lockTime.toNumber() ? (
                  <>
                    <button
                      onClick={handleAutoReveal}
                      disabled={loading || poolDetails.playerCount < 2}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white pixel-font text-lg py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-4 border-cyan-400"
                    >
                      {loading ? "REVEALING..." : "⚡ AUTO-REVEAL WINNER ⚡"}
                    </button>
                    {poolDetails.playerCount < 2 && (
                      <p className="text-sm pixel-font text-red-400 text-center animate-pulse">⚠️ NEED 2+ PLAYERS TO REVEAL</p>
                    )}
                    <p className="text-xs pixel-font text-cyan-300 text-center">
                      Anyone can trigger auto-reveal after lock time
                    </p>
                  </>
                ) : (
                  <div className="bg-black/30 rounded-xl p-4 border border-cyan-500/30 text-center">
                    <p className="text-cyan-300 pixel-font text-sm">⏰ Waiting for lock time...</p>
                    <p className="text-white pixel-font text-xl mt-2">
                      {new Date(poolDetails.lockTime.toNumber() * 1000).toLocaleTimeString()}
                    </p>
                  </div>
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
