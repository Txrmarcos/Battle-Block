# Block Battle - Arquitetura de Dados

## 🎯 Fonte de Verdade: Blockchain

### Como funciona o armazenamento de bets

#### 1. PDA (Program Derived Address)
Cada usuário tem **um único endereço determinístico** para sua bet:

```rust
// No smart contract (programs/block-battle/src/lib.rs)
seeds = [b"bet", creator.key().as_ref()]
```

Isso significa:
- **PDA = hash(b"bet" + sua_wallet_address)**
- Sempre o mesmo endereço para o mesmo criador
- Não precisa "guardar" endereços - eles são calculados!

#### 2. Limitação por Design
Um usuário **só pode ter UMA bet ativa** por vez:
- ✅ Vantagem: Simples, determinístico, sem confusão
- ✅ Vantagem: Não precisa de indexação ou banco de dados
- ❌ Limitação: Precisa cancelar a bet antiga para criar nova

#### 3. Fluxo de Dados

```
Criar Bet
   ↓
Solana cria account no PDA
   ↓
Frontend calcula: PDA = getBetPDA(wallet)
   ↓
Frontend busca: getBetData(PDA)
   ↓
Se existir → mostra bet ativa
Se não → sem bet ativa
```

## 💾 localStorage: Apenas Cache

O localStorage **NÃO é a fonte de verdade**, apenas acelera o carregamento:

```typescript
// Hook: useBetManager.ts

// 1. Sempre buscar da blockchain PRIMEIRO
const data = await getBetData(myBetPDA);

// 2. Se encontrar na blockchain, cachear
if (data) {
  localStorage.setItem(...); // Cache
}

// 3. Se não encontrar, limpar cache
else {
  localStorage.removeItem(...); // Limpar cache desatualizado
}
```

### Por que usar localStorage então?

**Performance UX:**
- Evita fetch RPC toda vez que componente renderiza
- Mostra loading state mais rápido
- Reduz custos de RPC (cada chamada custa)

**Mas sempre valida:**
- Toda vez que conecta a wallet → fetch da blockchain
- Toda vez que faz refresh → fetch da blockchain
- Cache pode estar desatualizado? → blockchain é consultada

## 🌐 Funcionamento Multi-Dispositivo

### Cenário: Criar bet no PC, abrir no celular

1. **PC**: Cria bet → vai para blockchain no PDA
2. **Celular**: Conecta mesma wallet
3. **Celular**: Calcula PDA = hash(b"bet" + wallet)
4. **Celular**: Busca da blockchain → encontra a bet!
5. **Celular**: Cacheia no localStorage do celular

**Resultado:** Funciona perfeitamente! 🎉

### Cenário: Limpar cache do navegador

1. Limpa localStorage
2. Recarrega página
3. Hook detecta: sem cache
4. Hook calcula PDA e busca da blockchain
5. Encontra bet e re-cacheia

**Resultado:** Não perde nada! Blockchain é imutável 🔒

## 🏗️ Alternativas para Múltiplas Bets

Se no futuro quiser permitir múltiplas bets por usuário:

### Opção 1: Adicionar contador no seed
```rust
seeds = [b"bet", creator.key().as_ref(), &counter.to_le_bytes()]
```
- Precisa guardar contador em account separada
- Ou usar timestamp como counter

### Opção 2: Backend indexer
```typescript
// Backend (Helius/QuickNode WebSocket)
program.addEventListener("BetCreated", (event) => {
  database.save({
    creator: event.creator,
    betPDA: event.betPDA,
    timestamp: event.timestamp
  });
});

// Frontend
const myBets = await api.getMyBets(wallet);
```

### Opção 3: getProgramAccounts
```typescript
// Buscar todas as contas do programa com filtro
const bets = await connection.getProgramAccounts(PROGRAM_ID, {
  filters: [
    { memcmp: { offset: 8, bytes: wallet.toBase58() } }
  ]
});
```
- ❌ Lento (varredura completa)
- ❌ Custoso em RPC (muitas contas)
- ❌ Pode ser bloqueado por alguns RPCs

## 📊 Comparação de Abordagens

| Abordagem | Segurança | Performance | Multi-device | Complexidade |
|-----------|-----------|-------------|--------------|--------------|
| **PDA atual** | ✅ Excelente | ✅ Ótima | ✅ Sim | ✅ Simples |
| localStorage only | ❌ Péssima | ✅ Ótima | ❌ Não | ✅ Simples |
| Backend indexer | ✅ Boa | ✅ Ótima | ✅ Sim | ❌ Complexa |
| getProgramAccounts | ✅ Excelente | ❌ Ruim | ✅ Sim | ⚠️ Média |

## 🎓 Conclusão

A arquitetura atual é **production-ready** porque:

1. ✅ Blockchain é a fonte de verdade (imutável, distribuída)
2. ✅ PDA garante endereço único e determinístico
3. ✅ localStorage é apenas cache (pode ser limpo sem problemas)
4. ✅ Funciona em qualquer dispositivo
5. ✅ Não precisa de backend/indexer
6. ✅ Simples de manter e debugar

**Único trade-off:** Um usuário = uma bet ativa por vez.
Para a maioria dos casos de uso (betting, escrow, etc), isso é perfeito! 🎯
