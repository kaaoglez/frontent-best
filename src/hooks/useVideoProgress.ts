'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface VideoProgressData {
  position: number;
  duration: number;
  updatedAt: string;
}

interface UseVideoProgressOptions {
  videoPath: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  minResumeSeconds?: number;
  saveInterval?: number;
}

const STORAGE_KEY_PREFIX = 'video_progress_';

function getStorageKey(path: string): string {
  return STORAGE_KEY_PREFIX + path;
}

function loadFromStorage(path: string): VideoProgressData | null {
  try {
    const raw = localStorage.getItem(getStorageKey(path));
    if (!raw) return null;
    return JSON.parse(raw) as VideoProgressData;
  } catch {
    return null;
  }
}

function saveToStorage(path: string, position: number, duration: number): void {
  try {
    localStorage.setItem(getStorageKey(path), JSON.stringify({
      position,
      duration,
      updatedAt: new Date().toISOString(),
    }));
  } catch { /* storage full or unavailable */ }
}

function removeFromStorage(path: string): void {
  try {
    localStorage.removeItem(getStorageKey(path));
  } catch { /* ignore */ }
}

export function useVideoProgress({
  videoPath,
  videoRef,
  minResumeSeconds = 30,
  saveInterval = 10,
}: UseVideoProgressOptions) {
  const [savedProgress, setSavedProgress] = useState<VideoProgressData | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [hasResumed, setHasResumed] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLoadedPathRef = useRef<string | null>(null);
  const videoPathRef = useRef(videoPath);

  useEffect(() => {
    videoPathRef.current = videoPath;
  }, [videoPath]);

  const formatTime = useCallback((seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }, []);

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearInterval(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const saveCurrentPosition = useCallback(() => {
    const path = videoPathRef.current;
    if (!videoRef.current || !path) return;

    const video = videoRef.current;
    const position = video.currentTime;
    const duration = video.duration || 0;

    if (position < 2) return;

    // If video ended (within last 2 seconds), remove saved progress
    if (duration > 0 && position >= duration - 2) {
      removeFromStorage(path);
      return;
    }

    saveToStorage(path, position, duration);
  }, [videoRef]);

  const startSaveTimer = useCallback(() => {
    clearSaveTimer();
    saveTimerRef.current = setInterval(() => {
      saveCurrentPosition();
    }, saveInterval * 1000);
  }, [clearSaveTimer, saveCurrentPosition, saveInterval]);

  // Load progress when videoPath changes
  useEffect(() => {
    clearSaveTimer();

    if (!videoPath) {
      lastLoadedPathRef.current = null;
      return;
    }

    if (videoPath === lastLoadedPathRef.current) return;
    lastLoadedPathRef.current = videoPath;

    const applyProgress = () => {
      const progress = loadFromStorage(videoPath);

      if (progress && progress.position > minResumeSeconds) {
        setSavedProgress(progress);
        setShowResumePrompt(true);
        setHasResumed(false);
        if (videoRef.current) {
          videoRef.current.pause();
        }
      } else {
        setSavedProgress(null);
        setShowResumePrompt(false);
        setHasResumed(false);
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      }
    };

    // Use microtask to avoid synchronous setState in effect
    queueMicrotask(applyProgress);
  }, [videoPath, minResumeSeconds, clearSaveTimer]);

  const resumeFromSaved = useCallback(() => {
    if (savedProgress && videoRef.current) {
      videoRef.current.currentTime = savedProgress.position;
      videoRef.current.play().catch(() => {});
    }
    setShowResumePrompt(false);
    setHasResumed(true);
  }, [savedProgress, videoRef]);

  const startFromBeginning = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    setShowResumePrompt(false);
    setHasResumed(true);
  }, [videoRef]);

  // Attach video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoPath) return;

    const onPlay = () => startSaveTimer();
    const onPause = () => {
      clearSaveTimer();
      saveCurrentPosition();
    };
    const onEnded = () => {
      clearSaveTimer();
      removeFromStorage(videoPath);
    };
    const onSeeked = () => saveCurrentPosition();

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('seeked', onSeeked);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('seeked', onSeeked);
      clearSaveTimer();
      // Save final position on unmount
      saveCurrentPosition();
    };
  }, [videoRef, videoPath, startSaveTimer, clearSaveTimer, saveCurrentPosition]);

  return {
    savedProgress,
    showResumePrompt,
    hasResumed,
    resumeFromSaved,
    startFromBeginning,
    formatTime,
  };
}
