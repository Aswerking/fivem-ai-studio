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
  USER: 'fiveforge_user_profile',
  CAR_DRAFT: 'fiveforge_car_studio_draft_v1'
};

/** Load last car-studio settings so refresh / accidental close doesn't wipe work. */
export function loadCarStudioDraft() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEYS.CAR_DRAFT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist serializable car-studio fields only (never blob: URLs). */
export function saveCarStudioDraft(draft) {
  try {
    if (typeof localStorage === 'undefined' || !draft) return;
    localStorage.setItem(
      STORAGE_KEYS.CAR_DRAFT,
      JSON.stringify({ ...draft, savedAt: Date.now() })
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearCarStudioDraft() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.CAR_DRAFT);
  } catch {
    /* ignore */
  }
}

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
