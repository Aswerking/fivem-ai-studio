import { useState, useEffect, useCallback } from 'react';
import { FIVEFORGE_MANIFEST } from '../manifest.js';

/**
 * Safe Bridge Adapters for FiveForge Modules
 * 
 * Provides decoupled state management for user authentication, credit economy,
 * and 3D event buses without interfering with existing application state.
 */

const STORAGE_KEYS = {
  CREDITS: 'fiveforge_user_credits',
  HISTORY: 'fiveforge_export_history',
  USER: 'fiveforge_user_profile'
};

export function useCurrentUser() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      // fallback
    }
    return {
      id: "usr_discord_77192",
      username: "FiveMCreator",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=FiveForge",
      plan: "Creator Pro",
      tier: "pro",
      discordLinked: true
    };
  });

  const updateProfile = useCallback((updates) => {
    setUser(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  return { user, updateProfile };
}

export function useCreditBalance() {
  const [credits, setCredits] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CREDITS);
      if (stored !== null) return parseInt(stored, 10);
    } catch (e) {}
    return 350; // Initial complimentary creator credits
  });

  const [exportHistory, setExportHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });

  // Persist credits
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CREDITS, credits.toString());
    } catch (e) {}
  }, [credits]);

  // Persist export history
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(exportHistory));
    } catch (e) {}
  }, [exportHistory]);

  /**
   * Deduct credits according to FiveForge rules.
   * Includes 7-day free re-export protection for modified files.
   */
  // Credits economy disabled — all exports are free for professional studio use
  const deductCredits = useCallback((_cost, assetIdentifier, toolName = 'Tool') => {
    const now = Date.now();
    setExportHistory(prev => [
      { identifier: assetIdentifier, toolName, cost: 0, timestamp: now },
      ...prev.slice(0, 49)
    ]);
    return {
      success: true,
      remaining: credits,
      freeReExport: true,
      deducted: 0,
      message: '✅ تم التصدير مجاناً — نظام العملات معطّل'
    };
  }, [credits]);

  const addCredits = useCallback((amount) => {
    setCredits(prev => Math.max(0, prev + amount));
  }, []);

  return {
    credits,
    deductCredits,
    addCredits,
    exportHistory
  };
}
