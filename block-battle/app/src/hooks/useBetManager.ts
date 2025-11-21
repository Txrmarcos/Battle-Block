/**
 * Bet Manager Hook - DEPRECATED
 *
 * This hook is no longer used as the app now supports multiple pools per user.
 * Kept for backwards compatibility only.
 */

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";

interface BetInfo {
  address: string;
  creator: string;
  timestamp: number;
}

export function useBetManager() {
  const [activeBet] = useState<BetInfo | null>(null);
  const [betData] = useState<any>(null);
  const [loading] = useState(false);

  const saveBet = async (_betPDA: PublicKey) => {
    // No-op: deprecated
  };

  const clearBet = () => {
    // No-op: deprecated
  };

  const refreshBet = async () => {
    // No-op: deprecated
  };

  const getMyBetPDA = () => {
    return null;
  };

  return {
    activeBet,
    betData,
    loading,
    saveBet,
    clearBet,
    refreshBet,
    getMyBetPDA,
  };
}
