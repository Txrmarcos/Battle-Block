import { useState, useCallback, useEffect } from "react";

export interface RevealState {
  isRevealing: boolean;
  isComplete: boolean;
  showVictory: boolean;
  winnerBlock: number | null;
}

export function useDungeonReveal() {
  const [state, setState] = useState<RevealState>({
    isRevealing: false,
    isComplete: false,
    showVictory: false,
    winnerBlock: null,
  });

  const startReveal = useCallback((winnerBlock: number, playerBlock?: number) => {
    setState({
      isRevealing: true,
      isComplete: false,
      showVictory: false,
      winnerBlock,
    });

    // Total reveal time: ~3 seconds (24 doors * 100ms + 500ms winner delay)
    const revealDuration = 24 * 100 + 500 + 1000; // Extra 1s for winner animation

    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        isComplete: true,
      }));

      // Show victory modal if player won
      if (playerBlock && playerBlock === winnerBlock) {
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            showVictory: true,
          }));
        }, 1500); // Delay to let winner animation play
      }
    }, revealDuration);
  }, []);

  const reset = useCallback(() => {
    setState({
      isRevealing: false,
      isComplete: false,
      showVictory: false,
      winnerBlock: null,
    });
  }, []);

  const closeVictory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showVictory: false,
    }));
  }, []);

  return {
    ...state,
    startReveal,
    reset,
    closeVictory,
  };
}
