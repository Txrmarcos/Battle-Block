"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useBlockBattle } from "@/lib/useBlockBattle";
import { useDungeonReveal } from "@/hooks/useDungeonReveal";
import PixelDungeonGrid from "./PixelDungeonGrid";
import VictoryModal from "./VictoryModal";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

interface PixelQuickPlayProps {
  betAddress?: string | null;
}

export default function PixelQuickPlay({ betAddress }: PixelQuickPlayProps) {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const { joinBet, getBetData, claimWinnings } = useBlockBattle();

  const [loading, setLoading] = useState(false);
  const [poolAddress, setPoolAddress] = useState(betAddress || "");
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState("0.1");
  const [poolData, setPoolData] = useState<any>(null);
  const [myChosenBlock, setMyChosenBlock] = useState<number | null>(null);
  const [hasJoined, setHasJoined] = useState(false);

  const {
    isRevealing,
    isComplete,
    showVictory,
    winnerBlock,
    startReveal,
    reset,
    closeVictory,
  } = useDungeonReveal();

  // Auto-load from URL parameter
  useEffect(() => {
    if (betAddress) {
      setPoolAddress(betAddress);
      loadSpecificPool(betAddress);
    }
  }, [betAddress]);

  const loadSpecificPool = async (address: string) => {
    if (!address) return;

    try {
      setLoading(true);
      const poolPDA = new PublicKey(address);
      const data = await getBetData(poolPDA);
      setPoolData(data);

      // Check if user has joined
      if (publicKey) {
        await checkIfJoined(address);
      }
    } catch (error) {
      console.error("Error loading pool:", error);
      toast.error("Failed to load pool");
    } finally {
      setLoading(false);
    }
  };

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

  const handleJoin = async () => {
    if (!poolAddress || selectedBlock === null) return;

    setLoading(true);
    try {
      const poolPDA = new PublicKey(poolAddress);
      await joinBet(poolPDA, selectedBlock, parseFloat(depositAmount));
      await loadSpecificPool(poolAddress);
      toast.success(`Entered the dungeon with Door ${selectedBlock}! 🗝️`);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!poolAddress) return;

    setLoading(true);
    try {
      const poolPDA = new PublicKey(poolAddress);
      await claimWinnings(poolPDA);
      toast.success("Treasure claimed! 💰");
      closeVictory();
      await loadSpecificPool(poolAddress);
    } catch (error) {
      console.error(error);
      toast.error("Failed to claim treasure");
    } finally {
      setLoading(false);
    }
  };

  // Auto-reveal when pool is revealed
  useEffect(() => {
    if (poolData && poolData.status && Object.keys(poolData.status)[0] === "revealed") {
      if (!isRevealing && !isComplete) {
        startReveal(poolData.winnerBlock, myChosenBlock || undefined);
      }
    }
  }, [poolData, isRevealing, isComplete, myChosenBlock]);

  if (!connected) {
    return (
      <div className="dungeon-bg min-h-[600px] rounded-3xl border-4 border-purple-500/30 p-16 text-center relative overflow-hidden">
        <div className="relative z-10">
          <motion.div
            className="text-8xl mb-6"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🔒
          </motion.div>
          <h3 className="text-3xl font-bold pixel-font text-purple-300 mb-4 shadow-8bit">
            CONNECT WALLET
          </h3>
          <p className="text-cyan-300 pixel-font text-sm">
            Connect your wallet to enter the dungeon
          </p>
        </div>

        {/* Ambient particles */}
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-purple-400 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0, 0.5, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </div>
    );
  }

  const status = poolData ? Object.keys(poolData.status)[0] : null;
  const isRevealed = status === "revealed";

  return (
    <div className="space-y-8">
      {/* Pool Input Section */}
      {!poolData && (
        <motion.div
          className="dungeon-bg rounded-2xl border-4 border-purple-500/30 p-8 stone-texture"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-3xl pixel-font text-purple-300 mb-2 shadow-8bit">
                🗝️ ENTER DUNGEON 🗝️
              </h3>
              <p className="text-cyan-300 pixel-font text-sm">
                Paste pool address to begin your quest
              </p>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={poolAddress}
                onChange={(e) => setPoolAddress(e.target.value)}
                className="flex-1 px-4 py-3 bg-black/50 border-4 border-purple-500/50 rounded-xl text-white pixel-font text-sm focus:outline-none focus:border-purple-500 transition-all"
                placeholder="Pool address..."
              />
              <button
                onClick={() => loadSpecificPool(poolAddress)}
                disabled={loading || !poolAddress}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 border-4 border-purple-400 rounded-xl pixel-font text-white hover:from-purple-500 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed pixel-button"
              >
                {loading ? "..." : "LOAD"}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Pool Loaded - Dungeon Grid */}
      {poolData && (
        <div className="space-y-8">
          {/* Pool Stats */}
          <motion.div
            className="dungeon-bg rounded-2xl border-4 border-cyan-500/30 p-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatBox
                icon="💰"
                label="TREASURE"
                value={`${(poolData.totalPool.toNumber() / 1e9).toFixed(4)} SOL`}
                color="yellow"
              />
              <StatBox
                icon="👥"
                label="ADVENTURERS"
                value={`${poolData.playerCount} / 100`}
                color="cyan"
              />
              <StatBox
                icon="⚔️"
                label="ENTRY FEE"
                value={`${(poolData.minDeposit.toNumber() / 1e9).toFixed(4)} SOL`}
                color="purple"
              />
              <StatBox
                icon={status === "open" ? "🟢" : status === "revealed" ? "🏆" : "🔴"}
                label="STATUS"
                value={status?.toUpperCase() || "???"}
                color={status === "open" ? "green" : status === "revealed" ? "gold" : "red"}
              />
            </div>
          </motion.div>

          {/* Dungeon Grid */}
          <PixelDungeonGrid
            selectedBlock={selectedBlock}
            onSelectBlock={setSelectedBlock}
            winnerBlock={isRevealed ? poolData.winnerBlock : undefined}
            isRevealing={isRevealing}
            disabled={hasJoined || status !== "open"}
            playerBlock={myChosenBlock || undefined}
          />

          {/* Action Buttons */}
          {!hasJoined && status === "open" && (
            <motion.div
              className="max-w-2xl mx-auto space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div>
                <label className="block pixel-font text-sm text-purple-300 mb-2">
                  DEPOSIT AMOUNT (SOL)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={poolData.minDeposit.toNumber() / 1e9}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-black/50 border-4 border-cyan-500/50 rounded-xl text-white pixel-font focus:outline-none focus:border-cyan-500 transition-all"
                />
              </div>

              <button
                onClick={handleJoin}
                disabled={loading || selectedBlock === null}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 border-4 border-green-400 rounded-xl pixel-font text-2xl text-white hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed pixel-button shadow-lg"
              >
                {loading
                  ? "ENTERING..."
                  : selectedBlock
                  ? `⚔️ ENTER WITH DOOR ${selectedBlock} ⚔️`
                  : "SELECT A DOOR"}
              </button>
            </motion.div>
          )}
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

// Stat Box Component
function StatBox({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    yellow: "from-yellow-600/20 to-yellow-500/20 border-yellow-500",
    cyan: "from-cyan-600/20 to-cyan-500/20 border-cyan-500",
    purple: "from-purple-600/20 to-purple-500/20 border-purple-500",
    green: "from-green-600/20 to-green-500/20 border-green-500",
    gold: "from-yellow-600/20 to-orange-500/20 border-yellow-500",
    red: "from-red-600/20 to-red-500/20 border-red-500",
  };

  return (
    <div
      className={`bg-gradient-to-br ${colorMap[color]} border-4 rounded-xl p-4 text-center`}
    >
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-xs pixel-font text-gray-400 mb-1">{label}</p>
      <p className="text-lg pixel-font text-white font-bold">{value}</p>
    </div>
  );
}
