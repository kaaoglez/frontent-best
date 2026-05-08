'use client';

import { useCallback } from 'react';

/**
 * Generic navigation hook for file-system-like path browsing.
 * Used by Library, Music, Movies, TV Shows, Images, and Disk Explorer sections.
 */
export function useNavigation(
  currentPath: string,
  pathHistory: string[],
  setCurrentPath: (p: string) => void,
  setPathHistory: (h: string[]) => void,
) {
  const navigateTo = useCallback(
    (p: string) => {
      setPathHistory([...pathHistory, p]);
      setCurrentPath(p);
    },
    [pathHistory, setCurrentPath, setPathHistory],
  );

  const goBack = useCallback(() => {
    if (pathHistory.length > 1) {
      const h = [...pathHistory];
      h.pop();
      setPathHistory(h);
      setCurrentPath(pathHistory[pathHistory.length - 2]);
    }
  }, [pathHistory, setCurrentPath, setPathHistory]);

  const goUp = useCallback(() => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== currentPath) {
      navigateTo(parent);
    }
  }, [currentPath, navigateTo]);

  return { navigateTo, goBack, goUp };
}
