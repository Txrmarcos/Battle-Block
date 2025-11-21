use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("EqzTrTYgAttzSmVbjpm6t6SBUVT5Ab2zWVTxaYDE9iBF");

const MAX_PLAYERS: usize = 100;
const TOTAL_BLOCKS: u8 = 25;

#[program]
pub mod block_battle {
    use super::*;

    /// Create a new bet with initial parameters (MVP - 2 players minimum)
    pub fn create_bet(
        ctx: Context<CreateBet>,
        seed: u64,
        min_deposit: u64,
        arbiter: Pubkey,
        lock_time: i64,
    ) -> Result<()> {
        let bet = &mut ctx.accounts.bet;
        let creator = &ctx.accounts.creator;

        require!(min_deposit > 0, BetError::InvalidDepositAmount);
        require!(lock_time > Clock::get()?.unix_timestamp, BetError::InvalidLockTime);

        bet.creator = creator.key();
        bet.arbiter = arbiter;
        bet.min_deposit = min_deposit;
        bet.total_pool = 0;
        bet.lock_time = lock_time;
        bet.winner_block = None;
        bet.status = BetStatus::Open;
        bet.player_count = 0;
        bet.bump = ctx.bumps.bet;

        msg!("Bet created by: {}", creator.key());
        msg!("Min deposit: {} lamports", min_deposit);
        msg!("Lock time: {}", lock_time);
        msg!("Arbiter: {}", arbiter);

        Ok(())
    }

    /// Join an existing bet by choosing a block (Extra 2 - N players support)
    pub fn join_bet(
        ctx: Context<JoinBet>,
        chosen_block: u8,
        deposit_amount: u64,
    ) -> Result<()> {
        let bet = &mut ctx.accounts.bet;
        let player = &ctx.accounts.player;

        require!(bet.status == BetStatus::Open, BetError::BetNotOpen);
        require!(chosen_block > 0 && chosen_block <= TOTAL_BLOCKS, BetError::InvalidBlock);
        require!(deposit_amount >= bet.min_deposit, BetError::InsufficientDeposit);
        require!(bet.player_count < MAX_PLAYERS as u8, BetError::BetFull);

        // Check if player already joined
        for i in 0..bet.player_count as usize {
            require!(bet.players[i] != player.key(), BetError::AlreadyJoined);
        }

        // Transfer SOL to bet escrow
        let transfer_ix = system_program::Transfer {
            from: player.to_account_info(),
            to: bet.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix,
        );
        system_program::transfer(cpi_ctx, deposit_amount)?;

        // Record player data using push instead of indexing
        bet.players.push(player.key());
        bet.chosen_blocks.push(chosen_block);
        bet.deposits.push(deposit_amount);
        bet.claimed.push(false);
        bet.player_count += 1;
        bet.total_pool += deposit_amount;

        msg!("Player {} joined with block {} and {} lamports",
             player.key(), chosen_block, deposit_amount);
        msg!("Total pool: {} lamports", bet.total_pool);
        msg!("Total players: {}", bet.player_count);

        Ok(())
    }

    /// Arbiter reveals the winning block
    pub fn reveal_winner(
        ctx: Context<RevealWinner>,
        winning_block: u8,
    ) -> Result<()> {
        let bet = &mut ctx.accounts.bet;
        let arbiter = &ctx.accounts.arbiter;

        require!(bet.status == BetStatus::Open, BetError::BetNotOpen);
        require!(bet.arbiter == arbiter.key(), BetError::UnauthorizedArbiter);
        require!(winning_block > 0 && winning_block <= TOTAL_BLOCKS, BetError::InvalidBlock);
        // Arbiter can reveal at any time, no lock_time check needed
        require!(bet.player_count >= 2, BetError::NotEnoughPlayers);

        bet.winner_block = Some(winning_block);
        bet.status = BetStatus::Revealed;

        // Calculate winners
        let mut winner_count = 0;
        let mut total_winner_deposits = 0u64;

        for i in 0..bet.player_count as usize {
            if bet.chosen_blocks[i] == winning_block {
                winner_count += 1;
                total_winner_deposits += bet.deposits[i];
            }
        }

        require!(winner_count > 0, BetError::NoWinners);

        msg!("Winning block revealed: {}", winning_block);
        msg!("Winners: {}", winner_count);
        msg!("Total winner deposits: {} lamports", total_winner_deposits);

        Ok(())
    }

    /// Claim winnings (proportional distribution for multiple winners)
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let bet = &mut ctx.accounts.bet;
        let player = &ctx.accounts.player;

        require!(bet.status == BetStatus::Revealed, BetError::WinnerNotRevealed);

        // Find player index
        let mut player_idx: Option<usize> = None;
        for i in 0..bet.player_count as usize {
            if bet.players[i] == player.key() {
                player_idx = Some(i);
                break;
            }
        }

        let idx = player_idx.ok_or(BetError::PlayerNotFound)?;
        require!(!bet.claimed[idx], BetError::AlreadyClaimed);

        let winning_block = bet.winner_block.ok_or(BetError::WinnerNotRevealed)?;
        require!(bet.chosen_blocks[idx] == winning_block, BetError::NotAWinner);

        // Calculate proportional payout
        let player_deposit = bet.deposits[idx];
        let mut total_winner_deposits = 0u64;

        for i in 0..bet.player_count as usize {
            if bet.chosen_blocks[i] == winning_block {
                total_winner_deposits += bet.deposits[i];
            }
        }

        let payout = (bet.total_pool as u128)
            .checked_mul(player_deposit as u128)
            .unwrap()
            .checked_div(total_winner_deposits as u128)
            .unwrap() as u64;

        // Transfer payout
        **bet.to_account_info().try_borrow_mut_lamports()? -= payout;
        **player.to_account_info().try_borrow_mut_lamports()? += payout;

        bet.claimed[idx] = true;

        msg!("Player {} claimed {} lamports", player.key(), payout);
        msg!("Share: {}/{} of total pool", player_deposit, total_winner_deposits);

        Ok(())
    }

    /// Cancel bet if conditions not met (optional - Extra 3)
    pub fn cancel_bet(ctx: Context<CancelBet>) -> Result<()> {
        let bet = &mut ctx.accounts.bet;

        require!(bet.status == BetStatus::Open, BetError::BetNotOpen);

        // Allow cancellation if:
        // 1. Before lock time, OR
        // 2. After lock time but not enough players (can't reveal winner anyway)
        let current_time = Clock::get()?.unix_timestamp;
        if current_time >= bet.lock_time {
            require!(bet.player_count < 2, BetError::BetAlreadyLocked);
        }

        bet.status = BetStatus::Cancelled;

        msg!("Bet cancelled, account will be closed and lamports returned to creator");

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct CreateBet<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + BetAccount::INIT_SPACE,
        seeds = [b"bet", creator.key().as_ref(), &seed.to_le_bytes()],
        bump
    )]
    pub bet: Account<'info, BetAccount>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinBet<'info> {
    #[account(mut)]
    pub bet: Account<'info, BetAccount>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealWinner<'info> {
    #[account(mut)]
    pub bet: Account<'info, BetAccount>,
    pub arbiter: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub bet: Account<'info, BetAccount>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelBet<'info> {
    #[account(
        mut,
        close = creator,
        has_one = creator
    )]
    pub bet: Account<'info, BetAccount>,
    #[account(mut)]
    pub creator: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct BetAccount {
    pub creator: Pubkey,           // 32
    pub arbiter: Pubkey,           // 32
    pub min_deposit: u64,          // 8
    pub total_pool: u64,           // 8
    pub lock_time: i64,            // 8
    pub winner_block: Option<u8>,  // 1 + 1
    pub status: BetStatus,         // 1
    pub player_count: u8,          // 1
    pub bump: u8,                  // 1
    #[max_len(100)]
    pub players: Vec<Pubkey>,      // 4 + (32 * 100)
    #[max_len(100)]
    pub chosen_blocks: Vec<u8>,    // 4 + (1 * 100)
    #[max_len(100)]
    pub deposits: Vec<u64>,        // 4 + (8 * 100)
    #[max_len(100)]
    pub claimed: Vec<bool>,        // 4 + (1 * 100)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum BetStatus {
    Open,
    Revealed,
    Cancelled,
}

#[error_code]
pub enum BetError {
    #[msg("Invalid deposit amount")]
    InvalidDepositAmount,
    #[msg("Invalid lock time")]
    InvalidLockTime,
    #[msg("Bet is not open")]
    BetNotOpen,
    #[msg("Invalid block number (must be 1-25)")]
    InvalidBlock,
    #[msg("Insufficient deposit amount")]
    InsufficientDeposit,
    #[msg("Bet is full")]
    BetFull,
    #[msg("Player already joined this bet")]
    AlreadyJoined,
    #[msg("Unauthorized arbiter")]
    UnauthorizedArbiter,
    #[msg("Bet not locked yet")]
    BetNotLocked,
    #[msg("Not enough players (minimum 2)")]
    NotEnoughPlayers,
    #[msg("No winners for this block")]
    NoWinners,
    #[msg("Winner not revealed yet")]
    WinnerNotRevealed,
    #[msg("Player not found in this bet")]
    PlayerNotFound,
    #[msg("Already claimed winnings")]
    AlreadyClaimed,
    #[msg("Not a winner")]
    NotAWinner,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Bet already locked")]
    BetAlreadyLocked,
}
