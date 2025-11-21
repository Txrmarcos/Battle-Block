"use client";

import { useState, useEffect, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useBlockBattle } from "@/lib/useBlockBattle";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "@/lib/anchor";
import { useDungeonReveal } from "@/hooks/useDungeonReveal";
import PixelDoor, { DoorState, TrapType } from "./pixel-dungeon/PixelDoor";
import VictoryModal from "./pixel-dungeon/VictoryModal";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { getExplorerAddressUrl } from "@/lib/explorer";

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
  const [doorStates, setDoorStates] = useState<Record<number, DoorState>>({});

  const {
    isRevealing,
    showVictory,
    winnerBlock,
    startReveal,
    closeVictory,
  } = useDungeonReveal();

  // Initialize random trap types - OTIMIZADO com useMemo
  const trapTypes = useMemo(() => {
    const types: Record<number, TrapType> = {};
    for (let i = 1; i <= TOTAL_BLOCKS; i++) {
      types[i] = TRAP_TYPES[Math.floor(Math.random() * TRAP_TYPES.length)];
    }
    return types;
  }, []); // Só calcula uma vez

  // Find active pool - OTIMIZADO
  const findActivePool = async () => {
    try {
      // STATUS_OFFSET = discriminator(8) + creator(32) + arbiter(32) +
      // min_deposit(8) + total_pool(8) + lock_time(8) + winner_block(2) = 98
      const STATUS_OFFSET = 98;

      console.log("🔍 Buscando pool ativo...");

      // Usar filtro memcmp para status = 0 (Open)
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: STATUS_OFFSET,
              bytes: "1", // Base58 de 0
            },
          },
        ],
        dataSlice: {
          offset: 0,
          length: 150, // Apenas metadata básica
        },
      });

      console.log(`✅ Encontradas ${accounts.length} apostas abertas`);

      let bestPool: ActivePool | null = null;
      const currentTime = Math.floor(Date.now() / 1000);

      // Limitar a 20 primeiras contas para não sobrecarregar
      const limitedAccounts = accounts.slice(0, 20);

      for (const account of limitedAccounts) {
        try {
          // Usar Anchor deserializer (MUITO mais rápido!)
          const data = await getBetData(account.pubkey);
          if (!data) continue;

          const status = Object.keys(data.status)[0];
          const lockTime = data.lockTime.toNumber();
          const playerCount = data.playerCount;

          if (status === "open" && lockTime > currentTime && playerCount < 100) {
            if (!bestPool || playerCount > bestPool.playerCount) {
              bestPool = {
                address: account.pubkey.toBase58(),
                minDeposit: data.minDeposit.toNumber() / 1e9,
                totalPool: data.totalPool.toNumber() / 1e9,
                playerCount,
                lockTime,
              };
              // Já temos os dados, cachear
              setPoolData(data);
            }
          }
        } catch (err) {
          console.warn("⚠️ Erro ao buscar dados do pool:", err);
        }
      }

      setActivePool(bestPool);
      // Não precisa chamar loadPoolData novamente se já temos os dados
    } catch (error) {
      console.error("❌ Erro ao buscar pools:", error);
    } finally {
      setSearching(false);
    }
  };

  // Load pool data - OTIMIZADO (evita chamadas duplicadas)
  const loadPoolData = async (address: string) => {
    try {
      const poolPDA = new PublicKey(address);
      const data = await getBetData(poolPDA);

      if (!data) {
        console.warn("⚠️ Dados do pool não encontrados");
        return;
      }

      setPoolData(data);

      // Check if player joined (usando os dados já carregados)
      if (publicKey) {
        const playerIndex = data.players.findIndex(
          (player: PublicKey) => player.toBase58() === publicKey.toBase58()
        );

        if (playerIndex !== -1) {
          const chosenBlock = data.chosenBlocks[playerIndex];
          setHasJoined(true);
          setMyChosenBlock(chosenBlock);
          setSelectedBlock(chosenBlock);
        }
      }

      // Check if revealed
      const status = Object.keys(data.status)[0];
      if (status === "revealed" && !isRevealing && data.winnerBlock) {
        startReveal(data.winnerBlock, myChosenBlock || undefined);
      }
    } catch (error) {
      console.error("❌ Erro ao carregar dados do pool:", error);
    }
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
    <div className="space-y-8">
      {/* Dungeon Banner - Irregular stone plaque */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        {/* Outer glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/30 via-cyan-600/30 to-purple-600/30 rounded-[2.5rem] blur-2xl" />

        <div className="relative bg-gradient-to-br from-[#0a0a15] via-[#15152a] to-[#0a0a15] rounded-[2.5rem] p-10 overflow-hidden border-2 border-purple-500/40 shadow-[inset_0_2px_20px_rgba(0,0,0,0.8),0_0_40px_rgba(168,85,247,0.15)]">
          {/* Animated stone texture */}
          <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-[0.08] mix-blend-overlay" />

          {/* Vignette */}
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/40" />

          {/* Floating particles - REDUZIDO para 3 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-cyan-400/30 rounded-full will-change-transform"
                style={{
                  left: `${20 + i * 30}%`,
                  top: `${30 + i * 20}%`,
                }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0, 0.5, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  delay: i * 0.8,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          <div className="relative z-10 text-center">
            <motion.div
              className="inline-block text-7xl mb-4"
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
              {isAutomatic ? "⚡" : "👑"}
            </motion.div>

            <motion.h2
              className="text-4xl md:text-5xl pixel-font mb-3"
              style={{
                background: "linear-gradient(135deg, #a78bfa 0%, #06b6d4 50%, #a78bfa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 20px rgba(167, 139, 250, 0.5))",
              }}
              animate={{
                filter: [
                  "drop-shadow(0 0 20px rgba(167, 139, 250, 0.5))",
                  "drop-shadow(0 0 30px rgba(6, 182, 212, 0.6))",
                  "drop-shadow(0 0 20px rgba(167, 139, 250, 0.5))",
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {isAutomatic ? "AUTOMATIC DUNGEON" : "ARBITER DUNGEON"}
            </motion.h2>

            <p className="text-sm pixel-font text-cyan-300/80 mb-6">
              {isAutomatic ? "⚡ Winner reveals automatically" : "👑 Arbiter reveals the winner"}
            </p>

            <div className="inline-flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-5 py-2 bg-black/40 rounded-full border border-purple-500/30 backdrop-blur-sm">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-xs pixel-font text-purple-300/70 font-mono">
                  {activePool.address.slice(0, 8)}...{activePool.address.slice(-8)}
                </span>
              </div>
              <motion.button
                onClick={() => window.open(getExplorerAddressUrl(activePool.address), "_blank")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-3 py-2 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-300 rounded-full text-xs pixel-font transition-all"
                title="View on Solana Explorer"
              >
                🔍 EXPLORER
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* RPG Stats Badges - Floating pills instead of grid */}
      <div className="relative">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <StatPill icon="💰" label="POOL" value={`${poolTotal.toFixed(3)} SOL`} accent="purple" />
          <StatPill icon="👥" label="PLAYERS" value={`${playerCount}/100`} accent="cyan" />
          <StatPill icon="🎫" label="ENTRY" value={`${minDeposit.toFixed(3)} SOL`} accent="purple" />
          <StatPill
            icon={status === "open" ? "🟢" : status === "revealed" ? "🏆" : "🔴"}
            label="STATUS"
            value={status.toUpperCase()}
            accent={status === "open" ? "green" : status === "revealed" ? "yellow" : "red"}
          />
        </div>
      </div>

      {/* Dungeon Floor - Organic door grid */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="relative"
      >
        {/* Outer atmospheric glow */}
        <div className="absolute -inset-4 bg-gradient-to-b from-purple-900/20 via-cyan-900/20 to-purple-900/20 rounded-[3rem] blur-3xl" />

        {/* Main dungeon floor container */}
        <div className="relative bg-gradient-to-b from-[#08080f] via-[#0f0f1a] to-[#08080f] rounded-[2rem] p-8 md:p-10 overflow-hidden border-2 border-purple-500/30 shadow-[inset_0_4px_30px_rgba(0,0,0,0.9),0_0_50px_rgba(139,92,246,0.1)]">
          {/* Dungeon stone floor texture */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[url('/stone-texture.png')] opacity-[0.06]" />
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-purple-900/5 to-black/30" />
          </div>

          {/* Animated torch light effect */}
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-radial from-orange-500/10 via-yellow-500/5 to-transparent rounded-full blur-3xl"
            animate={{
              opacity: [0.3, 0.5, 0.3],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          <div className="relative z-10">
            {/* Title with breathing animation */}
            <motion.div
              className="text-center mb-8"
              animate={{
                y: [0, -4, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <h3
                className="text-2xl md:text-3xl pixel-font mb-1"
                style={{
                  background: "linear-gradient(135deg, #a78bfa 0%, #06b6d4 50%, #a78bfa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 15px rgba(167, 139, 250, 0.4))",
                }}
              >
                {isRevealing ? "⚔️ REVEALING ⚔️" : "🗝️ CHOOSE YOUR DOOR 🗝️"}
              </h3>
              <p className="text-xs pixel-font text-purple-300/60">
                {isRevealing ? "The treasure is being revealed..." : "Pick wisely, adventurer"}
              </p>
            </motion.div>

            {/* Door Grid with organic spacing */}
            <div className="grid grid-cols-5 gap-3 md:gap-4 max-w-2xl mx-auto">
              {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((blockNum) => (
                <motion.div
                  key={blockNum}
                  className="aspect-square"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: blockNum * 0.02,
                    type: "spring",
                    stiffness: 200,
                    damping: 20
                  }}
                  whileHover={{ scale: hasJoined || isRevealing ? 1 : 1.05, y: -2 }}
                >
                  <PixelDoor
                    blockNumber={blockNum}
                    state={doorStates[blockNum] || "idle"}
                    isWinner={blockNum === winnerBlock}
                    trapType={trapTypes[blockNum]}
                    onSelect={() => !hasJoined && !isRevealing && setSelectedBlock(blockNum)}
                    disabled={hasJoined || isRevealing}
                  />
                </motion.div>
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
          </div>
        </div>
      </motion.div>

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

// RPG-style stat pill component
function StatPill({
  icon,
  label,
  value,
  accent = "purple",
}: {
  icon: string;
  label: string;
  value: string;
  accent?: "purple" | "cyan" | "green" | "yellow" | "red";
}) {
  const accentColors = {
    purple: {
      bg: "from-purple-600/20 to-purple-900/20",
      border: "border-purple-500/40",
      glow: "shadow-purple-500/20",
      text: "text-purple-300",
    },
    cyan: {
      bg: "from-cyan-600/20 to-cyan-900/20",
      border: "border-cyan-500/40",
      glow: "shadow-cyan-500/20",
      text: "text-cyan-300",
    },
    green: {
      bg: "from-green-600/20 to-green-900/20",
      border: "border-green-500/40",
      glow: "shadow-green-500/20",
      text: "text-green-300",
    },
    yellow: {
      bg: "from-yellow-600/20 to-yellow-900/20",
      border: "border-yellow-500/40",
      glow: "shadow-yellow-500/20",
      text: "text-yellow-300",
    },
    red: {
      bg: "from-red-600/20 to-red-900/20",
      border: "border-red-500/40",
      glow: "shadow-red-500/20",
      text: "text-red-300",
    },
  };

  const colors = accentColors[accent];

  return (
    <motion.div
      className="relative group"
      whileHover={{ scale: 1.05, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Glow effect on hover */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r ${colors.bg} rounded-full blur opacity-0 group-hover:opacity-100 transition duration-300`} />

      <div
        className={`relative flex items-center gap-3 px-5 py-3 bg-gradient-to-br ${colors.bg} rounded-full border ${colors.border} backdrop-blur-sm shadow-lg ${colors.glow}`}
      >
        {/* Floating icon */}
        <motion.div
          className="text-2xl"
          animate={{
            y: [0, -2, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {icon}
        </motion.div>

        <div className="text-left">
          <p className={`text-[9px] pixel-font ${colors.text} opacity-70 leading-none mb-1`}>
            {label}
          </p>
          <p className="text-sm pixel-font text-white font-bold leading-none whitespace-nowrap">
            {value}
          </p>
        </div>
      </div>
    </motion.div>
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
