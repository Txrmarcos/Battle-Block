# Block Battle - Frontend

Modern, clean frontend for the Block Battle Solana betting platform.

## Features

- 🎯 **Create Bets** - Start new block battles with customizable parameters
- 🎲 **Join Bets** - Enter existing battles and choose your block
- 👑 **Manage Bets** - Reveal winners (arbiter) or claim prizes (winners)
- ⚡ **Real-time Updates** - Live bet data from Solana blockchain
- 🔒 **Wallet Integration** - Support for Phantom, Solflare, and more
- 📱 **Responsive Design** - Works on desktop and mobile

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Solana Web3.js** - Blockchain interaction
- **Anchor** - Solana program framework
- **React Hot Toast** - Notifications

## Getting Started

### Install Dependencies

```bash
npm install
# or
yarn install
```

### Run Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Program Details

- **Program ID**: `EqzTrTYgAttzSmVbjpm6t6SBUVT5Ab2zWVTxaYDE9iBF`
- **Network**: Devnet
- **Cluster**: `https://api.devnet.solana.com`

## How to Use

1. **Connect Wallet** - Click "Select Wallet" and connect your Solana wallet
2. **Create a Bet** - Set minimum deposit, arbiter address, and lock time
3. **Join a Bet** - Enter bet address, choose block (1-25), and deposit SOL
4. **Reveal Winner** - Arbiter reveals winning block after lock time
5. **Claim Prize** - Winners claim their share of the pot

## Folder Structure

```
src/
├── app/              # Next.js pages
├── components/       # React components
├── lib/             # Utils and hooks
└── idl/             # Anchor IDL
```

## Build for Production

```bash
npm run build
npm start
```

## License

ISC
