/**
 * Solana Explorer utilities
 */

export const CLUSTER = "devnet";

/**
 * Get Solana Explorer URL for a transaction
 */
export function getExplorerUrl(signature: string, type: "tx" | "address" = "tx"): string {
  return `https://explorer.solana.com/${type}/${signature}?cluster=${CLUSTER}`;
}

/**
 * Get Solana Explorer URL for an account/address
 */
export function getExplorerAddressUrl(address: string): string {
  return getExplorerUrl(address, "address");
}

/**
 * Open Solana Explorer in new tab
 */
export function openExplorer(signature: string, type: "tx" | "address" = "tx"): void {
  window.open(getExplorerUrl(signature, type), "_blank", "noopener,noreferrer");
}
