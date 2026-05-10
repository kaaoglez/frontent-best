'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { srtToVtt, detectSubtitleFormat } from '@/lib/subtitle-utils';

export interface SubtitleTrack {
  name: string;
  path: string;
  language: string;
  label: string;
}

interface UseVideoSubtitlesOptions {
  videoPath: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useVideoSubtitles({ videoPath, videoRef }: UseVideoSubtitlesOptions) {
  const [availableSubtitles, setAvailableSubtitles] = useState<SubtitleTrack[]>([]);
  const [activeTrack, setActiveTrack] = useState<SubtitleTrack | null>(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [loadingSubtitles, setLoadingSubtitles] = useState(false);
  const trackElementRef = useRef<HTMLTrackElement | null>(null);

  // Remove existing track element from the video
  const removeExistingTrack = useCallback(() => {
    if (trackElementRef.current && videoRef.current) {
      try {
        videoRef.current.removeChild(trackElementRef.current);
      } catch {
        // Element may already be detached
      }
      trackElementRef.current = null;
    }
  }, [videoRef]);

  // Enable all text tracks on the video element
  const enableTextTracks = useCallback(() => {
    if (videoRef.current?.textTracks.length) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode = 'showing';
      }
    }
  }, [videoRef]);

  // Fetch available subtitles when video changes
  useEffect(() => {
    // Reset state
    setAvailableSubtitles([]);
    setActiveTrack(null);
    setSubtitlesEnabled(false);
    removeExistingTrack();

    if (!videoPath) return;

    const fetchSubtitles = async () => {
      try {
        const res = await fetch(`/api/media/subtitles?path=${encodeURIComponent(videoPath)}`);
        if (res.ok) {
          const data = await res.json();
          setAvailableSubtitles(data.subtitles || []);
        }
      } catch {
        /* ignore */
      }
    };

    fetchSubtitles();
  }, [videoPath, removeExistingTrack]);

  // Load and apply a subtitle track
  const loadSubtitle = useCallback(async (track: SubtitleTrack) => {
    if (!videoRef.current) return;

    setLoadingSubtitles(true);
    try {
      // Fetch subtitle content
      const res = await fetch(`/api/media/stream?path=${encodeURIComponent(track.path)}`);
      if (!res.ok) throw new Error('Failed to fetch subtitle');

      let content = await res.text();

      // Detect format and convert if needed
      const format = detectSubtitleFormat(content);
      if (format === 'srt') {
        content = srtToVtt(content);
      } else if (format !== 'vtt') {
        throw new Error('Unsupported subtitle format');
      }

      // Create blob URL
      const blob = new Blob([content], { type: 'text/vtt' });
      const url = URL.createObjectURL(blob);

      // Remove existing track
      removeExistingTrack();

      // Create and add new track element
      const trackEl = document.createElement('track');
      trackEl.kind = 'subtitles';
      trackEl.label = track.label;
      trackEl.srclang = track.language;
      trackEl.src = url;
      trackEl.default = true;

      videoRef.current.appendChild(trackEl);
      trackElementRef.current = trackEl;

      // Enable the track once loaded
      trackEl.addEventListener('load', () => {
        enableTextTracks();
        setLoadingSubtitles(false);
      });

      trackEl.addEventListener('error', () => {
        setLoadingSubtitles(false);
      });

      setActiveTrack(track);
      setSubtitlesEnabled(true);

      // Fallback: force enable after a short delay
      setTimeout(() => {
        enableTextTracks();
        setLoadingSubtitles(false);
      }, 500);
    } catch (err) {
      console.error('Error loading subtitle:', err);
      setLoadingSubtitles(false);
    }
  }, [videoRef, removeExistingTrack, enableTextTracks]);

  // Load subtitle from uploaded file
  const loadSubtitleFromFile = useCallback(async (file: File) => {
    if (!videoRef.current) return;

    setLoadingSubtitles(true);
    try {
      const content = await file.text();
      const format = detectSubtitleFormat(content);

      let vttContent: string;
      if (format === 'srt') {
        vttContent = srtToVtt(content);
      } else if (format === 'vtt') {
        vttContent = content;
      } else {
        throw new Error('Unsupported format. Use .srt or .vtt files.');
      }

      const blob = new Blob([vttContent], { type: 'text/vtt' });
      const url = URL.createObjectURL(blob);

      removeExistingTrack();

      const trackEl = document.createElement('track');
      trackEl.kind = 'subtitles';
      trackEl.label = file.name;
      trackEl.srclang = 'und';
      trackEl.src = url;
      trackEl.default = true;

      videoRef.current.appendChild(trackEl);
      trackElementRef.current = trackEl;

      trackEl.addEventListener('load', () => {
        enableTextTracks();
        setLoadingSubtitles(false);
      });

      // Fallback: force enable after a short delay
      setTimeout(() => {
        enableTextTracks();
        setLoadingSubtitles(false);
      }, 500);

      const track: SubtitleTrack = {
        name: file.name,
        path: '',
        language: 'und',
        label: file.name.replace(/\.[^.]+$/, ''),
      };

      setActiveTrack(track);
      setSubtitlesEnabled(true);
    } catch (err) {
      console.error('Error loading subtitle file:', err);
      setLoadingSubtitles(false);
    }
  }, [videoRef, removeExistingTrack, enableTextTracks]);

  // Toggle subtitles on/off
  const toggleSubtitles = useCallback(() => {
    if (!videoRef.current) return;

    if (subtitlesEnabled) {
      // Disable all tracks
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode = 'disabled';
      }
      setSubtitlesEnabled(false);
    } else if (activeTrack) {
      // Enable all tracks
      enableTextTracks();
      setSubtitlesEnabled(true);
    }
  }, [subtitlesEnabled, activeTrack, videoRef, enableTextTracks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      removeExistingTrack();
    };
  }, [removeExistingTrack]);

  return {
    availableSubtitles,
    activeTrack,
    subtitlesEnabled,
    loadingSubtitles,
    loadSubtitle,
    loadSubtitleFromFile,
    toggleSubtitles,
  };
}
