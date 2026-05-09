'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore, type MediaItem } from '@/lib/store';
import { toast } from 'sonner';
import { fetchWithTimeout, formatBytes } from '@/lib/helpers';
import { useFolderPicker } from '@/hooks/useFolderPicker';
import { useFileActions } from '@/hooks/useFileActions';
import { FolderPickerContent } from '@/components/shared/FolderPickerContent';
import {
  X, RefreshCw, FolderPlus,
  ChevronRight, ChevronUp, Home as HomeIcon, Search, Plus, Edit,
  FolderOpen, Folder, MoreVertical, ExternalLink, ArrowUpDown,
  Image as ImageIcon, Music, Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Repeat, Shuffle, Disc3, Heart, Trash2, ArrowLeft, Dices,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import FileActionsMenu from '@/components/shared/FileActionsMenu';

export default function MusicSection() {
  const {
    musicCurrentPath, setMusicCurrentPath,
    musicPathHistory, setMusicPathHistory,
    musicLibraryPaths, setMusicLibraryPaths,
    currentTrack, setCurrentTrack, isPlaying, setIsPlaying,
    musicQueue, setMusicQueue, shuffleMode, setShuffleMode,
    repeatMode, setRepeatMode,
    sidebarCollapsed,
  } = useAppStore();
  const [folders, setFolders] = useState<Array<{ name: string; path: string; itemCount: number }>>([]);
  const [tracks, setTracks] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [coverPaths, setCoverPaths] = useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [newPath, setNewPath] = useState('');
  const folderPicker = useFolderPicker(async (path) => {
    try {
      const current = useAppStore.getState().musicLibraryPaths;
      if (current.includes(path)) { toast.info('Esta carpeta ya está en la lista'); return; }
      const newPaths = [...current, path];
      useAppStore.getState().setMusicLibraryPaths(newPaths);
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'musicLibraryPaths', value: JSON.stringify(newPaths) }) });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success('Carpeta agregada');
    } catch (e) { toast.error('No se pudo guardar la carpeta'); console.error(e); }
  });
  const [showCoverUpload, setShowCoverUpload] = useState(false);
  const [coverFolder, setCoverFolder] = useState('');
  const { renameItem, setRenameItem, renameValue, setRenameValue, handleRename, handleDelete, confirmRename } = useFileActions(() => loadMedia());
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [musicTab, setMusicTab] = useState<'local' | 'bookmarks'>('local');
  const [musicBookmarks, setMusicBookmarks] = useState<Array<Record<string, unknown>>>([]);
  const [showAddBookmark, setShowAddBookmark] = useState(false);
  const [bmTitle, setBmTitle] = useState('');
  const [bmArtist, setBmArtist] = useState('');
  const [bmAlbum, setBmAlbum] = useState('');
  const [bmExternalUrl, setBmExternalUrl] = useState('');
  const [bmCoverUrl, setBmCoverUrl] = useState('');
  const [bmNotes, setBmNotes] = useState('');
  const [bmFavorite, setBmFavorite] = useState(false);
  const [editingMusicBm, setEditingMusicBm] = useState<Record<string, unknown> | null>(null);
  const [randomPlaylist, setRandomPlaylist] = useState<MediaItem[]>([]);
  const [showRandomPlaylist, setShowRandomPlaylist] = useState(false);
  const [randomLoading, setRandomLoading] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/media/stream?path=${encodeURIComponent(musicCurrentPath)}&type=audio`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setTracks((data.files || []).map((f: Record<string, unknown>) => ({ ...f, type: 'audio' as const })));
        // Check covers for folders
        const coverCheck: Record<string, boolean> = {};
        for (const f of (data.folders || [])) {
          try {
            const coverRes = await fetch(`/api/music/cover?path=${encodeURIComponent(f.path)}`);
            coverCheck[f.path] = coverRes.ok && coverRes.headers.get('content-type')?.startsWith('image/');
          } catch { coverCheck[f.path] = false; }
        }
        setCoverPaths(coverCheck);
      }
    } catch {
      toast.error('Error cargando música');
    } finally {
      setLoading(false);
    }
  }, [musicCurrentPath]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  // Load saved music paths from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings?key=musicLibraryPaths');
        if (res.ok) {
          const data = await res.json();
          if (data.value) {
            const saved = JSON.parse(data.value) as string[];
            if (saved.length > 0) {
              setMusicLibraryPaths(saved);
              setMusicCurrentPath(saved[0]);
              setMusicPathHistory([saved[0]]);
            }
          }
        }
      } catch { /* use defaults */ }
    };
    loadSettings();
  }, [setMusicLibraryPaths, setMusicCurrentPath, setMusicPathHistory]);

  // Save music paths to database whenever they change
  const saveMusicPaths = useCallback(async (paths: string[]) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'musicLibraryPaths', value: JSON.stringify(paths) }),
      });
    } catch { /* ignore */ }
  }, []);

  // Wrapper that updates store AND saves to DB
  const updateMusicPaths = useCallback((newPaths: string[]) => {
    setMusicLibraryPaths(newPaths);
    saveMusicPaths(newPaths);
  }, [setMusicLibraryPaths, saveMusicPaths]);

  const navigateTo = (path: string) => {
    setMusicPathHistory([...musicPathHistory, path]);
    setMusicCurrentPath(path);
  };

  const goBack = () => {
    if (musicPathHistory.length > 1) {
      const h = [...musicPathHistory]; h.pop();
      setMusicPathHistory(h);
      setMusicCurrentPath(musicPathHistory[musicPathHistory.length - 2]);
    }
  };

  const goUp = () => {
    const parent = musicCurrentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== musicCurrentPath) navigateTo(parent);
  };

  const playTrack = (track: MediaItem, trackList?: MediaItem[]) => {
    const queue = trackList || tracks;
    setMusicQueue(queue);
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const playAll = () => {
    if (tracks.length > 0) {
      setMusicQueue(tracks);
      setCurrentTrack(tracks[0]);
      setIsPlaying(true);
    }
  };

  const playRandom = async () => {
    setRandomLoading(true);
    try {
      // Gather all library paths
      const pathsToScan = musicLibraryPaths.length > 0 ? musicLibraryPaths : [musicCurrentPath];
      const allTracks: MediaItem[] = [];

      for (const p of pathsToScan) {
        try {
          const res = await fetch(`/api/music/random?path=${encodeURIComponent(p)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.tracks) allTracks.push(...data.tracks);
          }
        } catch { /* skip failed paths */ }
      }

      if (allTracks.length === 0) {
        toast.error('No se encontraron canciones');
        setRandomLoading(false);
        return;
      }

      // Shuffle the combined tracks
      for (let i = allTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
      }

      setRandomPlaylist(allTracks);
      setShowRandomPlaylist(true);
      setMusicQueue(allTracks);
      setCurrentTrack(allTracks[0]);
      setIsPlaying(true);
      setShuffleMode(true);
      setRepeatMode('all');
      toast.success(`🎵 ${allTracks.length} canciones mezcladas`);
    } catch {
      toast.error('Error al generar playlist aleatoria');
    } finally {
      setRandomLoading(false);
    }
  };

  const playFolder = async (folderPath: string) => {
    try {
      const res = await fetch(`/api/media/stream?path=${encodeURIComponent(folderPath)}&type=audio`);
      if (res.ok) {
        const data = await res.json();
        const folderTracks = (data.files || []).map((f: Record<string, unknown>) => ({ ...f, type: 'audio' as const }));
        if (folderTracks.length > 0) {
          setMusicQueue(folderTracks);
          setCurrentTrack(folderTracks[0]);
          setIsPlaying(true);
          toast.success(`Reproduciendo ${folderTracks.length} canciones`);
        } else {
          toast.error('No hay canciones en esta carpeta');
        }
      }
    } catch { toast.error('Error al reproducir carpeta'); }
  };

  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;
    audioRef.current.src = `/api/media/stream?path=${encodeURIComponent(currentTrack.path)}`;
    audioRef.current.volume = volume;
    if (isPlaying) audioRef.current.play().catch(() => {});
  }, [currentTrack]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [isPlaying]);

  const nextTrack = useCallback(() => {
    if (musicQueue.length === 0) return;
    const currentIndex = musicQueue.findIndex((t) => t.path === currentTrack?.path);
    let nextIndex: number;
    if (shuffleMode) nextIndex = Math.floor(Math.random() * musicQueue.length);
    else nextIndex = currentIndex + 1;
    if (nextIndex >= musicQueue.length) {
      if (repeatMode === 'all') nextIndex = 0;
      else { setIsPlaying(false); return; }
    }
    setCurrentTrack(musicQueue[nextIndex]);
  }, [musicQueue, currentTrack, shuffleMode, repeatMode, setIsPlaying, setCurrentTrack]);

  const prevTrack = useCallback(() => {
    if (musicQueue.length === 0) return;
    const currentIndex = musicQueue.findIndex((t) => t.path === currentTrack?.path);
    const prevIndex = currentIndex <= 0 ? musicQueue.length - 1 : currentIndex - 1;
    setCurrentTrack(musicQueue[prevIndex]);
  }, [musicQueue, currentTrack, setCurrentTrack]);

  const handleTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); };
  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration); };
  const handleEnded = () => {
    if (repeatMode === 'one') { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); } }
    else nextTrack();
  };
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const formatTrackTime = (s: number) => {
    if (isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !coverFolder) return;
    const formData = new FormData();
    formData.append('path', coverFolder);
    formData.append('cover', file);
    try {
      const res = await fetch('/api/music/cover', { method: 'POST', body: formData });
      if (res.ok) { toast.success('Carátula actualizada'); loadMedia(); }
      else toast.error('Error al subir carátula');
    } catch { toast.error('Error de conexión'); }
    setShowCoverUpload(false);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  // Extract local path from ANY format a bookmark might have
  const getBmPath = (bm: Record<string, unknown>): string => {
    if (bm.localPath) return String(bm.localPath);
    if (bm.externalUrl && String(bm.externalUrl).startsWith('local:')) return String(bm.externalUrl).slice(6);
    if (bm.notes && String(bm.notes).startsWith('local:')) {
      try { return JSON.parse(String(bm.notes).slice(6)).path || ''; } catch { /* */ }
    }
    return '';
  };

  // Derive set of favorited local track paths (only isFavorite === true)
  const favoritePaths = new Set(
    musicBookmarks
      .filter((bm) => bm.isFavorite)
      .map((bm) => getBmPath(bm))
      .filter(Boolean)
  );

  const filteredTracks = searchQuery ? tracks.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase())) : tracks;
  const filteredFolders = searchQuery ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : folders;
  const filteredMusicBms = searchQuery
    ? musicBookmarks.filter((bm) =>
        String(bm.title).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(bm.artist || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : musicBookmarks;
  const musicIsSearching = searchQuery.trim().length > 0;
  const sortedFolders = sortAsc
    ? [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name));
  const sortedTracks = sortAsc
    ? [...filteredTracks].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredTracks].sort((a, b) => b.name.localeCompare(a.name));
  const totalSize = tracks.reduce((s, t) => s + t.size, 0);
  const totalSongs = folders.reduce((s, f) => s + f.itemCount, 0) + tracks.length;

  // ── Music Bookmarks ──
  const loadMusicBookmarks = useCallback(async () => {
    try {
      const res = await fetch('/api/music/bookmarks');
      if (res.ok) {
        const data = await res.json();
        setMusicBookmarks(data.bookmarks || []);
      } else {
        console.error('loadMusicBookmarks failed:', res.status, await res.text().catch(() => ''));
      }
    } catch (err) {
      console.error('loadMusicBookmarks error:', err);
    }
  }, []);

  useEffect(() => { loadMusicBookmarks(); }, [loadMusicBookmarks]);

  const createMusicBookmark = async () => {
    if (!bmTitle.trim()) return;
    const loading = toast.loading('Guardando canción...');
    try {
      const res = await fetchWithTimeout('/api/music/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bmTitle, artist: bmArtist || null, album: bmAlbum || null, externalUrl: bmExternalUrl || null, coverUrl: bmCoverUrl || null, notes: bmNotes || null, isFavorite: bmFavorite }),
      });
      if (res.ok) {
        toast.success('Canción guardada', { id: loading });
        setShowAddBookmark(false);
        setBmTitle(''); setBmArtist(''); setBmAlbum(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes(''); setBmFavorite(false);
        loadMusicBookmarks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al guardar la canción', { id: loading });
      }
    } catch (err) {
      console.error('Music bookmark error:', err);
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Error de conexión', { id: loading });
    }
  };

  const deleteMusicBookmark = async (id: string) => {
    if (!confirm('¿Eliminar este bookmark?')) return;
    try {
      const res = await fetchWithTimeout(`/api/music/bookmarks/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Eliminado'); loadMusicBookmarks(); }
    } catch { toast.error('Error al eliminar'); }
  };

  // Toggle favorite for a local track (heart button)
  const toggleTrackFavorite = async (track: MediaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const trackPath = track.path;
    setFavoriteLoading(trackPath);

    const existing = musicBookmarks.find((bm) => favoritePaths.has(trackPath));

    if (existing) {
      // Already favorited → remove
      try {
        const res = await fetchWithTimeout(`/api/music/bookmarks/${existing.id}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success('Quitada de favoritos');
          loadMusicBookmarks();
        }
      } catch { toast.error('Error al quitar favorito'); }
    } else {
      // Not favorited → add
      const trackName = track.name.replace(/\.[^.]+$/, '');
      const albumName = trackPath.split('/').slice(-2, -1).pop() || '';
      try {
        const res = await fetch('/api/music/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trackName,
            album: albumName,
            localPath: trackPath,
            localSize: track.size || null,
            isFavorite: true,
          }),
        });
        if (res.ok) {
          toast.success('Agregada a Mis Favoritos ❤️');
          loadMusicBookmarks();
        } else {
          let errorDetail = '';
          try {
            const data = await res.json();
            errorDetail = data.details || data.error || '';
            console.error('Favorite save failed:', res.status, data);
          } catch {
            const text = await res.text().catch(() => '');
            errorDetail = text || `HTTP ${res.status}`;
            console.error('Favorite save failed - non-JSON:', res.status, text);
          }
          if (res.status === 409) toast.info('Ya está en tus favoritos');
          else toast.error(errorDetail || `Error al guardar (HTTP ${res.status})`);
        }
      } catch (err) {
        console.error('Favorite save error:', err);
        toast.error('Error de conexión');
      }
    }
    setFavoriteLoading(null);
  };

  const openEditMusicDialog = (bm: Record<string, unknown>) => {
    setEditingMusicBm(bm);
    setBmTitle(String(bm.title));
    setBmArtist(String(bm.artist || ''));
    setBmAlbum(String(bm.album || ''));
    setBmExternalUrl(String(bm.externalUrl || ''));
    setBmCoverUrl(String(bm.coverUrl || ''));
    setBmNotes(String(bm.notes || ''));
    setBmFavorite(!!bm.isFavorite);
    setShowAddBookmark(true);
  };

  const updateMusicBookmark = async () => {
    if (!editingMusicBm || !bmTitle.trim()) return;
    const loading = toast.loading('Actualizando canción...');
    try {
      const res = await fetchWithTimeout(`/api/music/bookmarks/${editingMusicBm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bmTitle, artist: bmArtist || null, album: bmAlbum || null, externalUrl: bmExternalUrl || null, coverUrl: bmCoverUrl || null, notes: bmNotes || null, isFavorite: bmFavorite }),
      });
      if (res.ok) {
        toast.success('Canción actualizada', { id: loading });
        setShowAddBookmark(false); setEditingMusicBm(null);
        setBmTitle(''); setBmArtist(''); setBmAlbum(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes(''); setBmFavorite(false);
        loadMusicBookmarks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al actualizar', { id: loading });
      }
    } catch (err) {
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Error de conexión', { id: loading });
    }
  };

  return (
    <div className="space-y-4">
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleEnded} preload="metadata" />

      {/* Player Bar */}
      {currentTrack && (
        <div className={`fixed bottom-0 right-0 z-40 bg-card/95 backdrop-blur border-t border-border shadow-lg ${sidebarCollapsed ? 'md:left-[68px]' : 'md:left-64'} left-0`}>
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 min-w-0 w-48 sm:w-64">
                <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                  <Music className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{currentTrack.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{currentTrack.extension.toUpperCase()}</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevTrack}><SkipBack className="h-4 w-4" /></Button>
                  <Button variant="default" size="icon" className="h-10 w-10 rounded-full bg-violet-600 hover:bg-violet-700" onClick={() => setIsPlaying(!isPlaying)}>
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextTrack}><SkipForward className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShuffleMode(!shuffleMode)}>
                    <Shuffle className={`h-4 w-4 ${shuffleMode ? 'text-violet-500' : ''}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRepeatMode(repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none')}>
                    <Repeat className={`h-4 w-4 ${repeatMode !== 'none' ? 'text-violet-500' : ''}`} />
                    {repeatMode === 'one' && <span className="absolute text-[8px] font-bold">1</span>}
                  </Button>
                </div>
                <div className="flex items-center gap-2 w-full max-w-md">
                  <span className="text-[10px] text-muted-foreground w-10 text-right">{formatTrackTime(currentTime)}</span>
                  <div ref={progressRef} className="flex-1 h-1.5 bg-muted rounded-full cursor-pointer group" onClick={handleProgressClick}>
                    <div className="h-full bg-violet-500 rounded-full transition-all relative" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-violet-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground w-10">{formatTrackTime(duration)}</span>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 w-32">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVolume(volume === 0 ? 0.8 : 0)}>
                  {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-20 accent-violet-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goBack} disabled={musicPathHistory.length <= 1}><ArrowLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goUp}><ChevronUp className="h-4 w-4" /></Button>
          {musicLibraryPaths.map((p) => (
            <Button key={p} variant={musicCurrentPath === p ? 'secondary' : 'ghost'} size="sm" className="h-8 flex-shrink-0 text-xs max-w-[140px]" onClick={() => { setMusicPathHistory([p]); setMusicCurrentPath(p); }}>
              <Disc3 className="h-3.5 w-3.5 mr-1 shrink-0" /><span className="truncate">{p.split('/').pop()}</span>
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => navigateTo('/')}><HomeIcon className="h-4 w-4" /></Button>
          {musicCurrentPath !== '/' && musicCurrentPath !== '/home/z' && !musicLibraryPaths.includes(musicCurrentPath) && (
            <><ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span className="text-sm font-medium truncate">{musicCurrentPath.split('/').pop()}</span></>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-8 w-48" />
          </div>
          <Button variant={sortAsc ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setSortAsc(!sortAsc)} title={sortAsc ? 'A → Z' : 'Z → A'}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowSettings(true)}><MoreVertical className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadMedia}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <Button variant={musicTab === 'local' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setMusicTab('local')}>
          <Music className="h-3.5 w-3.5 mr-1" />Archivos Locales
        </Button>
        <Button variant={musicTab === 'bookmarks' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => { setMusicTab('bookmarks'); loadMusicBookmarks(); }}>
          <Heart className="h-3.5 w-3.5 mr-1" />Mis Favoritos
        </Button>
      </div>

      {musicIsSearching ? (
        /* ── Unified Search Results ── */
        <div className="space-y-6">
          {(filteredFolders.length > 0 || filteredTracks.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Music className="h-4 w-4" />Archivos Locales
                <Badge variant="secondary" className="text-xs">{filteredFolders.length + filteredTracks.length}</Badge>
              </h3>
              <div className="space-y-4">
                {filteredFolders.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filteredFolders.sort((a, b) => a.name.localeCompare(b.name)).map((folder) => (
                      <Card key={folder.path} className="group cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 transition-all hover:shadow-md hover:-translate-y-0.5" onClick={() => navigateTo(folder.path)}>
                        <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                          <div className="relative">
                            <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30"><Folder className="h-5 w-5 text-violet-600 dark:text-violet-400" /></div>
                            {folder.itemCount > 0 ? <Badge variant="secondary" className="absolute -top-1 -right-1 text-[9px] bg-violet-500/70 text-white h-4 w-4 flex items-center justify-center p-0">{folder.itemCount}</Badge> : null}
                          </div>
                          <p className="text-xs font-medium truncate w-full">{folder.name}</p>
                          <p className="text-[10px] text-muted-foreground">{folder.itemCount} canción{folder.itemCount !== 1 ? 'es' : ''}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {filteredTracks.length > 0 && (
                  <div className="space-y-1">
                    {filteredTracks.sort((a, b) => a.name.localeCompare(b.name)).map((track) => (
                      <div key={track.path} className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${currentTrack?.path === track.path ? 'bg-violet-50 dark:bg-violet-950/20' : ''}`} onClick={() => { setCurrentTrack({ ...track, type: 'audio' }); setIsPlaying(true); }}>
                        <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-muted">{currentTrack?.path === track.path && isPlaying ? <div className="flex items-end gap-[2px] h-2.5"><div className="w-[2px] bg-violet-500 rounded-full animate-pulse" style={{ height: '60%' }} /><div className="w-[2px] bg-violet-500 rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} /><div className="w-[2px] bg-violet-500 rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} /></div> : <Music className="h-3.5 w-3.5 text-muted-foreground" />}</div>
                        <div className="flex-1 min-w-0"><p className="text-sm truncate">{track.name.replace(/\.[^.]+$/, '')}</p><p className="text-[10px] text-muted-foreground">{formatBytes(track.size)}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {filteredMusicBms.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Heart className="h-4 w-4" />Mis Favoritos
                <Badge variant="secondary" className="text-xs">{filteredMusicBms.length}</Badge>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMusicBms.map((bm) => (
                  <Card key={String(bm.id)} className="hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {bm.coverUrl ? <img src={String(bm.coverUrl)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <Music className="h-5 w-5 text-violet-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{String(bm.title)}</p>
                          {bm.artist && <p className="text-sm text-muted-foreground truncate">{String(bm.artist)}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {bm.isFavorite && <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />}
                          {bm.externalUrl && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(String(bm.externalUrl), '_blank')}><ExternalLink className="h-3.5 w-3.5" /></Button>}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMusicDialog(bm)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteMusicBookmark(String(bm.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {filteredFolders.length === 0 && filteredTracks.length === 0 && filteredMusicBms.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin resultados</p>
                <p className="text-sm text-muted-foreground">No se encontró &quot;{searchQuery}&quot; en archivos ni en Mis Favoritos</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (<>
      {musicTab === 'local' && (<>
      {/* Quick stats */}
      {!loading && (totalSongs > 0 || folders.length > 0) && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
          <span className="font-medium text-violet-600 dark:text-violet-400">{totalSongs} canciones</span>
          <span>{folders.length} álbumes</span>
          {tracks.length > 0 && <span>{formatBytes(totalSize)}</span>}
          <span className="font-mono truncate">{musicCurrentPath}</span>
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carpetas de Música</DialogTitle>
            <DialogDescription>{folderPicker.pickerMode ? 'Navega y selecciona una carpeta' : 'Configura las carpetas donde buscas música'}</DialogDescription>
          </DialogHeader>
          {folderPicker.pickerMode ? (
            <FolderPickerContent
              view={folderPicker.view}
              disks={folderPicker.disks}
              disksLoading={folderPicker.disksLoading}
              directories={folderPicker.directories}
              loading={folderPicker.loading}
              pickerPath={folderPicker.pickerPath}
              pickerHistory={folderPicker.pickerHistory}
              onGoToDisks={folderPicker.goToDisks}
              onGoBack={folderPicker.goBack}
              onGoUp={folderPicker.goUp}
              onNavigateTo={folderPicker.navigateTo}
              onClose={folderPicker.closePicker}
              onSelect={folderPicker.handleSelect}
            />
          ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {musicLibraryPaths.map((p, i) => (
                <div key={p} className="flex items-center gap-2 min-w-0">
                  <Disc3 className="h-4 w-4 text-violet-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono truncate min-w-0" title={p}>{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateMusicPaths(musicLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="/mnt/MiMusica" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1 min-w-[120px]" />
              <Button variant="outline" onClick={folderPicker.openPicker} title="Explorar carpetas">
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { if (newPath.trim()) { const p = newPath.trim(); if (musicLibraryPaths.includes(p)) { toast.info('Ya existe'); return; } try { const np = [...musicLibraryPaths, p]; setMusicLibraryPaths(np); await saveMusicPaths(np); toast.success('Carpeta agregada'); setNewPath(''); } catch { toast.error('Error al guardar'); } } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Las carpetas se usan como acceso rápido en la barra de navegación arriba.</p>
          </div>
          )}
          <DialogFooter>{!folderPicker.pickerMode && <Button variant="outline" onClick={() => setShowSettings(false)}>Cerrar</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cover Upload Dialog */}
      <Dialog open={showCoverUpload} onOpenChange={setShowCoverUpload}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Subir Carátula</DialogTitle>
            <DialogDescription>{coverFolder.split('/').pop()}</DialogDescription>
          </DialogHeader>
          <label className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Elegir archivo</span>
            <span className="text-xs text-muted-foreground">Se guardará como cover.jpg</span>
            <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverUpload} />
          </label>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameItem} onOpenChange={(open) => { if (!open) setRenameItem(null); }}>
        <DialogContent zIndex="z-[100]">
          <DialogHeader>
            <DialogTitle>Renombrar</DialogTitle>
            <DialogDescription>Cambia el nombre de "{renameItem?.name}"</DialogDescription>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenameItem(null); }} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameItem(null)}>Cancelar</Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim() || renameValue.trim() === renameItem?.name}>Renombrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : folders.length === 0 && tracks.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Music className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="font-medium mb-1">No hay música aquí</p>
            <p className="text-sm text-muted-foreground mb-4">Navega a una carpeta con archivos de audio (MP3, FLAC, WAV, OGG...)</p>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <FolderPlus className="h-4 w-4 mr-1" />Configurar carpetas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Album Grid */}
          {filteredFolders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Álbumes</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sortedFolders.map((folder) => {
                  const hasCover = coverPaths[folder.path];
                  return (
                    <Card key={folder.path} className="group cursor-pointer overflow-hidden hover:border-violet-300 dark:hover:border-violet-700 transition-all hover:shadow-lg hover:-translate-y-1" onDoubleClick={() => navigateTo(folder.path)}>
                      {/* Cover */}
                      <div className="aspect-square relative bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-950/40 dark:to-purple-950/40 overflow-hidden">
                        {hasCover ? (
                          <img
                            src={`/api/music/cover?path=${encodeURIComponent(folder.path)}`}
                            alt={folder.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <Disc3 className="h-12 w-12 text-violet-300 dark:text-violet-700" />
                            <Music className="h-6 w-6 text-violet-400 dark:text-violet-600" />
                          </div>
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                            <Button size="icon" className="h-10 w-10 rounded-full bg-violet-500 hover:bg-violet-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); playFolder(folder.path); }}>
                              <Play className="h-5 w-5 ml-0.5" />
                            </Button>
                          </div>
                        </div>
                        {/* Badge */}
                        <div className="absolute top-2 right-2">
                          {folder.itemCount > 0 ? (
                          <Badge variant="secondary" className="text-[10px] bg-violet-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Play className="h-2.5 w-2.5" />{folder.itemCount}</Badge>
                        ) : (folder as unknown as { subFolderCount?: number }).subFolderCount ? (
                          <Badge variant="secondary" className="text-[10px] bg-amber-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Folder className="h-2.5 w-2.5" />{(folder as unknown as { subFolderCount: number }).subFolderCount}</Badge>
                        ) : null}
                        </div>
                        {/* Edit cover + actions menu */}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <FileActionsMenu 
                            item={folder} 
                            onRename={handleRename} 
                            onDelete={(f) => handleDelete(f.path, f.name)}
                            extraItems={
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setCoverFolder(folder.path); setShowCoverUpload(true); }}>
                                  <ImageIcon className="h-4 w-4 mr-2" />
                                  Cambiar carátula
                                </DropdownMenuItem>
                              </>
                            }
                          />
                        </div>
                      </div>
                      {/* Album name */}
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">{folder.itemCount > 0 ? `${folder.itemCount} canción${folder.itemCount !== 1 ? 'es' : ''}` : (folder as unknown as { subFolderCount?: number }).subFolderCount ? `${(folder as unknown as { subFolderCount: number }).subFolderCount} subcarpeta${(folder as unknown as { subFolderCount: number }).subFolderCount !== 1 ? 's' : ''}` : 'Vacío'}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Track list */}
          {filteredTracks.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Canciones</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={playAll}><Play className="h-3.5 w-3.5 mr-1 text-violet-500" />Reproducir Todo</Button>
                    <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400" onClick={playRandom} disabled={randomLoading}>
                      {randomLoading ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Dices className="h-3.5 w-3.5 mr-1" />}Random
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-96 overflow-y-auto">
                  {sortedTracks.map((track, idx) => {
                    const isActive = currentTrack?.path === track.path;
                    return (
                      <div key={track.path} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isActive ? 'bg-violet-50 dark:bg-violet-950/20' : 'hover:bg-muted/50'}`} onClick={() => playTrack(track)}>
                        <span className="text-xs text-muted-foreground w-6 text-right flex-shrink-0">{isActive && isPlaying ? '' : idx + 1}</span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-violet-500 text-white' : 'bg-muted'}`}>
                          {isActive && isPlaying ? <div className="flex items-end gap-[2px] h-3">
                            <div className="w-[3px] bg-white rounded-full animate-pulse" style={{ height: '60%' }} />
                            <div className="w-[3px] bg-white rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} />
                            <div className="w-[3px] bg-white rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} />
                          </div> : <Music className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isActive ? 'text-violet-700 dark:text-violet-400' : ''}`}>{track.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(track.size)} · {track.extension.toUpperCase()}</p>
                        </div>
                        <FileActionsMenu item={track} onRename={handleRename} onDelete={(t) => handleDelete(t.path, t.name)} />
                        <Button
                          variant="ghost" size="icon" className={`h-8 w-8 flex-shrink-0 ${favoritePaths.has(track.path) ? 'text-rose-500 hover:text-rose-600' : 'text-muted-foreground hover:text-rose-500'}`}
                          onClick={(e) => toggleTrackFavorite(track, e)}
                          disabled={favoriteLoading === track.path}
                          title={favoritePaths.has(track.path) ? 'Quitar de Mis Favoritos' : 'Agregar a Mis Favoritos'}
                        >
                          <Heart className={`h-4 w-4 ${favoritePaths.has(track.path) ? 'fill-rose-500' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); playTrack(track); }}>
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          {/* Random Playlist */}
          {showRandomPlaylist && randomPlaylist.length > 0 && (
            <Card className="border-emerald-200/50 dark:border-emerald-900/30">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Dices className="h-4 w-4 text-emerald-500" />
                    Playlist Aleatoria
                    <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{randomPlaylist.length} canciones</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={playRandom} disabled={randomLoading}>
                      <RefreshCw className={`h-3.5 w-3.5 ${randomLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowRandomPlaylist(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-80 overflow-y-auto">
                  {randomPlaylist.map((track, idx) => {
                    const isActive = currentTrack?.path === track.path;
                    return (
                      <div key={track.path} className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${isActive ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-muted/50'}`} onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}>
                        <span className="text-xs text-muted-foreground w-6 text-right flex-shrink-0 font-mono">{idx + 1}</span>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-emerald-500 text-white' : 'bg-muted'}`}>
                          {isActive && isPlaying ? <div className="flex items-end gap-[2px] h-2.5">
                            <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '60%' }} />
                            <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} />
                            <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} />
                          </div> : <Music className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${isActive ? 'text-emerald-700 dark:text-emerald-400 font-medium' : ''}`}>{track.name.replace(/\.[^.]+$/, '')}</p>
                          <p className="text-[10px] text-muted-foreground">{track.path.split('/').slice(-2, -1).pop()}</p>
                        </div>
                        {track.size > 0 && <span className="text-[10px] text-muted-foreground">{formatBytes(track.size)}</span>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      </>)}

      {/* ── Mis Favoritos Tab ── */}
      {musicTab === 'bookmarks' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />Mis Canciones Favoritas
                <Badge variant="secondary" className="text-xs">{musicBookmarks.length}</Badge>
              </h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400" onClick={() => {
                  if (musicBookmarks.length === 0) { toast.error('No hay favoritos'); return; }
                  const favTracks = musicBookmarks.filter((bm) => favoritePaths.has(getBmPath(bm))).map((bm) => {
                    const p = getBmPath(bm);
                    return { name: String(bm.title), path: p, size: 0, extension: p.split('.').pop() || 'mp3', type: 'audio' as const };
                  });
                  if (favTracks.length === 0) { toast.error('No hay canciones locales en favoritos'); return; }
                  for (let i = favTracks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [favTracks[i], favTracks[j]] = [favTracks[j], favTracks[i]]; }
                  setMusicQueue(favTracks); setCurrentTrack(favTracks[0]); setIsPlaying(true); setShuffleMode(true); setRepeatMode('all');
                  toast.success(`🎵 ${favTracks.length} favoritas mezcladas`);
                }}>
                  <Dices className="h-3.5 w-3.5 mr-1" />Random
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddBookmark(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Agregar
                </Button>
              </div>
            </div>
            {musicBookmarks.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <Heart className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="font-medium mb-1">Sin favoritos aún</p>
                  <p className="text-sm text-muted-foreground">Haz clic en el <Heart className="h-3.5 w-3.5 inline text-rose-400 fill-rose-400" /> junto a cualquier canción</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y max-h-[500px] overflow-y-auto">
                    {musicBookmarks.map((bm) => {
                      const trackPath = getBmPath(bm);
                      const isActive = currentTrack?.path === trackPath;
                      return (
                        <div key={String(bm.id)} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isActive ? 'bg-violet-50 dark:bg-violet-950/20' : 'hover:bg-muted/50'}`} onClick={() => {
                          if (!trackPath) { toast.error('Esta canción no tiene ruta local'); return; }
                          playTrack({ name: String(bm.title), path: trackPath, size: 0, extension: trackPath.split('.').pop() || 'mp3', type: 'audio' });
                        }}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-violet-500 text-white' : 'bg-muted'}`}>
                            {isActive && isPlaying ? <div className="flex items-end gap-[2px] h-3"><div className="w-[3px] bg-white rounded-full animate-pulse" style={{ height: '60%' }} /><div className="w-[3px] bg-white rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} /><div className="w-[3px] bg-white rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} /></div> : <Music className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isActive ? 'text-violet-700 dark:text-violet-400' : ''}`}>{String(bm.title)}</p>
                            <p className="text-xs text-muted-foreground">{trackPath ? trackPath.split('/').slice(-2, -1).pop() : String(bm.notes || '').substring(0, 50)}</p>
                          </div>
                          <Heart className="h-4 w-4 text-rose-500 fill-rose-500 flex-shrink-0" />
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-red-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); deleteMusicBookmark(String(bm.id)); }} title="Quitar de favoritos">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Bookmark Dialog */}
      <Dialog open={showAddBookmark} onOpenChange={(open) => { setShowAddBookmark(open); if (!open) { setEditingMusicBm(null); setBmTitle(''); setBmArtist(''); setBmAlbum(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes(''); setBmFavorite(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMusicBm ? 'Editar Canción' : 'Agregar Canción'}</DialogTitle>
            <DialogDescription>{editingMusicBm ? 'Modifica los detalles de la canción' : 'Guarda un enlace a tu canción favorita'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={bmTitle} onChange={(e) => setBmTitle(e.target.value)} placeholder="Nombre de la canción" />
            </div>
            <div>
              <Label>Artista</Label>
              <Input value={bmArtist} onChange={(e) => setBmArtist(e.target.value)} placeholder="Nombre del artista" />
            </div>
            <div>
              <Label>Álbum</Label>
              <Input value={bmAlbum} onChange={(e) => setBmAlbum(e.target.value)} placeholder="Nombre del álbum" />
            </div>
            <div>
              <Label>URL (Spotify, YouTube...)</Label>
              <Input value={bmExternalUrl} onChange={(e) => setBmExternalUrl(e.target.value)} placeholder="https://open.spotify.com/..." />
            </div>
            <div>
              <Label>URL de Carátula (opcional)</Label>
              <Input value={bmCoverUrl} onChange={(e) => setBmCoverUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={bmNotes} onChange={(e) => setBmNotes(e.target.value)} placeholder="Notas..." rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={bmFavorite} onCheckedChange={setBmFavorite} />
              <Label>Favorito</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddBookmark(false); setEditingMusicBm(null); setBmTitle(''); setBmArtist(''); setBmAlbum(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes(''); setBmFavorite(false); }}>Cancelar</Button>
            {editingMusicBm ? (
              <Button onClick={updateMusicBookmark} disabled={!bmTitle.trim()}>Actualizar</Button>
            ) : (
              <Button onClick={createMusicBookmark} disabled={!bmTitle.trim()}>Guardar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {currentTrack && <div className="h-24" />}
      </>)}
    </div>
  );
}
