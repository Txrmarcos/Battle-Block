# 🏆 Block Battle - Solana Betting Protocol

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana)](https://explorer.solana.com/address/EqzTrTYgAttzSmVbjpm6t6SBUVT5Ab2zWVTxaYDE9iBF?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-0.31.1-coral)](https://www.anchor-lang.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

> **Solana Hacker Hotel DevCon 2025 - Buenos Aires**
> Built for the "Building on Solana" Bootcamp Bounty Challenge

A decentralized betting protocol on Solana that enables trustless wagering between participants with a designated arbiter system or automatic winner revelation.

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Live Demo](#-live-demo)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Smart Contract](#-smart-contract)
- [Frontend Application](#-frontend-application)
- [Testing](#-testing)
- [Security](#-security)
- [Bounty Requirements](#-bounty-requirements)
- [License](#-license)

## 🎯 Overview

Block Battle is a fully on-chain betting protocol that implements:

- **Trustless escrow** - SOL deposits held securely by the program
- **Flexible winner selection** - Arbiter-based or automatic random reveal
- **Multi-party support** - Up to 100 players per bet
- **Proportional payouts** - Fair distribution for group betting
- **Pixel dungeon UI** - Engaging retro-themed interface

### Why Block Battle?

Traditional betting platforms require trust in centralized operators. Block Battle eliminates this by:

✅ Storing all funds on-chain in program-controlled accounts
✅ Using cryptographic verification for all operations
✅ Enabling transparent, auditable game outcomes
✅ Providing instant, permissionless payouts

## ✨ Features

### Core Features (MVP)

- ✅ **Two-Party Betting System**
  - Minimum 2 players required
  - SOL deposits held in escrow
  - Secure fund management

- ✅ **Arbiter Mechanism**
  - Designated arbiter can declare winner
  - Authorization checks prevent tampering
  - Time-locked reveal option

- ✅ **Payout System**
  - Winners claim full prize pool
  - Protection against double-spending
  - Secure withdrawal mechanism

- ✅ **Client Application**
  - Create bets with custom parameters
  - Join existing pools
  - Check bet status in real-time
  - Declare winner (arbiter)
  - Claim winnings (winners)
  - Time remaining display

### Bonus Features (+$100)

- ✅ **Extra 1: Group Betting**
  - Multiple users can bet on the same outcome
  - Proportional payout system based on deposit amounts
  - Individual contribution tracking

- ✅ **Extra 2: Multi-Party Competitions**
  - Supports up to 100 participants
  - 25 different blocks (doors) to choose from
  - Flexible winner selection from participant pool
  - Complex payout distribution handling

- ✅ **Extra 3: Creative Features**
  - **Automatic Mode**: On-chain randomness for trustless reveals
  - **Arbiter Mode**: Manual winner declaration by designated judge
  - **Cancellation System**: Refund mechanism for invalid bets
  - **Pixel Dungeon Theme**: Unique retro-gaming UI/UX
  - **Door/Trap System**: 25 doors with different trap types
  - **Victory Modal**: Animated winner celebration
  - **Multi-Dungeon Management**: Track created and joined bets
  - **Share Links**: Easy bet sharing via URL parameters

## 🚀 Live Demo

### Deployed Program
- **Video Demo**: [View on YouTube](https://www.youtube.com/watch?v=PTynN_-ObuY)
- **Program ID**: `EqzTrTYgAttzSmVbjpm6t6SBUVT5Ab2zWVTxaYDE9iBF`
- **Network**: Solana Devnet
- **Explorer**: [View on Solana Explorer](https://explorer.solana.com/address/EqzTrTYgAttzSmVbjpm6t6SBUVT5Ab2zWVTxaYDE9iBF?cluster=devnet)

### Frontend Application
- **Framework**: Next.js 14
- **Run Locally**: See [Getting Started](#-getting-started)

## 🏗 Architecture

### Smart Contract Design

```
┌─────────────────────────────────────────────────────────┐
│                    BetAccount (PDA)                      │
├─────────────────────────────────────────────────────────┤
│ creator: Pubkey                                          │
│ arbiter: Pubkey                                          │
│ min_deposit: u64                                         │
│ total_pool: u64                                          │
│ lock_time: i64                                           │
│ winner_block: Option<u8>                                 │
│ status: BetStatus (Open/Revealed/Cancelled)              │
│ is_automatic: bool                                       │
│ players: Vec<Pubkey> (max 100)                           │
│ chosen_blocks: Vec<u8> (1-25)                            │
│ deposits: Vec<u64>                                       │
│ claimed: Vec<bool>                                       │
└─────────────────────────────────────────────────────────┘
```

### Program Instructions

1. **create_bet** - Initialize new betting pool
2. **join_bet** - Participate and deposit SOL
3. **reveal_winner** - Arbiter declares winner (manual mode)
4. **auto_reveal_winner** - Automatic random reveal (auto mode)
5. **claim_winnings** - Winners withdraw proportional share
6. **cancel_bet** - Creator cancels before lock time

### Data Flow

```
User A (Creator)           User B (Player)           User C (Arbiter/Auto)
     │                          │                            │
     │ create_bet()             │                            │
     ├──────────────────────────┼────────────────────────────┤
     │                          │                            │
     │                     join_bet()                        │
     │                          ├────────────────────────────┤
     │                          │ (SOL → Escrow)             │
     │                          │                            │
     │                          │      reveal_winner()       │
     │                          │            or              │
     │                          │    auto_reveal_winner()    │
     │                          │◄───────────────────────────┤
     │                          │                            │
     │                  claim_winnings()                     │
     │                          ├────────────────────────────┤
     │                          │ (Escrow → Winner)          │
     │                          │                            │
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Rust 1.70+
- Solana CLI 1.18+
- Anchor CLI 0.31.1
- A Solana wallet (Phantom, Solflare, etc.)
- Devnet SOL for testing

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/SOLANA-BET-BUENOS-AIRES.git
cd SOLANA-BET-BUENOS-AIRES
```

2. **Install dependencies**
```bash
# Install Anchor dependencies
yarn install

# Install frontend dependencies
cd app
npm install
cd ..
```

3. **Build the program**
```bash
anchor build
```

4. **Deploy to Devnet** (optional - already deployed)
```bash
# Configure Solana to use devnet
solana config set --url devnet

# Deploy
anchor deploy
```

5. **Run the frontend**
```bash
cd app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Airdrop Devnet SOL

```bash
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```

## 🔧 Smart Contract

### Technology Stack

- **Language**: Rust
- **Framework**: Anchor 0.31.1
- **Network**: Solana Devnet
- **Storage**: On-chain PDAs (Program Derived Addresses)

### Key Features

**Security Measures**:
- ✅ Authorization checks for arbiter
- ✅ Double-spending prevention with `claimed` flags
- ✅ Overflow protection with `checked_mul` and `checked_div`
- ✅ Input validation for all parameters
- ✅ Status verification before state changes

**Error Handling**:
- Custom error codes for all failure scenarios
- Descriptive error messages
- Proper revert on invalid operations

### Program Structure

```
programs/block-battle/src/
└── lib.rs              # Main program logic
    ├── Instructions    # create_bet, join_bet, reveal_winner, etc.
    ├── Accounts        # CreateBet, JoinBet, RevealWinner, etc.
    ├── State           # BetAccount, BetStatus enum
    └── Errors          # BetError enum
```

### Build & Deploy

```bash
# Build
anchor build

# Test
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## 💻 Frontend Application

### Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: @solana/web3.js, @coral-xyz/anchor
- **Wallet**: @solana/wallet-adapter
- **Notifications**: react-hot-toast
- **Animations**: framer-motion

### Project Structure

```
app/src/
├── app/
│   └── page.tsx              # Main application page
├── components/
│   ├── CreateBet.tsx         # Create new bet form
│   ├── JoinBet.tsx           # Join existing bet
│   ├── ManageBet.tsx         # Manage created/joined bets
│   ├── OpenBets.tsx          # Browse active bets
│   ├── QuickPlayPixel.tsx    # Play interface
│   └── pixel-dungeon/        # UI components
│       ├── DungeonHeader.tsx
│       ├── DungeonLayout.tsx
│       ├── PixelDoor.tsx
│       ├── PixelDungeonGrid.tsx
│       └── VictoryModal.tsx
├── lib/
│   ├── anchor.ts             # Anchor program setup
│   └── useBlockBattle.ts     # Custom hook for contract interaction
└── hooks/
    ├── useBetsList.ts        # Fetch all bets
    └── useDungeonReveal.ts   # Winner reveal animation
```

### Features

**User Interface**:
- 🎨 Pixel dungeon theme with retro aesthetics
- 🌙 Dark mode optimized
- 📱 Fully responsive design
- ⚡ Real-time bet status updates
- 🎬 Smooth animations and transitions

**Wallet Integration**:
- Multiple wallet support (Phantom, Solflare, etc.)
- Auto-connect functionality
- Network detection
- Balance display

**Bet Management**:
- Create automatic or arbiter-based bets
- Browse all active bets
- Join with custom deposit amounts
- Track created and joined bets separately
- Reveal winners (arbiter)
- Claim winnings (winners)

## 🧪 Testing

### Run Tests

```bash
# Unit tests
anchor test

# Integration tests
cd app
npm run test
```

### Manual Testing Flow

1. **Connect Wallet** (ensure you're on Devnet)
2. **Create Bet**:
   - Choose automatic or arbiter mode
   - Set minimum deposit (e.g., 0.1 SOL)
   - Set lock time (for automatic mode)
   - Click "Forge Dungeon"
3. **Join Bet**:
   - Browse active dungeons
   - Select a door (1-25)
   - Deposit SOL (≥ minimum)
   - Click "Enter"
4. **Reveal Winner**:
   - **Automatic**: Wait for lock time, click "Auto-Reveal"
   - **Arbiter**: Select winning door, click "Reveal"
5. **Claim Winnings**:
   - If you won, click "Claim Treasure"
   - Receive proportional share of pool

## 🔒 Security

### Smart Contract Security

**Implemented Protections**:
- ✅ **Access Control**: Only arbiter can manually reveal winners
- ✅ **Double-Spending**: Claimed flag prevents multiple withdrawals
- ✅ **Integer Overflow**: Using checked arithmetic operations
- ✅ **Input Validation**: All parameters validated before processing
- ✅ **State Verification**: Status checks before state transitions
- ✅ **Re-entrancy**: Anchor framework protection

**Potential Improvements**:
- Add time-locks for arbiter reveals (currently arbiter can reveal anytime)
- Implement fee mechanism for sustainability
- Add dispute resolution system

### Known Limitations

1. **Randomness**: Automatic mode uses on-chain pseudo-randomness (timestamp + slot). For production, consider using Chainlink VRF or similar.
2. **Single Bet per Creator**: Current PDA design allows one active bet per creator. See `ARCHITECTURE.md` for multi-bet solutions.

## 📊 Bounty Requirements

### ✅ Mandatory Requirements

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Two-party betting system | ✅ | `join_bet()` with escrow |
| Same amount deposits | ⚠️ Enhanced | Supports variable deposits |
| Arbiter mechanism | ✅ | `reveal_winner()` |
| Time-locked reveal | ✅ | `lock_time` + `auto_reveal_winner()` |
| Payout system | ✅ | `claim_winnings()` with proportional distribution |
| Client application | ✅ | Next.js 14 web app |
| All required functions | ✅ | Create, join, status, reveal, withdraw |

### ✅ Bonus Features (+$100)

| Extra | Status | Description |
|-------|--------|-------------|
| Extra 1: Group Betting | ✅ | Multiple players on same block, proportional payouts |
| Extra 2: Multi-Party | ✅ | Up to 100 players, 25 blocks, flexible winner selection |
| Extra 3: Creative Features | ✅ | Auto mode, cancellation, pixel UI, share links, etc. |

### ✅ Technical Specifications

- ✅ Rust with Anchor Framework
- ✅ Deployed on Solana Devnet
- ✅ Proper error handling and validation
- ✅ Secure against common attack vectors
- ✅ TypeScript client with @solana/web3.js
- ✅ Clean UI with wallet integration
- ✅ Transaction status feedback

### ✅ Submission Requirements

- ✅ GitHub repository with source code
- ✅ README with setup instructions
- ✅ Deployed program ID: `EqzTrTYgAttzSmVbjpm6t6SBUVT5Ab2zWVTxaYDE9iBF`
- ✅ Working client (run locally with `npm run dev`)
- ✅ Documentation of approach and design decisions
- ✅ Known limitations documented

## 📚 Documentation

### Additional Resources

- [PITCH_DECK.pptx](PITCH_DECK.pptx) - Complete pitch deck for corporate presentations (40+ slides)
- [PIXEL_DUNGEON_FLOW.md](PIXEL_DUNGEON_FLOW.md) - Complete game flow with step-by-step walkthrough
- [Frontend README](app/README.md) - Detailed frontend documentation
- [Anchor Docs](https://www.anchor-lang.com/) - Anchor framework documentation
- [Solana Docs](https://docs.solana.com/) - Solana blockchain documentation

### Design Decisions

**Why Anchor?**
- Type-safe program development
- Automatic account validation
- Built-in error handling
- Better developer experience

**Why Next.js?**
- Server-side rendering for better SEO
- Optimal performance with App Router
- TypeScript support out of the box
- Great developer experience

**Why Pixel Dungeon Theme?**
- Unique, memorable user experience
- Gamification increases engagement
- Differentiates from generic betting UIs
- Fun and educational for hackathon demo

## 🎯 Future Improvements

### Planned Features

- [ ] **Verifiable Randomness**: Integrate Chainlink VRF for provably fair random reveals
- [ ] **Multi-Bet Support**: Allow creators to have multiple active bets
- [ ] **Tournament Mode**: Multi-round competitions with brackets
- [ ] **NFT Integration**: Mint winner NFTs as trophies
- [ ] **Fee Mechanism**: Small protocol fee for sustainability
- [ ] **Betting History**: On-chain event logs and analytics
- [ ] **Mobile App**: Native iOS/Android applications
- [ ] **Social Features**: Leaderboards, achievements, profiles

### Performance Optimizations

- Implement bet indexing for faster queries
- Add caching layer for better UX
- Optimize RPC calls with batching
- Implement pagination for large bet lists
  

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Superteam Brasil** - For organizing the Solana Hacker Hotel bootcamp

---

<div align="center">

**Built on Solana • Powered by Anchor • Designed for Gamers**

[Report Bug](https://github.com/yourusername/SOLANA-BET-BUENOS-AIRES/issues) · [Request Feature](https://github.com/yourusername/SOLANA-BET-BUENOS-AIRES/issues)

Made with 🔥 in Buenos Aires 🇦🇷

</div>
