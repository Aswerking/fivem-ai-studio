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
  // sessionStorage = per-tab only. localStorage was syncing two browser windows live.
  CAR_DRAFT: 'fiveforge_car_studio_draft_v2',
  CAR_DRAFT_LEGACY: 'fiveforge_car_studio_draft_v1'
};

function parseDraft(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Load car-studio draft for THIS browser tab only (sessionStorage).
 * Migrates legacy localStorage draft once, then deletes it so other tabs stop sharing.
 */
export function loadCarStudioDraft() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const fromSession = parseDraft(sessionStorage.getItem(STORAGE_KEYS.CAR_DRAFT));
      if (fromSession) return fromSession;
    }
    // One-time migrate from old shared localStorage key
    if (typeof localStorage !== 'undefined') {
      const legacy = parseDraft(localStorage.getItem(STORAGE_KEYS.CAR_DRAFT_LEGACY));
      if (legacy) {
        try {
          sessionStorage?.setItem(STORAGE_KEYS.CAR_DRAFT, JSON.stringify(legacy));
        } catch {
          /* ignore */
        }
        try {
          localStorage.removeItem(STORAGE_KEYS.CAR_DRAFT_LEGACY);
        } catch {
          /* ignore */
        }
        return legacy;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist serializable car-studio fields for this tab only (never blob: URLs). */
export function saveCarStudioDraft(draft) {
  try {
    if (typeof sessionStorage === 'undefined' || !draft) return;
    sessionStorage.setItem(
      STORAGE_KEYS.CAR_DRAFT,
      JSON.stringify({ ...draft, savedAt: Date.now() })
    );
    // Kill legacy shared key so a second window can't keep overwriting this session
    try {
      localStorage?.removeItem(STORAGE_KEYS.CAR_DRAFT_LEGACY);
    } catch {
      /* ignore */
    }
  } catch {
    /* quota / private mode */
  }
}

export function clearCarStudioDraft() {
  try {
    sessionStorage?.removeItem(STORAGE_KEYS.CAR_DRAFT);
    localStorage?.removeItem(STORAGE_KEYS.CAR_DRAFT_LEGACY);
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
