"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useBlockBattle } from "@/lib/useBlockBattle";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "@/lib/anchor";
import { useDungeonReveal } from "@/hooks/useDungeonReveal";
import PixelDoor, { DoorState, TrapType } from "./pixel-dungeon/PixelDoor";
import VictoryModal from "./pixel-dungeon/VictoryModal";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

const TOTAL_BLOCKS = 25;
const TRAP_TYPES: TrapType[] = ["arrow", "poison", "skeleton", "slime", "spikes", "curse"];

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

export default function QuickPlayPixel({ betAddress }: QuickPlayProps) {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const { joinBet, getBetData, claimWinnings } = useBlockBattle();

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [activePool, setActivePool] = useState<ActivePool | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [myChosenBlock, setMyChosenBlock] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState("0.1");
  const [poolData, setPoolData] = useState<any>(null);
  const [trapTypes, setTrapTypes] = useState<Record<number, TrapType>>({});
  const [doorStates, setDoorStates] = useState<Record<number, DoorState>>({});

  const {
    isRevealing,
    showVictory,
    winnerBlock,
    startReveal,
    closeVictory,
  } = useDungeonReveal();

  // Initialize random trap types
  useEffect(() => {
    const types: Record<number, TrapType> = {};
    for (let i = 1; i <= TOTAL_BLOCKS; i++) {
      types[i] = TRAP_TYPES[Math.floor(Math.random() * TRAP_TYPES.length)];
    }
    setTrapTypes(types);
  }, []);

  // Find active pool
  const findActivePool = async () => {
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      let bestPool: ActivePool | null = null;
      const currentTime = Math.floor(Date.now() / 1000);

      for (const account of accounts) {
        try {
          const data = account.account.data;
          let offset = 8;
          offset += 32; // creator
          offset += 32; // arbiter
          const minDeposit = Number(data.readBigUInt64LE(offset));
          offset += 8;
          const totalPool = Number(data.readBigUInt64LE(offset));
          offset += 8;
          const lockTime = Number(data.readBigInt64LE(offset));
          offset += 8;
          const hasWinnerBlock = data.readUInt8(offset);
          offset += 1;
          if (hasWinnerBlock) offset += 1;
          const status = data.readUInt8(offset);
          offset += 1;
          const playerCount = data.readUInt8(offset);

          if (status === 0 && lockTime > currentTime && playerCount < 100) {
            if (!bestPool || playerCount > bestPool.playerCount) {
              bestPool = {
                address: account.pubkey.toBase58(),
                minDeposit: minDeposit / 1e9,
                totalPool: totalPool / 1e9,
                playerCount,
                lockTime,
              };
            }
          }
        } catch (err) {
          console.error("Error parsing account:", err);
        }
      }

      setActivePool(bestPool);
      if (bestPool) {
        await loadPoolData(bestPool.address);
      }
    } catch (error) {
      console.error("Error finding pools:", error);
    } finally {
      setSearching(false);
    }
  };

  // Load pool data
  const loadPoolData = async (address: string) => {
    try {
      const poolPDA = new PublicKey(address);
      const data = await getBetData(poolPDA);
      setPoolData(data);

      if (publicKey) {
        await checkIfJoined(address);
      }

      // Check if revealed
      const status = Object.keys(data.status)[0];
      if (status === "revealed" && !isRevealing) {
        startReveal(data.winnerBlock, myChosenBlock || undefined);
      }
    } catch (error) {
      console.error("Error loading pool:", error);
    }
  };

  // Check if joined
  const checkIfJoined = async (address: string) => {
    if (!publicKey) return false;

    try {
      const poolPDA = new PublicKey(address);
      const data = await getBetData(poolPDA);

      const playerIndex = data.players.findIndex(
        (player: PublicKey) => player.toBase58() === publicKey.toBase58()
      );

      if (playerIndex !== -1) {
        const chosenBlock = data.chosenBlocks[playerIndex];
        setHasJoined(true);
        setMyChosenBlock(chosenBlock);
        setSelectedBlock(chosenBlock);
        return true;
      }
    } catch (error) {
      console.error("Error checking join status:", error);
    }
    return false;
  };

  // Handle join
  const handleJoin = async () => {
    if (!activePool || selectedBlock === null) return;

    setLoading(true);
    try {
      const poolPDA = new PublicKey(activePool.address);
      await joinBet(poolPDA, selectedBlock, parseFloat(depositAmount));
      await loadPoolData(activePool.address);
      toast.success(`Entered dungeon with Door ${selectedBlock}! 🗝️`);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Handle claim
  const handleClaim = async () => {
    if (!activePool) return;

    setLoading(true);
    try {
      const poolPDA = new PublicKey(activePool.address);
      await claimWinnings(poolPDA);
      toast.success("Treasure claimed! 💰");
      closeVictory();
      await loadPoolData(activePool.address);
    } catch (error) {
      console.error(error);
      toast.error("Failed to claim treasure");
    } finally {
      setLoading(false);
    }
  };

  // Update door states
  useEffect(() => {
    const newStates: Record<number, DoorState> = {};
    for (let i = 1; i <= TOTAL_BLOCKS; i++) {
      if (isRevealing) {
        if (i === winnerBlock) {
          newStates[i] = "opening";
        } else {
          newStates[i] = "idle";
        }
      } else {
        newStates[i] = i === selectedBlock ? "selected" : "idle";
      }
    }
    setDoorStates(newStates);
  }, [selectedBlock, isRevealing, winnerBlock]);

  // Reveal animation
  useEffect(() => {
    if (isRevealing && winnerBlock) {
      const loserDoors = Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).filter(
        (n) => n !== winnerBlock
      );
      const shuffled = [...loserDoors].sort(() => Math.random() - 0.5);

      shuffled.forEach((door, index) => {
        setTimeout(() => {
          setDoorStates((prev) => ({ ...prev, [door]: "trapped" }));
          setTimeout(() => {
            setDoorStates((prev) => ({ ...prev, [door]: "revealed-loser" }));
          }, 1000);
        }, index * 100);
      });

      setTimeout(() => {
        setDoorStates((prev) => ({ ...prev, [winnerBlock]: "revealed-winner" }));
      }, shuffled.length * 100 + 500);
    }
  }, [isRevealing, winnerBlock]);

  // Auto-find pool
  useEffect(() => {
    if (betAddress) {
      setActivePool({ address: betAddress, minDeposit: 0, totalPool: 0, playerCount: 0, lockTime: 0 });
      loadPoolData(betAddress);
      setSearching(false);
    } else if (connected) {
      findActivePool();
    }
  }, [connected, betAddress]);

  if (!connected) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h3 className="text-xl font-semibold mb-2 text-white">Connect Wallet</h3>
        <p className="text-[#A1A1AA] text-sm">Connect your wallet to play</p>
      </div>
    );
  }

  if (searching) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
        <p className="text-[#A1A1AA]">Finding active pools...</p>
      </div>
    );
  }

  if (!activePool) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h3 className="text-xl font-semibold mb-2 text-white">No Active Pools</h3>
        <p className="text-[#A1A1AA] text-sm">Create a new pool to get started</p>
      </div>
    );
  }

  const status = poolData ? Object.keys(poolData.status)[0] : "open";
  const isAutomatic = poolData?.isAutomatic ?? false;
  const poolTotal = poolData ? poolData.totalPool.toNumber() / 1e9 : activePool.totalPool;
  const minDeposit = poolData ? poolData.minDeposit.toNumber() / 1e9 : activePool.minDeposit;
  const playerCount = poolData ? poolData.playerCount : activePool.playerCount;

  return (
    <div className="space-y-6">
      {/* Dungeon Header */}
      <div className="bg-gradient-to-br from-[#0f0f1e] to-[#1a1a2e] border-4 border-purple-500/30 rounded-2xl p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-5"></div>
        <div className="relative z-10">
          <div className="text-5xl mb-3">{isAutomatic ? "⚡" : "👑"}</div>
          <h2 className="text-3xl pixel-font text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mb-2"
              style={{ textShadow: "3px 3px 0px #000" }}>
            {isAutomatic ? "AUTOMATIC DUNGEON" : "ARBITER DUNGEON"}
          </h2>
          <p className="text-sm pixel-font text-cyan-300">
            {isAutomatic ? "⚡ Winner reveals automatically" : "👑 Arbiter reveals the winner"}
          </p>
          <div className="mt-4 text-xs pixel-font text-purple-300 font-mono">
            {activePool.address.slice(0, 12)}...{activePool.address.slice(-12)}
          </div>
        </div>
      </div>

      {/* Pool Stats */}
      <div className="bg-gradient-to-br from-purple-900/20 to-cyan-900/20 border-2 border-purple-500/30 rounded-2xl p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox icon="💰" label="POOL" value={`${poolTotal.toFixed(3)} SOL`} />
          <StatBox icon="👥" label="PLAYERS" value={`${playerCount}/100`} />
          <StatBox icon="🎫" label="MIN ENTRY" value={`${minDeposit.toFixed(3)} SOL`} />
          <StatBox icon={status === "open" ? "🟢" : status === "revealed" ? "🏆" : "🔴"} label="STATUS" value={status.toUpperCase()} />
        </div>
      </div>

      {/* Compact Dungeon Grid */}
      <div className="bg-gradient-to-b from-[#0f0f1e] via-[#1a1a2e] to-[#0f0f1e] rounded-2xl border-4 border-purple-500/30 p-4 md:p-6">
        <div className="text-center mb-4">
          <h3 className="text-xl md:text-2xl pixel-font text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
            {isRevealing ? "⚔️ REVEALING ⚔️" : "🗝️ CHOOSE DOOR 🗝️"}
          </h3>
        </div>

        {/* Compact Grid 5x5 */}
        <div className="grid grid-cols-5 gap-1.5 md:gap-2 max-w-md mx-auto">
          {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((blockNum) => (
            <div key={blockNum} className="aspect-square">
              <PixelDoor
                blockNumber={blockNum}
                state={doorStates[blockNum] || "idle"}
                isWinner={blockNum === winnerBlock}
                trapType={trapTypes[blockNum]}
                onSelect={() => !hasJoined && !isRevealing && setSelectedBlock(blockNum)}
                disabled={hasJoined || isRevealing}
              />
            </div>
          ))}
        </div>

        {/* Player's Choice */}
        {myChosenBlock && !isRevealing && (
          <motion.div
            className="mt-4 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 border-2 border-cyan-500 rounded-lg">
              <span className="text-lg">🎯</span>
              <span className="pixel-font text-xs text-cyan-300">
                YOU CHOSE DOOR <span className="text-cyan-100 font-bold">{myChosenBlock}</span>
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Actions */}
      {!hasJoined && status === "open" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm pixel-font text-purple-300 mb-2">
              DEPOSIT (SOL)
            </label>
            <input
              type="number"
              step="0.01"
              min={activePool.minDeposit}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full px-4 py-3 bg-black/50 border-2 border-purple-500/50 rounded-xl text-white pixel-font text-sm focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            onClick={handleJoin}
            disabled={loading || selectedBlock === null}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 border-4 border-green-400 rounded-xl pixel-font text-lg text-white hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? "ENTERING..." : selectedBlock ? `⚔️ ENTER DOOR ${selectedBlock} ⚔️` : "SELECT A DOOR"}
          </button>
        </div>
      )}

      {/* Victory Modal */}
      <VictoryModal
        isOpen={showVictory}
        onClose={closeVictory}
        onClaim={handleClaim}
        prizeAmount={poolData ? poolData.totalPool.toNumber() / 1e9 : 0}
        winningBlock={winnerBlock || 0}
      />
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-black/30 rounded-lg p-3 border border-purple-500/20 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-[10px] pixel-font text-purple-300 mb-0.5">{label}</p>
      <p className="text-sm pixel-font text-white font-bold truncate">{value}</p>
    </div>
  );
}
