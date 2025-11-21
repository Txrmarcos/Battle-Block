import { useState, useCallback, useRef } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "@/lib/anchor";

interface OpenBet {
  address: string;
  creator: string;
  minDeposit: number;
  totalPool: number;
  playerCount: number;
  lockTime: number;
  isAutomatic: boolean;
}

const CACHE_DURATION_MS = 30000; // Cache por 30 segundos
const MAX_RESULTS = 50; // Limitar resultados

export function useBetsList() {
  const { connection } = useConnection();
  const [bets, setBets] = useState<OpenBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache simples
  const cacheRef = useRef<{
    data: OpenBet[];
    timestamp: number;
  } | null>(null);

  const loadOpenBets = useCallback(async (forceRefresh = false) => {
    // Retornar do cache se ainda válido
    if (!forceRefresh && cacheRef.current) {
      const age = Date.now() - cacheRef.current.timestamp;
      if (age < CACHE_DURATION_MS) {
        console.log("📦 Retornando bets do cache (idade:", age, "ms)");
        setBets(cacheRef.current.data);
        return cacheRef.current.data;
      }
    }

    setLoading(true);
    setError(null);

    try {

      // Calcular offset para o campo status (Open = 0)
      // discriminator(8) + creator(32) + arbiter(32) + min_deposit(8) +
      // total_pool(8) + lock_time(8) + winner_block(2) = 98 bytes
      const STATUS_OFFSET = 98;

      console.log("🔍 Buscando apostas abertas com filtros otimizados...");
      const startTime = Date.now();

      // Buscar todas as contas abertas (status = 0)
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: STATUS_OFFSET,
              bytes: "1", // Base58 encoding de 0 = "1"
            },
          },
        ],
      });

      console.log(`✅ Encontradas ${accounts.length} contas em ${Date.now() - startTime}ms`);

      // Limitar resultados
      const limitedAccounts = accounts.slice(0, MAX_RESULTS);
      const openBets: OpenBet[] = [];

      // Parse bytes diretamente - SEM chamadas RPC extras!
      for (const account of limitedAccounts) {
        try {
          const data = account.account.data;

          // Parse estrutura:
          // discriminator(8) + creator(32) + arbiter(32) + min_deposit(8) +
          // total_pool(8) + lock_time(8) + winner_block(Option<u8>) +
          // status(1) + player_count(1) + bump(1) + is_automatic(1)

          let offset = 8; // Skip discriminator

          const creatorBytes = data.slice(offset, offset + 32);
          const creator = new PublicKey(creatorBytes).toBase58();
          offset += 32 + 32; // Skip creator + arbiter

          const minDeposit = Number(data.readBigUInt64LE(offset));
          offset += 8;

          const totalPool = Number(data.readBigUInt64LE(offset));
          offset += 8;

          const lockTime = Number(data.readBigInt64LE(offset));
          offset += 8;

          // winner_block: Option<u8>
          const hasWinnerBlock = data.readUInt8(offset);
          offset += hasWinnerBlock === 1 ? 2 : 1;

          const status = data.readUInt8(offset);
          offset += 1;

          const playerCount = data.readUInt8(offset);
          offset += 1;

          offset += 1; // Skip bump

          const isAutomatic = data.readUInt8(offset) === 1;

          // Só adicionar se status for Open (0)
          if (status === 0) {
            openBets.push({
              address: account.pubkey.toBase58(),
              creator,
              minDeposit: minDeposit / 1e9,
              totalPool: totalPool / 1e9,
              playerCount,
              lockTime,
              isAutomatic,
            });
          }
        } catch (err) {
          console.warn("⚠️ Erro ao parsear conta:", account.pubkey.toBase58(), err);
        }
      }

      // Ordenar por lockTime (mais recentes primeiro)
      openBets.sort((a, b) => b.lockTime - a.lockTime);

      console.log(`✅ Processadas ${openBets.length} apostas válidas`);

      // Atualizar cache
      cacheRef.current = {
        data: openBets,
        timestamp: Date.now(),
      };

      setBets(openBets);
      return openBets;
    } catch (err: any) {
      console.error("❌ Erro ao carregar apostas:", err);
      setError(err.message || "Falha ao carregar apostas");
      return [];
    } finally {
      setLoading(false);
    }
  }, [connection]);

  const invalidateCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  return {
    bets,
    loading,
    error,
    loadOpenBets,
    invalidateCache,
  };
}
