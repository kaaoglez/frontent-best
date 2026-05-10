'use client';

import { useState, useEffect, useCallback } from 'react';

export type PlayerOption = 'browser' | 'vlc' | 'iina' | 'mpv' | 'mxplayer' | 'nplayer' | 'potplayer';

export interface PlayerInfo {
  id: PlayerOption;
  label: string;
  description: string;
  icon: string;
  platforms: ('desktop' | 'mobile' | 'android' | 'ios' | 'mac' | 'windows' | 'linux')[];
  protocol?: string;
  urlTemplate?: string;
}

export const PLAYER_OPTIONS: PlayerInfo[] = [
  {
    id: 'browser',
    label: 'Navegador',
    description: 'Reproducir directamente en la página',
    icon: '🌐',
    platforms: ['desktop', 'mobile'],
  },
  {
    id: 'vlc',
    label: 'VLC',
    description: 'Reproductor VLC (disponible en PC y móvil)',
    icon: '🟠',
    platforms: ['desktop', 'android', 'ios'],
    protocol: 'vlc',
  },
  {
    id: 'iina',
    label: 'IINA',
    description: 'Reproductor moderno para Mac',
    icon: '🎬',
    platforms: ['mac'],
    urlTemplate: 'iina://weblink?url={url}',
  },
  {
    id: 'mpv',
    label: 'MPV',
    description: 'Reproductor ligero para Linux/PC',
    icon: '▶️',
    platforms: ['linux', 'windows'],
    protocol: 'mpv',
  },
  {
    id: 'potplayer',
    label: 'PotPlayer',
    description: 'Reproductor para Windows',
    icon: '🔵',
    platforms: ['windows'],
    protocol: 'potplayer',
  },
  {
    id: 'mxplayer',
    label: 'MX Player',
    description: 'Reproductor para Android',
    icon: '🟣',
    platforms: ['android'],
    urlTemplate: 'intent:{url}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;end',
  },
  {
    id: 'nplayer',
    label: 'nPlayer',
    description: 'Reproductor para iOS',
    icon: '🔵',
    platforms: ['ios'],
    urlTemplate: 'nplayer-{url}',
  },
];

const STORAGE_KEY = 'media_player_preference';

function detectPlatform(): 'desktop' | 'mobile' {
  if (typeof window === 'undefined') return 'desktop';
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

function detectOS(): string {
  if (typeof window === 'undefined') return 'linux';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac OS X/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  return 'linux';
}

function getAvailablePlayers(): PlayerInfo[] {
  const platform = detectPlatform();
  const os = detectOS();
  return PLAYER_OPTIONS.filter((p) => {
    if (p.platforms.includes('desktop') && platform === 'desktop') return true;
    if (p.platforms.includes('mobile') && platform === 'mobile') return true;
    return p.platforms.includes(os as PlayerInfo['platforms'][number]);
  });
}

export function getStreamUrl(path: string): string {
  return `${window.location.origin}/api/media/stream?path=${encodeURIComponent(path)}`;
}

function buildLaunchUrl(player: PlayerInfo, streamUrl: string): string {
  if (player.urlTemplate) {
    return player.urlTemplate.replace('{url}', encodeURIComponent(streamUrl));
  }
  if (player.protocol) {
    return `${player.protocol}://${streamUrl}`;
  }
  return streamUrl;
}

export function launchPlayer(player: PlayerInfo, path: string): boolean {
  const streamUrl = getStreamUrl(path);
  const launchUrl = buildLaunchUrl(player, streamUrl);

  // Try to open via protocol / custom URL
  const frame = document.createElement('iframe');
  frame.style.display = 'none';
  document.body.appendChild(frame);
  try {
    frame.contentWindow?.location.assign(launchUrl);
  } catch {
    window.open(launchUrl, '_blank');
  }
  // Clean up iframe after a short delay
  setTimeout(() => {
    document.body.removeChild(frame);
  }, 2000);

  return true;
}

export function usePlayerPreference() {
  const getInitialPreference = (): PlayerOption | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY) as PlayerOption | null;
  };

  const [preference, setPreference] = useState<PlayerOption | null>(getInitialPreference);
  const [hasSelected, setHasSelected] = useState(() => !!getInitialPreference());
  const [availablePlayers] = useState<PlayerInfo[]>(() => {
    if (typeof window === 'undefined') return [];
    return getAvailablePlayers();
  });

  const savePreference = useCallback((player: PlayerOption) => {
    localStorage.setItem(STORAGE_KEY, player);
    setPreference(player);
    setHasSelected(true);
  }, []);

  const clearPreference = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPreference(null);
    setHasSelected(false);
  }, []);

  const getPlayerInfo = useCallback((): PlayerInfo | undefined => {
    if (!preference) return undefined;
    return PLAYER_OPTIONS.find((p) => p.id === preference);
  }, [preference]);

  const launchWithPath = useCallback((path: string): boolean => {
    if (!preference || preference === 'browser') return false;
    const player = getPlayerInfo();
    if (!player) return false;
    launchPlayer(player, path);
    return true;
  }, [preference, getPlayerInfo]);

  return {
    preference,
    hasSelected,
    availablePlayers,
    savePreference,
    clearPreference,
    getPlayerInfo,
    launchWithPath,
  };
}

