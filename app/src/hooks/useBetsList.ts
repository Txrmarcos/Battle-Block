import { useState, useCallback, useRef } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, getProgram } from "@/lib/anchor";
import { useAnchorWallet } from "@solana/wallet-adapter-react";

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
  const wallet = useAnchorWallet();
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

    if (!wallet) {
      console.log("⚠️ Wallet não conectada");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const program = await getProgram(connection, wallet);

      // Calcular offset para o campo status (Open = 0)
      // discriminator(8) + creator(32) + arbiter(32) + min_deposit(8) +
      // total_pool(8) + lock_time(8) + winner_block(2) = 98 bytes
      const STATUS_OFFSET = 98;

      console.log("🔍 Buscando apostas abertas com filtros otimizados...");
      const startTime = Date.now();

      // Usar filtros efetivos: memcmp para status = 0 (Open)
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: STATUS_OFFSET,
              bytes: "1", // Base58 encoding de 0 = "1"
            },
          },
        ],
        // Limitar dados retornados
        dataSlice: {
          offset: 0,
          length: 200, // Apenas os primeiros 200 bytes (suficiente para metadata básica)
        },
      });

      console.log(`✅ Encontradas ${accounts.length} contas em ${Date.now() - startTime}ms`);

      // Limitar resultados
      const limitedAccounts = accounts.slice(0, MAX_RESULTS);
      const openBets: OpenBet[] = [];

      // Buscar dados completos apenas para contas limitadas usando Anchor
      for (const account of limitedAccounts) {
        try {
          // Usar o deserializer do Anchor (muito mais rápido!)
          const betData = await (program.account as any).betAccount.fetch(
            account.pubkey
          );

          // Verificar se ainda está aberta
          const status = Object.keys(betData.status)[0];
          if (status === "open") {
            openBets.push({
              address: account.pubkey.toBase58(),
              creator: betData.creator.toBase58(),
              minDeposit: betData.minDeposit.toNumber() / 1e9,
              totalPool: betData.totalPool.toNumber() / 1e9,
              playerCount: betData.playerCount,
              lockTime: betData.lockTime.toNumber(),
              isAutomatic: betData.isAutomatic,
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
  }, [connection, wallet]);

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
