import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getProgram, getBetPDA } from "./anchor";
import { BN } from "@coral-xyz/anchor";
import toast from "react-hot-toast";

export function useBlockBattle() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const createBet = async (
    minDepositSol: number,
    arbiter: PublicKey,
    lockTimeSeconds: number,
    isAutomatic: boolean
  ) => {
    if (!wallet) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const program = await getProgram(connection, wallet);

      // Generate unique seed using timestamp
      const seed = BigInt(Date.now());
      const [betPDA] = getBetPDA(wallet.publicKey, seed);

      const lockTime = Math.floor(Date.now() / 1000) + lockTimeSeconds;
      const minDeposit = new BN(minDepositSol * LAMPORTS_PER_SOL);

      const tx = await program.methods
        .createBet(new BN(seed.toString()), minDeposit, arbiter, new BN(lockTime), isAutomatic)
        .accounts({
          bet: betPDA,
          creator: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      toast.success("Bet created successfully!");
      console.log("Transaction signature:", tx);
      console.log("Bet PDA:", betPDA.toBase58());
      console.log("Seed:", seed.toString());
      return { tx, betPDA, seed };
    } catch (error: any) {
      console.error("Error creating bet:", error);
      const errorMsg = error?.message || error?.toString() || "Failed to create bet";
      toast.error(errorMsg);
      throw error;
    }
  };

  const joinBet = async (
    betPDA: PublicKey,
    chosenBlock: number,
    depositSol: number
  ) => {
    if (!wallet) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const program = await getProgram(connection, wallet);
      const deposit = new BN(depositSol * LAMPORTS_PER_SOL);

      console.log("🎲 Joining bet with params:", {
        betPDA: betPDA.toBase58(),
        chosenBlock,
        depositSol,
        depositLamports: deposit.toString(),
        player: wallet.publicKey.toBase58(),
      });

      const tx = await program.methods
        .joinBet(chosenBlock, deposit)
        .accounts({
          bet: betPDA,
          player: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      toast.success(`Joined bet with block ${chosenBlock}!`);
      return tx;
    } catch (error: any) {
      console.error("Error joining bet:", error);
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      toast.error(error.message || "Failed to join bet");
      throw error;
    }
  };

  const revealWinner = async (betPDA: PublicKey, winningBlock: number) => {
    if (!wallet) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const program = await getProgram(connection, wallet);

      const tx = await program.methods
        .revealWinner(winningBlock)
        .accounts({
          bet: betPDA,
          arbiter: wallet.publicKey,
        })
        .rpc();

      toast.success(`Winner revealed: Block ${winningBlock}!`);
      return tx;
    } catch (error: any) {
      console.error("Error revealing winner:", error);
      toast.error(error.message || "Failed to reveal winner");
      throw error;
    }
  };

  const autoRevealWinner = async (betPDA: PublicKey) => {
    if (!wallet) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const program = await getProgram(connection, wallet);

      const tx = await program.methods
        .autoRevealWinner()
        .accounts({
          bet: betPDA,
          caller: wallet.publicKey,
        })
        .rpc();

      toast.success("Winner auto-revealed!");
      return tx;
    } catch (error: any) {
      console.error("Error auto-revealing winner:", error);
      toast.error(error.message || "Failed to auto-reveal winner");
      throw error;
    }
  };

  const claimWinnings = async (betPDA: PublicKey) => {
    if (!wallet) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const program = await getProgram(connection, wallet);

      const tx = await program.methods
        .claimWinnings()
        .accounts({
          bet: betPDA,
          player: wallet.publicKey,
        })
        .rpc();

      toast.success("Winnings claimed successfully!");
      return tx;
    } catch (error: any) {
      console.error("Error claiming winnings:", error);
      toast.error(error.message || "Failed to claim winnings");
      throw error;
    }
  };

  const cancelBet = async (betPDA: PublicKey) => {
    if (!wallet) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const program = await getProgram(connection, wallet);

      const tx = await program.methods
        .cancelBet()
        .accounts({
          bet: betPDA,
          creator: wallet.publicKey,
        })
        .rpc();

      toast.success("Bet cancelled successfully!");
      return tx;
    } catch (error: any) {
      console.error("Error cancelling bet:", error);
      toast.error(error.message || "Failed to cancel bet");
      throw error;
    }
  };

  const getBetData = async (betPDA: PublicKey) => {
    if (!wallet) return null;

    try {
      const program = await getProgram(connection, wallet);
      const betAccount = await (program.account as any).betAccount.fetch(betPDA);
      return betAccount;
    } catch (error: any) {
      console.error("Error fetching bet data:", error);
      return null;
    }
  };

  return {
    createBet,
    joinBet,
    revealWinner,
    autoRevealWinner,
    claimWinnings,
    cancelBet,
    getBetData,
  };
}
