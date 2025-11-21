"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useBlockBattle } from "@/lib/useBlockBattle";
import { PROGRAM_ID } from "@/lib/anchor";
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
    <div className="space-y-6">
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
              onClick={refreshAll}
              disabled={searchingPools}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white pixel-font text-xs rounded-xl transition-all border-2 border-purple-400 shadow-lg"
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
                  className={`p-5 rounded-xl border-2 transition-all text-left relative overflow-hidden group ${
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

      {/* Joined Pools Grid */}
      <div className="bg-gradient-to-br from-[#0f0f1e] to-[#1a1a2e] border-4 border-cyan-500/30 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🎯</span>
            <h3 className="text-xl pixel-font text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">YOUR QUESTS</h3>
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
                        <div className="bg-black/30 rounded-lg p-3 border border-yellow-500/20">
                          <p className="text-xs pixel-font text-yellow-300 mb-1">💰 PRIZE POOL</p>
                          <p className="text-white pixel-font text-lg">
                            {pool.totalPool.toFixed(4)} SOL
                          </p>
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

                      {didWin && (
                        pool.hasClaimed ? (
                          <div className="w-full mt-4 bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 pixel-font text-sm py-3 px-6 rounded-xl shadow-lg border-4 border-gray-500 text-center">
                            ✅ TREASURE CLAIMED
                          </div>
                        ) : (
                          <button
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
                            className="w-full mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white pixel-font text-sm py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-4 border-green-400"
                          >
                            {loading ? "CLAIMING..." : "💰 CLAIM TREASURE 💰"}
                          </button>
                        )
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
