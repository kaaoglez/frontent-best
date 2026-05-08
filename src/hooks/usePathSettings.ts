'use client';

import { useCallback, useEffect } from 'react';

/**
 * Hook for loading and saving section-specific library paths from/to persistent settings.
 * Used by Library, Music, Movies, TV Shows, and Images sections.
 */
export function usePathSettings(
  settingsKey: string,
  setPaths: (paths: string[]) => void,
  setCurrentPath: (path: string) => void,
  setPathHistory: (history: string[]) => void,
) {
  const savePaths = useCallback(
    async (paths: string[]) => {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: settingsKey, value: JSON.stringify(paths) }),
      });
    },
    [settingsKey],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/settings?key=${settingsKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data.value) {
            const saved = JSON.parse(data.value) as string[];
            if (saved.length > 0) {
              setPaths(saved);
              setCurrentPath(saved[0]);
              setPathHistory([saved[0]]);
            }
          }
        }
      } catch {
        /* use defaults */
      }
    };
    load();
  }, [settingsKey, setPaths, setCurrentPath, setPathHistory]);

  return { savePaths };
}
