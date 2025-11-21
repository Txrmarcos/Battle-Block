import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";

export const PROGRAM_ID = new PublicKey("EqzTrTYgAttzSmVbjpm6t6SBUVT5Ab2zWVTxaYDE9iBF");

let cachedIdl: any = null;
let cachedProgram: Program | null = null;

// Function to clear cache if needed
export function clearProgramCache() {
  cachedIdl = null;
  cachedProgram = null;
}

async function loadIdl() {
  if (cachedIdl) return cachedIdl;

  const response = await fetch('/idl/block_battle.json');
  if (!response.ok) {
    throw new Error(`Failed to fetch IDL: ${response.status}`);
  }

  cachedIdl = await response.json();
  return cachedIdl;
}

export async function getProgram(connection: Connection, wallet: AnchorWallet): Promise<Program> {
  // Temporarily disable caching to debug
  // if (cachedProgram) {
  //   return cachedProgram;
  // }

  try {
    // Load IDL first
    const idl = await loadIdl();

    console.log("📦 IDL loaded:", {
      address: idl.address,
      name: idl.metadata?.name,
      instructionsCount: idl.instructions?.length,
      accountsCount: idl.accounts?.length,
    });

    console.log("🔑 Using Program IDs:", {
      fromIDL: idl.address,
      fromConstant: PROGRAM_ID.toBase58(),
      match: idl.address === PROGRAM_ID.toBase58()
    });

    // Create provider
    const provider = new AnchorProvider(
      connection,
      wallet,
      AnchorProvider.defaultOptions()
    );

    // Create program - pass only provider, let Anchor use the address from IDL
    cachedProgram = new Program(idl, provider);

    console.log("✅ Program created:", {
      programId: cachedProgram.programId.toBase58(),
      hasMethods: !!cachedProgram.methods,
      methods: cachedProgram.methods ? Object.keys(cachedProgram.methods) : [],
    });

    return cachedProgram;
  } catch (error) {
    console.error("❌ Error loading program:", error);
    throw error;
  }
}

export function getBetPDA(creator: PublicKey, seed: number | bigint): [PublicKey, number] {
  const seedBuffer = Buffer.alloc(8);
  seedBuffer.writeBigUInt64LE(BigInt(seed));

  return PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), creator.toBuffer(), seedBuffer],
    PROGRAM_ID
  );
}
