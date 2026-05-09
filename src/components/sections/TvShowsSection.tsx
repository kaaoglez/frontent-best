'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore, type MediaItem } from '@/lib/store';
import { toast } from 'sonner';
import { fetchWithTimeout, formatBytes, formatTimeAgo } from '@/lib/helpers';
import { useFolderPicker } from '@/hooks/useFolderPicker';
import { useFileActions } from '@/hooks/useFileActions';
import { FolderPickerContent } from '@/components/shared/FolderPickerContent';
import {
  X, RefreshCw, Upload, FolderPlus,
  ChevronRight, ChevronUp, Home as HomeIcon, Search, Plus, Edit,
  FolderOpen, Folder, MoreVertical, ExternalLink, ArrowUpDown,
  Image as ImageIcon, Film, Play, Copy, Bookmark, Star, HardDrive, Trash2,
  AlertTriangle, Maximize, Minimize, Monitor, ArrowLeft, Heart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import FileActionsMenu from '@/components/shared/FileActionsMenu';

const tvShowStatuses = [
  { key: 'all', label: 'Todas' },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'viendo', label: 'Viendo' },
  { key: 'completada', label: 'Completada' },
  { key: 'abandonada', label: 'Abandonada' },
  { key: 'favorita', label: 'Favorita' },
];

function tvShowStatusLabel(status: string): string {
  const map: Record<string, string> = { pendiente: 'Pendiente', viendo: 'Viendo', completada: 'Completada', abandonada: 'Abandonada', favorita: 'Favorita' };
  return map[status] || status;
}

function tvShowStatusColor(status: string): string {
  const map: Record<string, string> = {
    pendiente: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    viendo: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    completada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    abandonada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    favorita: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
}

export default function TvShowsSection() {
  const {
    tvshowCurrentPath, setTvshowCurrentPath,
    tvshowPathHistory, setTvshowPathHistory,
    tvshowLibraryPaths, setTvshowLibraryPaths,
  } = useAppStore();

  // ── Local files state ──
  const [folders, setFolders] = useState<Array<{ name: string; path: string; itemCount: number }>>([]);
  const [tvFiles, setTvFiles] = useState<MediaItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [tvSearchQuery, setTvSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [newPath, setNewPath] = useState('');
  const folderPicker = useFolderPicker(async (path) => {
    try {
      const current = useAppStore.getState().tvshowLibraryPaths;
      if (current.includes(path)) { toast.info('Esta carpeta ya está en la lista'); return; }
      const newPaths = [...current, path];
      useAppStore.getState().setTvshowLibraryPaths(newPaths);
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'tvshowLibraryPaths', value: JSON.stringify(newPaths) }) });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success('Carpeta agregada');
    } catch (e) { toast.error('No se pudo guardar la carpeta'); console.error(e); }
  });
  const [coverPaths, setCoverPaths] = useState<Record<string, boolean>>({});
  const [sortAsc, setSortAsc] = useState(true);
  const { renameItem, setRenameItem, renameValue, setRenameValue, handleRename, handleDelete, confirmRename } = useFileActions(() => loadMedia());
  // Edit folder state
  const [editFolder, setEditFolder] = useState<{ path: string; name: string } | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // ── Video player state (local) ──
  const [currentTvVideo, setCurrentTvVideo] = useState<MediaItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // ── Bookmarks state ──
  const [activeTab, setActiveTab] = useState<'local' | 'bookmarks'>('local');
  const [bookmarks, setBookmarks] = useState<Array<Record<string, unknown>>>([]);
  const [loadingBm, setLoadingBm] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingBm, setEditingBm] = useState<Record<string, unknown> | null>(null);
  const [bmTitle, setBmTitle] = useState('');
  const [bmPosterUrl, setBmPosterUrl] = useState('');
  const [bmStreamingUrl, setBmStreamingUrl] = useState('');
  const [bmNotes, setBmNotes] = useState('');
  const [bmStatus, setBmStatus] = useState('pendiente');
  const [bmRating, setBmRating] = useState('');
  const [bmSeasons, setBmSeasons] = useState('');
  const [bmCurrentSeason, setBmCurrentSeason] = useState('');
  const [bmCurrentEpisode, setBmCurrentEpisode] = useState('');
  const [bmNetwork, setBmNetwork] = useState('');
  const [bmGenre, setBmGenre] = useState('');
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);

  // ── File browser ──
  const loadMedia = useCallback(async () => {
    try {
      setLoadingFiles(true);
      const res = await fetch(`/api/media/stream?path=${encodeURIComponent(tvshowCurrentPath)}&type=video`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setTvFiles((data.files || []).map((f: Record<string, unknown>) => ({ ...f, type: 'video' as const })));
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
      toast.error('Error cargando Series');
    } finally {
      setLoadingFiles(false);
    }
  }, [tvshowCurrentPath]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  // Load saved paths from DB on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings?key=tvshowLibraryPaths');
        if (res.ok) {
          const data = await res.json();
          if (data.value) {
            const saved = JSON.parse(data.value) as string[];
            if (saved.length > 0) {
              setTvshowLibraryPaths(saved);
              setTvshowCurrentPath(saved[0]);
              setTvshowPathHistory([saved[0]]);
            }
          }
        }
      } catch { /* use defaults */ }
    };
    loadSettings();
  }, [setTvshowLibraryPaths, setTvshowCurrentPath, setTvshowPathHistory]);

  const saveTvShowPaths = useCallback(async (paths: string[]) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'tvshowLibraryPaths', value: JSON.stringify(paths) }),
      });
    } catch { /* ignore */ }
  }, []);

  const updateTvShowPaths = useCallback((newPaths: string[]) => {
    setTvshowLibraryPaths(newPaths);
    saveTvShowPaths(newPaths);
  }, [setTvshowLibraryPaths, saveTvShowPaths]);

  const navigateTo = (path: string) => {
    setTvshowPathHistory([...tvshowPathHistory, path]);
    setTvshowCurrentPath(path);
  };

  const goBack = () => {
    if (tvshowPathHistory.length > 1) {
      const h = [...tvshowPathHistory]; h.pop();
      setTvshowPathHistory(h);
      setTvshowCurrentPath(tvshowPathHistory[tvshowPathHistory.length - 2]);
    }
  };

  const goUp = () => {
    const parent = tvshowCurrentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== tvshowCurrentPath) navigateTo(parent);
  };



  // ── Edit Folder (rename + cover) ──
  const handleEditFolder = async (item: { path: string; name: string }) => {
    setEditFolder(item);
    setEditFolderName(item.name);
    setEditCoverFile(null);
    try {
      const res = await fetch(`/api/music/cover?path=${encodeURIComponent(item.path)}`);
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
        const blob = await res.blob();
        setEditCoverPreview(URL.createObjectURL(blob));
      } else {
        setEditCoverPreview(null);
      }
    } catch {
      setEditCoverPreview(null);
    }
  };

  const saveEditFolder = async () => {
    if (!editFolder || !editFolderName.trim()) return;
    setSavingEdit(true);
    try {
      if (editFolderName.trim() !== editFolder.name) {
        const res = await fetch('/api/files/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: editFolder.path, newName: editFolderName.trim() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || 'Error al renombrar');
          setSavingEdit(false);
          return;
        }
      }
      if (editCoverFile) {
        const formData = new FormData();
        const folderPath = editFolderName.trim() !== editFolder.name
          ? editFolder.path.replace(/[^/]+$/, editFolderName.trim())
          : editFolder.path;
        formData.append('path', folderPath);
        formData.append('cover', editCoverFile);
        const coverRes = await fetch('/api/music/cover', { method: 'POST', body: formData });
        if (!coverRes.ok) {
          const data = await coverRes.json().catch(() => ({}));
          toast.error(data.error || 'Error al subir carátula');
          setSavingEdit(false);
          return;
        }
      }
      toast.success('Carpeta actualizada');
      setEditFolder(null);
      setEditCoverFile(null);
      if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
      setEditCoverPreview(null);
      loadMedia();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Video player ──
  const playTvVideo = (item: MediaItem) => { setCurrentTvVideo(item); };

  const closeTvVideo = () => {
    if (videoRef.current) videoRef.current.pause();
    setCurrentTvVideo(null);
    setIsFullscreen(false);
    setVideoError(false);
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getDirectUrl = (item: MediaItem) => `${window.location.origin}/api/media/stream?path=${encodeURIComponent(item.path)}`;

  const getStreamUrl = (item: MediaItem) => {
    const ext = (item.extension || '').toLowerCase();
    if (['mp4', 'webm', 'ogv', 'm4v'].includes(ext)) {
      return `/api/media/stream?path=${encodeURIComponent(item.path)}`;
    }
    return `/api/media/transcode?path=${encodeURIComponent(item.path)}`;
  };

  const openInNewTab = (item: MediaItem) => window.open(getDirectUrl(item), '_blank');

  const copyDirectLink = (item: MediaItem) => {
    navigator.clipboard.writeText(getDirectUrl(item));
    toast.success('Enlace copiado al portapapeles');
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // ── File filters ──
  const filteredTvFiles = tvSearchQuery ? tvFiles.filter((m) => m.name.toLowerCase().includes(tvSearchQuery.toLowerCase())) : tvFiles;
  const filteredFolders = tvSearchQuery ? folders.filter((f) => f.name.toLowerCase().includes(tvSearchQuery.toLowerCase())) : folders;
  // Unified search flag
  const tvIsSearching = tvSearchQuery.trim().length > 0;
  const sortedFolders = sortAsc ? [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name)) : [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name));
  const sortedFiles = sortAsc ? [...filteredTvFiles].sort((a, b) => a.name.localeCompare(b.name)) : [...filteredTvFiles].sort((a, b) => b.name.localeCompare(a.name));
  const totalSize = tvFiles.reduce((s, m) => s + m.size, 0);

  // ── Bookmarks ──
  const loadBookmarks = useCallback(async () => {
    try {
      setLoadingBm(true);
      const res = await fetch('/api/tvshows/bookmarks');
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch {
      toast.error('Error cargando series');
    } finally {
      setLoadingBm(false);
    }
  }, []);

  useEffect(() => { loadBookmarks(); }, [loadBookmarks]);

  // ── Favorites helpers ──
  const getBmPath = (bm: Record<string, unknown>): string => {
    if (bm.localPath) return String(bm.localPath);
    if (bm.notes && String(bm.notes).startsWith('local:')) {
      try { return JSON.parse(String(bm.notes).slice(6)).path; } catch { return ''; }
    }
    return '';
  };
  const favoritePaths = new Set(bookmarks.map(getBmPath).filter(Boolean));

  const toggleFolderFavorite = async (folder: { name: string; path: string }, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavoriteLoading(folder.path);
    const existing = bookmarks.find((bm) => getBmPath(bm) === folder.path);
    if (existing) {
      try {
        const res = await fetchWithTimeout(`/api/tvshows/bookmarks/${existing.id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Serie quitada de favoritos'); loadBookmarks(); }
      } catch { toast.error('Error al quitar favorito'); }
    } else {
      try {
        const res = await fetch('/api/tvshows/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: folder.name,
            notes: `local:${JSON.stringify({ path: folder.path })}`,
            status: 'favorita',
          }),
        });
        if (res.ok) { toast.success('Serie agregada a favoritos ❤️'); loadBookmarks(); }
        else if (res.status === 409) toast.info('Ya está en favoritos');
        else { const data = await res.json().catch(() => ({})); toast.error(data.error || 'Error al guardar favorito'); }
      } catch { toast.error('Error de conexión'); }
    }
    setFavoriteLoading(null);
  };

  const deleteLocalFavorite = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetchWithTimeout(`/api/tvshows/bookmarks/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Serie quitada de favoritos'); loadBookmarks(); }
    } catch { toast.error('Error al quitar favorito'); }
  };

  const filteredBookmarks = bookmarks
    .filter((bm) => !getBmPath(bm)) // Exclude local favorites (shown separately above)
    .filter((bm) => statusFilter === 'all' || String(bm.status) === statusFilter)
    .filter((bm) => !tvSearchQuery || String(bm.title).toLowerCase().includes(tvSearchQuery.toLowerCase()) || String(bm.genre || '').toLowerCase().includes(tvSearchQuery.toLowerCase()) || String(bm.network || '').toLowerCase().includes(tvSearchQuery.toLowerCase()));

  const openAddDialog = () => {
    setEditingBm(null);
    setBmTitle(''); setBmPosterUrl(''); setBmStreamingUrl(''); setBmNotes('');
    setBmStatus('pendiente'); setBmRating(''); setBmSeasons(''); setBmCurrentSeason(''); setBmCurrentEpisode('');
    setBmNetwork(''); setBmGenre('');
    setShowAddDialog(true);
  };

  const openEditDialog = (bm: Record<string, unknown>) => {
    setEditingBm(bm);
    setBmTitle(String(bm.title));
    setBmPosterUrl(String(bm.posterPath || ''));
    setBmStreamingUrl(String(bm.streamingUrl || ''));
    setBmNotes(String(bm.notes || ''));
    setBmStatus(String(bm.status || 'pendiente'));
    setBmRating(bm.rating != null ? String(bm.rating) : '');
    setBmSeasons(bm.seasons != null ? String(bm.seasons) : '');
    setBmCurrentSeason(bm.currentSeason != null ? String(bm.currentSeason) : '');
    setBmCurrentEpisode(bm.currentEpisode != null ? String(bm.currentEpisode) : '');
    setBmNetwork(String(bm.network || ''));
    setBmGenre(String(bm.genre || ''));
    setShowAddDialog(true);
  };

  const createBookmark = async () => {
    if (!bmTitle.trim()) return;
    const loadingToast = toast.loading('Guardando serie...');
    try {
      const res = await fetchWithTimeout('/api/tvshows/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bmTitle, posterPath: bmPosterUrl || null, streamingUrl: bmStreamingUrl || null,
          notes: bmNotes || null, status: bmStatus, rating: bmRating ? parseInt(bmRating) : null,
          seasons: bmSeasons ? parseInt(bmSeasons) : null, currentSeason: bmCurrentSeason ? parseInt(bmCurrentSeason) : null,
          currentEpisode: bmCurrentEpisode ? parseInt(bmCurrentEpisode) : null, network: bmNetwork || null, genre: bmGenre || null,
        }),
      });
      if (res.ok) {
        toast.success('Serie guardada', { id: loadingToast });
        setShowAddDialog(false);
        loadBookmarks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al guardar', { id: loadingToast });
      }
    } catch (err) {
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo agotado' : 'Error de conexión', { id: loadingToast });
    }
  };

  const updateBookmark = async () => {
    if (!editingBm || !bmTitle.trim()) return;
    const loadingToast = toast.loading('Actualizando serie...');
    try {
      const res = await fetchWithTimeout(`/api/tvshows/bookmarks/${editingBm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bmTitle, posterPath: bmPosterUrl || null, streamingUrl: bmStreamingUrl || null,
          notes: bmNotes || null, status: bmStatus, rating: bmRating ? parseInt(bmRating) : null,
          seasons: bmSeasons ? parseInt(bmSeasons) : null, currentSeason: bmCurrentSeason ? parseInt(bmCurrentSeason) : null,
          currentEpisode: bmCurrentEpisode ? parseInt(bmCurrentEpisode) : null, network: bmNetwork || null, genre: bmGenre || null,
        }),
      });
      if (res.ok) {
        toast.success('Serie actualizada', { id: loadingToast });
        setShowAddDialog(false); setEditingBm(null);
        loadBookmarks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al actualizar', { id: loadingToast });
      }
    } catch (err) {
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo agotado' : 'Error de conexión', { id: loadingToast });
    }
  };

  const deleteBookmark = async (id: string) => {
    if (!confirm('¿Eliminar esta serie?')) return;
    try {
      const res = await fetchWithTimeout(`/api/tvshows/bookmarks/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Eliminada'); loadBookmarks(); }
    } catch { toast.error('Error al eliminar'); }
  };

  const closeDialog = () => {
    setShowAddDialog(false); setEditingBm(null);
    setBmTitle(''); setBmPosterUrl(''); setBmStreamingUrl(''); setBmNotes('');
    setBmStatus('pendiente'); setBmRating(''); setBmSeasons(''); setBmCurrentSeason(''); setBmCurrentEpisode('');
    setBmNetwork(''); setBmGenre('');
  };

  const tvDisplayName = currentTvVideo?.name.replace(/\.[^.]+$/, '') || '';

  return (
    <div className="space-y-4">
      {/* Video Player Overlay */}
      {currentTvVideo && (
        <div ref={playerContainerRef} className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-black/80 text-white absolute top-0 left-0 right-0 z-10">
            <h3 className="text-sm font-medium truncate">{tvDisplayName}</h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" title="Copiar enlace" onClick={() => copyDirectLink(currentTvVideo)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" title="Abrir en nueva pestaña" onClick={() => openInNewTab(currentTvVideo)}>
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" onClick={closeTvVideo}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {videoError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
              <div className="p-4 rounded-2xl bg-white/10"><AlertTriangle className="h-12 w-12 text-amber-400" /></div>
              <div className="text-center max-w-md">
                <h3 className="text-lg font-semibold text-white mb-2">Formato no soportado en el navegador</h3>
                <p className="text-sm text-white/60 mb-1">{currentTvVideo.name}</p>
                <p className="text-xs text-white/40 mb-6">Puedes abrir el enlace directamente con VLC u otro reproductor externo.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={() => openInNewTab(currentTvVideo)}><ExternalLink className="h-4 w-4 mr-2" />Abrir enlace directo</Button>
                  <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={() => copyDirectLink(currentTvVideo)}><Copy className="h-4 w-4 mr-2" />Copiar enlace</Button>
                  <Button variant="ghost" className="text-white/60 hover:text-white" onClick={closeTvVideo}>Cerrar</Button>
                </div>
              </div>
            </div>
          ) : (
            <video ref={videoRef} className="w-full h-full object-contain" autoPlay controls playsInline onError={() => setVideoError(true)} src={getStreamUrl(currentTvVideo)} />
          )}
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carpetas de Series</DialogTitle>
            <DialogDescription>{folderPicker.pickerMode ? 'Navega y selecciona una carpeta' : 'Configura las carpetas donde buscas series'}</DialogDescription>
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
              {tvshowLibraryPaths.map((p, i) => (
                <div key={p} className="flex items-center gap-2 min-w-0">
                  <Monitor className="h-4 w-4 text-sky-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono truncate min-w-0" title={p}>{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateTvShowPaths(tvshowLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="/mnt/MisSeries" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1 min-w-[120px]" />
              <Button variant="outline" onClick={folderPicker.openPicker} title="Explorar carpetas">
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { if (newPath.trim()) { const p = newPath.trim(); if (tvshowLibraryPaths.includes(p)) { toast.info('Ya existe'); return; } try { const np = [...tvshowLibraryPaths, p]; setTvshowLibraryPaths(np); await saveTvShowPaths(np); toast.success('Carpeta agregada'); setNewPath(''); } catch { toast.error('Error al guardar'); } } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Las carpetas se guardan en la base de datos.</p>
          </div>
          )}
          <DialogFooter>{!folderPicker.pickerMode && <Button variant="outline" onClick={() => setShowSettings(false)}>Cerrar</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog (rename + cover) */}
      <Dialog open={!!editFolder} onOpenChange={(open) => { if (!open) { setEditFolder(null); setEditCoverFile(null); if (editCoverPreview) URL.revokeObjectURL(editCoverPreview); setEditCoverPreview(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Carpeta</DialogTitle>
            <DialogDescription>Cambia el nombre o agrega una carátula</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cover preview + upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/50">
                {(editCoverPreview || editCoverFile) ? (
                  <img
                    src={editCoverFile ? URL.createObjectURL(editCoverFile) : editCoverPreview!}
                    alt="Carátula"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs">Sin carátula</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Label htmlFor="cover-upload-tv" className="cursor-pointer">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    Subir carátula
                  </div>
                </Label>
                <input
                  id="cover-upload-tv"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setEditCoverFile(file);
                    e.target.value = '';
                  }}
                />
                {editCoverFile && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditCoverFile(null)}>
                    <X className="h-3 w-3 mr-1" />Quitar
                  </Button>
                )}
              </div>
            </div>
            {/* Folder name */}
            <div className="space-y-2">
              <Label htmlFor="edit-folder-name-tv" className="text-sm">Nombre de la carpeta</Label>
              <Input
                id="edit-folder-name-tv"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEditFolder(); if (e.key === 'Escape') { setEditFolder(null); setEditCoverFile(null); if (editCoverPreview) URL.revokeObjectURL(editCoverPreview); setEditCoverPreview(null); } }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditFolder(null); setEditCoverFile(null); if (editCoverPreview) URL.revokeObjectURL(editCoverPreview); setEditCoverPreview(null); }}>Cancelar</Button>
            <Button onClick={saveEditFolder} disabled={savingEdit || !editFolderName.trim() || (editFolderName.trim() === editFolder?.name && !editCoverFile)}>
              {savingEdit ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" />Guardando...</> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameItem} onOpenChange={(open) => { if (!open) setRenameItem(null); }}>
        <DialogContent>
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

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goBack} disabled={tvshowPathHistory.length <= 1}><ArrowLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goUp}><ChevronUp className="h-4 w-4" /></Button>
          {tvshowLibraryPaths.map((p) => (
            <Button key={p} variant={tvshowCurrentPath === p ? 'secondary' : 'ghost'} size="sm" className="h-8 flex-shrink-0 text-xs max-w-[140px]" onClick={() => { setTvshowPathHistory([p]); setTvshowCurrentPath(p); }}>
              <Monitor className="h-3.5 w-3.5 mr-1 shrink-0" /><span className="truncate">{p.split('/').pop()}</span>
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => navigateTo('/')}><HomeIcon className="h-4 w-4" /></Button>
          {tvshowCurrentPath !== '/' && !tvshowLibraryPaths.includes(tvshowCurrentPath) && (
            <><ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span className="text-sm font-medium truncate">{tvshowCurrentPath.split('/').pop()}</span></>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar en todo..." value={tvSearchQuery} onChange={(e) => setTvSearchQuery(e.target.value)} className="pl-9 h-8 w-48" />
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
        <Button variant={activeTab === 'local' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('local')}>
          <Monitor className="h-3.5 w-3.5 mr-1" />Series de Archivo
        </Button>
        <Button variant={activeTab === 'bookmarks' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('bookmarks')}>
          <Bookmark className="h-3.5 w-3.5 mr-1" />Mis Series
        </Button>
      </div>

      {tvIsSearching ? (
        /* ── Unified Search Results ── */
        <div className="space-y-6">
          {(filteredFolders.length > 0 || filteredTvFiles.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Monitor className="h-4 w-4" />Series de Archivo
                <Badge variant="secondary" className="text-xs">{filteredFolders.length + filteredTvFiles.length}</Badge>
              </h3>
              <div className="space-y-4">
                {filteredFolders.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {filteredFolders.sort((a, b) => a.name.localeCompare(b.name)).map((folder) => (
                      <Card key={folder.path} className="group cursor-pointer hover:border-sky-300 dark:hover:border-sky-700 transition-all hover:shadow-md hover:-translate-y-0.5 relative" onClick={() => navigateTo(folder.path)}>
                        <button
                          className={`absolute top-2 left-2 z-10 p-1 rounded-full bg-black/40 backdrop-blur-sm transition-colors ${favoritePaths.has(folder.path) ? 'text-rose-500' : 'text-white/60 hover:text-rose-500'}`}
                          onClick={(e) => toggleFolderFavorite(folder, e)}
                          disabled={favoriteLoading === folder.path}
                        >
                          <Heart className={`h-4 w-4 ${favoritePaths.has(folder.path) ? 'fill-rose-500' : ''}`} />
                        </button>
                        <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                          <div className="relative">
                            <div className="p-3 rounded-xl bg-sky-100 dark:bg-sky-900/30"><Folder className="h-6 w-6 text-sky-600 dark:text-sky-400" /></div>
                            {folder.itemCount > 0 ? <Badge variant="secondary" className="absolute -top-1 -right-1 text-[9px] bg-sky-500/70 text-white h-4 w-4 flex items-center justify-center p-0"><Play className="h-2 w-2" /></Badge> : null}
                          </div>
                          <p className="text-xs font-medium truncate w-full">{folder.name}</p>
                          <p className="text-[10px] text-muted-foreground">{folder.itemCount} video{folder.itemCount !== 1 ? 's' : ''}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {filteredTvFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredTvFiles.sort((a, b) => a.name.localeCompare(b.name)).map((file) => {
                      const displayName = file.name.replace(/\.[^.]+$/, '');
                      const ext = file.extension.toUpperCase();
                      return (
                        <Card key={file.path} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative" onClick={() => playTvVideo(file)}>
                          <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                            <Film className="h-12 w-12 text-white/20 group-hover:text-white/40 transition-colors" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                              <div className="w-14 h-14 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100"><Play className="h-7 w-7 text-sky-600 dark:text-sky-400 ml-1" /></div>
                            </div>
                            <Badge className="absolute top-2 right-2 text-[10px] bg-black/60 text-white border-none">{ext}</Badge>
                          </div>
                          <CardContent className="p-3"><h4 className="text-sm font-medium truncate">{displayName}</h4><span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span></CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {filteredBookmarks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Bookmark className="h-4 w-4" />Mis Series
                <Badge variant="secondary" className="text-xs">{filteredBookmarks.length}</Badge>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredBookmarks.map((bm) => (
                  <Card key={String(bm.id)} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="aspect-[2/3] relative bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-950/40 dark:to-blue-950/40">
                      {bm.posterPath ? <img src={String(bm.posterPath)} alt={String(bm.title)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex flex-col items-center justify-center"><Monitor className="h-12 w-12 text-sky-300 dark:text-sky-700" /></div>}
                      <div className="absolute top-2 left-2"><Badge className={`text-[10px] ${tvShowStatusColor(String(bm.status))}`}>{tvShowStatusLabel(String(bm.status))}</Badge></div>
                      {bm.streamingUrl && <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center"><div className="opacity-0 group-hover:opacity-100 transition-all"><Button size="icon" className="h-10 w-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); window.open(String(bm.streamingUrl), '_blank'); }}><Play className="h-5 w-5 ml-0.5" /></Button></div></div>}
                      {bm.rating != null && Number(bm.rating) > 0 && <div className="absolute bottom-2 left-2"><Badge variant="secondary" className="text-[10px] bg-black/50 text-amber-400 border-none backdrop-blur-sm flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />{Number(bm.rating).toFixed(1)}</Badge></div>}
                    </div>
                    <CardContent className="p-3"><p className="text-sm font-medium truncate">{String(bm.title)}</p><div className="flex items-center gap-1.5 mt-1 flex-wrap">{bm.genre && <span className="text-[10px] text-muted-foreground">{String(bm.genre)}</span>}{bm.seasons && <span className="text-[10px] text-muted-foreground">· {bm.seasons} temp.</span>}</div></CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {filteredFolders.length === 0 && filteredTvFiles.length === 0 && filteredBookmarks.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin resultados</p>
                <p className="text-sm text-muted-foreground">No se encontró &quot;{tvSearchQuery}&quot; en archivos ni en Mis Series</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (<>
      {activeTab === 'local' && (
      <>
        {/* Quick stats */}
        {!loadingFiles && (tvFiles.length > 0 || folders.length > 0) && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
            <span className="font-medium text-sky-600 dark:text-sky-400">{tvFiles.length} videos</span>
            <span>{folders.length} carpetas</span>
            {tvFiles.length > 0 && <span>{formatBytes(totalSize)}</span>}
            <span className="font-mono truncate">{tvshowCurrentPath}</span>
          </div>
        )}

        {/* Loading */}
        {loadingFiles ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-lg" />)}</div>
        ) : folders.length === 0 && tvFiles.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Monitor className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="font-medium mb-1">No hay videos aquí</p>
              <p className="text-sm text-muted-foreground">Configura tus carpetas de Series con el botón <MoreVertical className="h-3.5 w-3.5 inline" /> arriba</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Folders */}
            {filteredFolders.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Carpetas</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {sortedFolders.map((folder) => {
                    const hasCover = coverPaths[folder.path];
                    const subCount = (folder as unknown as { subFolderCount?: number }).subFolderCount || 0;
                    return (
                      <Card key={folder.path} className="group cursor-pointer overflow-hidden hover:border-sky-300 dark:hover:border-sky-700 transition-all hover:shadow-lg hover:-translate-y-1" onClick={() => navigateTo(folder.path)}>
                        {/* Cover */}
                        <div className="aspect-[2/3] relative bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-950/40 dark:to-blue-950/40 overflow-hidden">
                          {hasCover ? (
                            <img
                              src={`/api/music/cover?path=${encodeURIComponent(folder.path)}`}
                              alt={folder.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                              <Folder className="h-12 w-12 text-sky-300 dark:text-sky-700" />
                              <Monitor className="h-6 w-6 text-sky-400 dark:text-sky-600" />
                            </div>
                          )}
                          {/* Play overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                              <Button size="icon" className="h-10 w-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); navigateTo(folder.path); }}>
                                <Play className="h-5 w-5 ml-0.5" />
                              </Button>
                            </div>
                          </div>
                          {/* Heart button */}
                          <button
                            className={`absolute top-2 left-2 z-10 p-1 rounded-full bg-black/40 backdrop-blur-sm transition-colors ${favoritePaths.has(folder.path) ? 'text-rose-500' : 'text-white/60 hover:text-rose-500'}`}
                            onClick={(e) => toggleFolderFavorite(folder, e)}
                            disabled={favoriteLoading === folder.path}
                          >
                            <Heart className={`h-4 w-4 ${favoritePaths.has(folder.path) ? 'fill-rose-500' : ''}`} />
                          </button>
                          {/* Badge */}
                          <div className="absolute top-2 right-2">
                            {folder.itemCount > 0 ? (
                            <Badge variant="secondary" className="text-[10px] bg-sky-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Play className="h-2.5 w-2.5" />{folder.itemCount}</Badge>
                          ) : subCount > 0 ? (
                            <Badge variant="secondary" className="text-[10px] bg-amber-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Folder className="h-2.5 w-2.5" />{subCount}</Badge>
                          ) : null}
                          </div>
                          {/* Actions menu */}
                          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <FileActionsMenu item={folder} onRename={handleRename} onDelete={(f) => handleDelete(f.path, f.name)} onEdit={handleEditFolder} />
                          </div>
                        </div>
                        {/* Folder name */}
                        <CardContent className="p-3">
                          <p className="text-sm font-medium truncate">{folder.name}</p>
                          <p className="text-xs text-muted-foreground">{folder.itemCount > 0 ? `${folder.itemCount} video${folder.itemCount !== 1 ? 's' : ''}` : subCount > 0 ? `${subCount} subcarpeta${subCount !== 1 ? 's' : ''}` : 'Vacío'}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Video Grid */}
            {filteredTvFiles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {sortedFiles.map((file) => {
                  const displayName = file.name.replace(/\.[^.]+$/, '');
                  const ext = file.extension.toUpperCase();
                  return (
                    <Card key={file.path} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative" onClick={() => playTvVideo(file)}>
                      <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                        <Film className="h-12 w-12 text-white/20 group-hover:text-white/40 transition-colors" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <div className="w-14 h-14 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100">
                            <Play className="h-7 w-7 text-sky-600 dark:text-sky-400 ml-1" />
                          </div>
                        </div>
                        <Badge className="absolute top-2 right-2 text-[10px] bg-black/60 text-white border-none">{ext}</Badge>
                      </div>
                      <CardContent className="p-3">
                        <h4 className="text-sm font-medium truncate">{displayName}</h4>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                          <span className="text-[10px] text-muted-foreground">{formatTimeAgo(file.modifiedAt)}</span>
                        </div>
                      </CardContent>
                      {/* Action buttons on hover */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow" onClick={(e) => { e.stopPropagation(); copyDirectLink(file); }} title="Copiar enlace directo">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <FileActionsMenu item={file} onRename={handleRename} onDelete={(f) => handleDelete(f.path, f.name)}>
                          <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </FileActionsMenu>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </>
      )}

      {activeTab === 'bookmarks' && (
        <div className="space-y-4">
          {/* ── Mis Series Favoritas (local) ── */}
          {!loadingBm && (() => {
            const localFavs = bookmarks.filter((bm) => bm.localPath || (bm.notes && String(bm.notes).startsWith('local:')));
            if (localFavs.length === 0) return null;
            return (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />Mis Series Favoritas
                  <Badge variant="secondary" className="text-xs">{localFavs.length}</Badge>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {localFavs.map((bm) => {
                    const bmPath = getBmPath(bm);
                    return (
                      <Card key={String(bm.id)} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative">
                        <div className="relative aspect-[2/3] bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-950/40 dark:to-blue-950/40 overflow-hidden" onClick={() => { if (bmPath) { setActiveTab('local'); navigateTo(bmPath); } }}>
                          <img
                            src={`/api/music/cover?path=${encodeURIComponent(bmPath)}`}
                            alt={String(bm.title)}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <Folder className="h-12 w-12 text-sky-300 dark:text-sky-700" />
                            <Monitor className="h-6 w-6 text-sky-400 dark:text-sky-600" />
                          </div>
                          {/* Navigate overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-all">
                              <Button size="icon" className="h-10 w-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg" onClick={(e) => {
                                e.stopPropagation();
                                if (bmPath) { setActiveTab('local'); navigateTo(bmPath); }
                              }}>
                                <FolderOpen className="h-5 w-5" />
                              </Button>
                            </div>
                          </div>
                          <button
                            className="absolute top-2 left-2 z-10 p-1 rounded-full bg-black/40 backdrop-blur-sm transition-colors text-rose-500 hover:text-rose-600"
                            onClick={(e) => { e.stopPropagation(); deleteLocalFavorite(String(bm.id), e); }}
                            disabled={favoriteLoading === bmPath}
                            title="Quitar de favoritos"
                          >
                            <Heart className="h-4 w-4 fill-rose-500" />
                          </button>
                        </div>
                        <CardContent className="p-3">
                          <h4 className="text-sm font-medium truncate">{String(bm.title)}</h4>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {tvShowStatuses.map((f) => (
              <Button key={f.key} variant={statusFilter === f.key ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setStatusFilter(f.key)}>
                {f.label}
              </Button>
            ))}
          </div>

          {/* Stats */}
          {!loadingBm && bookmarks.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{filteredBookmarks.length} serie{filteredBookmarks.length !== 1 ? 's' : ''} {statusFilter !== 'all' ? tvShowStatusLabel(statusFilter).toLowerCase() + '(s)' : ''}</p>
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="h-3.5 w-3.5 mr-1" />Agregar
              </Button>
            </div>
          )}

          {/* Loading */}
          {loadingBm ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] rounded-lg" />)}
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Monitor className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">{bookmarks.length === 0 ? 'Sin series guardadas aún' : 'No hay resultados'}</p>
                <p className="text-sm text-muted-foreground mb-4">Guarda tus series favoritas con poster y detalles</p>
                {bookmarks.length === 0 && (
                  <Button variant="outline" size="sm" onClick={openAddDialog}>
                    <Plus className="h-4 w-4 mr-1" />Agregar Serie
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredBookmarks.map((bm) => (
                <Card key={String(bm.id)} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  {/* Poster */}
                  <div className="aspect-[2/3] relative bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-950/40 dark:to-blue-950/40">
                    {bm.posterPath ? (
                      <img src={String(bm.posterPath)} alt={String(bm.title)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Monitor className="h-12 w-12 text-sky-300 dark:text-sky-700" />
                      </div>
                    )}
                    {/* Status badge */}
                    <div className="absolute top-2 left-2">
                      <Badge className={`text-[10px] ${tvShowStatusColor(String(bm.status))}`}>
                        {tvShowStatusLabel(String(bm.status))}
                      </Badge>
                    </div>
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                        {bm.streamingUrl && (
                          <Button size="icon" className="h-10 w-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); window.open(String(bm.streamingUrl), '_blank'); }}>
                            <Play className="h-5 w-5 ml-0.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow bg-black/40 hover:bg-white/90 hover:text-foreground text-white border-none" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(bm); }}>
                            <Edit className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteBookmark(String(bm.id)); }} className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {/* Rating */}
                    {bm.rating != null && Number(bm.rating) > 0 && (
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="secondary" className="text-[10px] bg-black/50 text-amber-400 border-none backdrop-blur-sm flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />{Number(bm.rating).toFixed(1)}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">{String(bm.title)}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {bm.genre && <span className="text-[10px] text-muted-foreground">{String(bm.genre)}</span>}
                      {bm.seasons && <span className="text-[10px] text-muted-foreground">· {bm.seasons} temp.</span>}
                    </div>
                    {bm.currentSeason && bm.currentEpisode && (
                      <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-0.5">S{String(bm.currentSeason)}E{String(bm.currentEpisode)}</p>
                    )}
                    {bm.notes && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{String(bm.notes)}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      </>)}

      {/* Add/Edit Bookmark Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) closeDialog(); else setShowAddDialog(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBm ? 'Editar Serie' : 'Agregar Serie'}</DialogTitle>
            <DialogDescription>{editingBm ? 'Modifica los detalles de la serie' : 'Guarda una serie a tu colección'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Título *</Label>
              <Input value={bmTitle} onChange={(e) => setBmTitle(e.target.value)} placeholder="Nombre de la serie" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Temporadas</Label>
                <Input type="number" min="0" value={bmSeasons} onChange={(e) => setBmSeasons(e.target.value)} placeholder="8" />
              </div>
              <div>
                <Label>Género</Label>
                <Input value={bmGenre} onChange={(e) => setBmGenre(e.target.value)} placeholder="Drama, Comedia..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Temporada actual</Label>
                <Input type="number" min="0" value={bmCurrentSeason} onChange={(e) => setBmCurrentSeason(e.target.value)} placeholder="3" />
              </div>
              <div>
                <Label>Episodio actual</Label>
                <Input type="number" min="0" value={bmCurrentEpisode} onChange={(e) => setBmCurrentEpisode(e.target.value)} placeholder="5" />
              </div>
            </div>
            <div>
              <Label>Red</Label>
              <Input value={bmNetwork} onChange={(e) => setBmNetwork(e.target.value)} placeholder="Netflix, HBO, AMC..." />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={bmStatus} onValueChange={setBmStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tvShowStatuses.filter((f) => f.key !== 'all').map((f) => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Calificación (1-10)</Label>
              <Input type="number" min="0" max="10" step="0.1" value={bmRating} onChange={(e) => setBmRating(e.target.value)} placeholder="8.5" className="w-24" />
            </div>
            <div>
              <Label>URL para ver</Label>
              <Input value={bmStreamingUrl} onChange={(e) => setBmStreamingUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>URL del Poster</Label>
              <Input value={bmPosterUrl} onChange={(e) => setBmPosterUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={bmNotes} onChange={(e) => setBmNotes(e.target.value)} placeholder="Notas..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            {editingBm ? (
              <Button onClick={updateBookmark} disabled={!bmTitle.trim()}>Actualizar</Button>
            ) : (
              <Button onClick={createBookmark} disabled={!bmTitle.trim()}>Guardar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
