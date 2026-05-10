'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore, type MediaItem } from '@/lib/store';
import { toast } from 'sonner';
import { fetchWithTimeout, formatBytes, formatTimeAgo } from '@/lib/helpers';
import { useFolderPicker } from '@/hooks/useFolderPicker';
import { useFileActions } from '@/hooks/useFileActions';
import { FolderPickerContent } from '@/components/shared/FolderPickerContent';
import {
  X, RefreshCw, Upload,
  ChevronRight, ChevronUp, Home as HomeIcon, Search, Plus, Edit,
  FolderOpen, Folder, MoreVertical, ExternalLink, ArrowUpDown,
  Image as ImageIcon, Film, Play, Copy, Bookmark, Trash2,
  AlertTriangle, Maximize, Minimize, ArrowLeft, Heart, Subtitles, CaptionsOff, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import FileActionsMenu from '@/components/shared/FileActionsMenu';
import { useVideoSubtitles } from '@/hooks/useVideoSubtitles';

export default function MoviesSection() {
  const {
    movieCurrentPath, setMovieCurrentPath,
    moviePathHistory, setMoviePathHistory,
    movieLibraryPaths, setMovieLibraryPaths,
    currentMovie, setCurrentMovie,
  } = useAppStore();
  const [folders, setFolders] = useState<Array<{ name: string; path: string; itemCount: number }>>([]);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [newPath, setNewPath] = useState('');
  const folderPicker = useFolderPicker(async (path) => {
    try {
      const current = useAppStore.getState().movieLibraryPaths;
      if (current.includes(path)) { toast.info('Esta carpeta ya está en la lista'); return; }
      const newPaths = [...current, path];
      useAppStore.getState().setMovieLibraryPaths(newPaths);
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'movieLibraryPaths', value: JSON.stringify(newPaths) }) });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success('Carpeta agregada');
    } catch (e) { toast.error('No se pudo guardar la carpeta'); console.error(e); }
  });
  const [coverPaths, setCoverPaths] = useState<Record<string, boolean>>({});
  const { renameItem, setRenameItem, renameValue, setRenameValue, handleRename, handleDelete, confirmRename } = useFileActions(() => loadMedia());
  const [sortAsc, setSortAsc] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Edit folder state
  const [editFolder, setEditFolder] = useState<{ path: string; name: string } | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [activeTab, setActiveTab] = useState<'local' | 'bookmarks'>('local');
  const [movieBookmarks, setMovieBookmarks] = useState<Array<Record<string, unknown>>>([]);
  const [showAddBookmark, setShowAddBookmark] = useState(false);
  const [bmTitle, setBmTitle] = useState('');
  const [bmExternalUrl, setBmExternalUrl] = useState('');
  const [bmCoverUrl, setBmCoverUrl] = useState('');
  const [bmNotes, setBmNotes] = useState('');
  const [editingMovieBm, setEditingMovieBm] = useState<Record<string, unknown> | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const {
    availableSubtitles, activeTrack, subtitlesEnabled, loadingSubtitles,
    loadSubtitle, loadSubtitleFromFile, toggleSubtitles,
  } = useVideoSubtitles({ videoPath: currentMovie?.path ?? null, videoRef });

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/media/stream?path=${encodeURIComponent(movieCurrentPath)}&type=video`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setMovies((data.files || []).map((f: Record<string, unknown>) => ({ ...f, type: 'video' as const })));
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
      toast.error('Error cargando películas');
    } finally {
      setLoading(false);
    }
  }, [movieCurrentPath]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  // Load saved movie paths from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings?key=movieLibraryPaths');
        if (res.ok) {
          const data = await res.json();
          if (data.value) {
            const saved = JSON.parse(data.value) as string[];
            if (saved.length > 0) {
              setMovieLibraryPaths(saved);
              setMovieCurrentPath(saved[0]);
              setMoviePathHistory([saved[0]]);
            }
          }
        }
      } catch { /* use defaults */ }
    };
    loadSettings();
  }, [setMovieLibraryPaths, setMovieCurrentPath, setMoviePathHistory]);

  // Save movie paths to database
  const saveMoviePaths = useCallback(async (paths: string[]) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'movieLibraryPaths', value: JSON.stringify(paths) }),
      });
    } catch { /* ignore */ }
  }, []);

  // Wrapper that updates store AND saves to DB
  const updateMoviePaths = useCallback((newPaths: string[]) => {
    setMovieLibraryPaths(newPaths);
    saveMoviePaths(newPaths);
  }, [setMovieLibraryPaths, saveMoviePaths]);

  const navigateTo = (path: string) => {
    setMoviePathHistory([...moviePathHistory, path]);
    setMovieCurrentPath(path);
  };

  const goBack = () => {
    if (moviePathHistory.length > 1) {
      const h = [...moviePathHistory]; h.pop();
      setMoviePathHistory(h);
      setMovieCurrentPath(moviePathHistory[moviePathHistory.length - 2]);
    }
  };

  const goUp = () => {
    const parent = movieCurrentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== movieCurrentPath) navigateTo(parent);
  };

  const playMovie = (movie: MediaItem) => {
    setCurrentMovie(movie);
  };



  const closeMovie = () => {
    if (videoRef.current) videoRef.current.pause();
    setCurrentMovie(null);
    setIsFullscreen(false);
    setVideoError(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getDirectUrl = (movie: MediaItem) => {
    return `${window.location.origin}/api/media/stream?path=${encodeURIComponent(movie.path)}`;
  };

  const getStreamUrl = (movie: MediaItem) => {
    const ext = (movie.extension || '').toLowerCase();
    if (['mp4', 'webm', 'ogv', 'm4v'].includes(ext)) {
      return `/api/media/stream?path=${encodeURIComponent(movie.path)}`;
    }
    return `/api/media/transcode?path=${encodeURIComponent(movie.path)}`;
  };

  const openInNewTab = (movie: MediaItem) => {
    window.open(getDirectUrl(movie), '_blank');
  };

  const copyDirectLink = (movie: MediaItem) => {
    navigator.clipboard.writeText(getDirectUrl(movie));
    toast.success('Enlace copiado al portapapeles');
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const filteredMovies = searchQuery
    ? movies.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : movies;
  const filteredFolders = searchQuery
    ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : folders;
  const filteredMovieBms = searchQuery
    ? movieBookmarks.filter((bm) => String(bm.title).toLowerCase().includes(searchQuery.toLowerCase()))
    : movieBookmarks;
  const movieIsSearching = searchQuery.trim().length > 0;
  const sortedFolders = sortAsc
    ? [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name));
  const sortedMovies = sortAsc
    ? [...filteredMovies].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredMovies].sort((a, b) => b.name.localeCompare(a.name));

  const totalSize = movies.reduce((s, m) => s + m.size, 0);

  // Extract local path from bookmark notes ("local:{JSON}")
  const getBmPath = (bm: Record<string, unknown>): string => {
    if (bm.localPath) return String(bm.localPath);
    if (bm.notes && String(bm.notes).startsWith('local:')) {
      try { return JSON.parse(String(bm.notes).slice(6)).path || ''; } catch { /* */ }
    }
    return '';
  };

  // Derive set of favorited local movie paths (only status 'favorita')
  const favoritePaths = new Set(
    movieBookmarks
      .filter((bm) => bm.status === 'favorita')
      .map((bm) => getBmPath(bm))
      .filter(Boolean)
  );

  // ── Edit Folder (rename + cover) ──
  const handleEditFolder = async (item: { path: string; name: string }) => {
    setEditFolder(item);
    setEditFolderName(item.name);
    setEditCoverFile(null);
    // Load current cover preview
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
      // Rename if changed
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
      // Upload cover if selected
      if (editCoverFile) {
        const formData = new FormData();
        // Use updated path if renamed
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

  // ── Movie Bookmarks ──
  const loadMovieBookmarks = useCallback(async () => {
    try {
      const res = await fetch('/api/movies/bookmarks');
      if (res.ok) { const data = await res.json(); setMovieBookmarks(data.bookmarks || []); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMovieBookmarks(); }, [loadMovieBookmarks]);

  const createMovieBookmark = async () => {
    if (!bmTitle.trim()) return;
    const loading = toast.loading('Guardando película...');
    try {
      const res = await fetchWithTimeout('/api/movies/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bmTitle, streamingUrl: bmExternalUrl || null, posterPath: bmCoverUrl || null, notes: bmNotes || null }),
      });
      if (res.ok) {
        toast.success('Película guardada', { id: loading });
        setShowAddBookmark(false);
        setBmTitle(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes('');
        loadMovieBookmarks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al guardar la película', { id: loading });
      }
    } catch (err) {
      console.error('Movie bookmark error:', err);
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Error de conexión', { id: loading });
    }
  };

  const deleteMovieBookmark = async (id: string) => {
    if (!confirm('¿Eliminar esta película?')) return;
    try {
      const res = await fetchWithTimeout(`/api/movies/bookmarks/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Eliminada'); loadMovieBookmarks(); }
    } catch { toast.error('Error al eliminar'); }
  };

  const openEditMovieDialog = (bm: Record<string, unknown>) => {
    setEditingMovieBm(bm);
    setBmTitle(String(bm.title));
    setBmExternalUrl(String(bm.streamingUrl || ''));
    setBmCoverUrl(String(bm.posterPath || ''));
    setBmNotes(String(bm.notes || ''));
    setShowAddBookmark(true);
  };

  const updateMovieBookmark = async () => {
    if (!editingMovieBm || !bmTitle.trim()) return;
    const loading = toast.loading('Actualizando película...');
    try {
      const res = await fetchWithTimeout(`/api/movies/bookmarks/${editingMovieBm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bmTitle, streamingUrl: bmExternalUrl || null, posterPath: bmCoverUrl || null, notes: bmNotes || null }),
      });
      if (res.ok) {
        toast.success('Película actualizada', { id: loading });
        setShowAddBookmark(false); setEditingMovieBm(null);
        setBmTitle(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes('');
        loadMovieBookmarks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al actualizar', { id: loading });
      }
    } catch (err) {
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Error de conexión', { id: loading });
    }
  };

  // Toggle favorite for a local folder (heart button on folder card)
  const toggleFolderFavorite = async (folder: { name: string; path: string }, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavoriteLoading(folder.path);
    const existing = movieBookmarks.find((bm) => getBmPath(bm) === folder.path && bm.status === 'favorita');
    if (existing) {
      try {
        // Update status to remove 'favorita' instead of deleting
        const res = await fetchWithTimeout(`/api/movies/bookmarks/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: String(existing.title), status: '' }),
        });
        if (res.ok) { toast.success('Película quitada de favoritos'); loadMovieBookmarks(); }
      } catch { toast.error('Error al quitar favorito'); }
    } else {
      // Check if bookmark exists but was unfavorited — re-favorite it
      const bm = movieBookmarks.find((bm) => getBmPath(bm) === folder.path);
      if (bm) {
        try {
          const res = await fetchWithTimeout(`/api/movies/bookmarks/${bm.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: String(bm.title), status: 'favorita' }),
          });
          if (res.ok) { toast.success('Película agregada a favoritos ❤️'); loadMovieBookmarks(); }
        } catch { toast.error('Error al agregar favorito'); }
        setFavoriteLoading(null);
        return;
      }
      try {
        const res = await fetch('/api/movies/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: folder.name,
            notes: `local:${JSON.stringify({ path: folder.path })}`,
            status: 'favorita',
          }),
        });
        if (res.ok) { toast.success('Película agregada a favoritos ❤️'); loadMovieBookmarks(); }
        else if (res.status === 409) toast.info('Ya está en favoritos');
        else { const data = await res.json().catch(() => ({})); toast.error(data.error || 'Error al guardar favorito'); }
      } catch { toast.error('Error de conexión'); }
    }
    setFavoriteLoading(null);
  };

  // Movie name without extension for display
  const movieDisplayName = currentMovie?.name.replace(/\.[^.]+$/, '') || '';

  return (
    <div className="space-y-4">
      {/* Video Player Overlay */}
      {currentMovie && (
        <div ref={containerRef} className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Close + title bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/80 text-white absolute top-0 left-0 right-0 z-10">
            <h3 className="text-sm font-medium truncate">{movieDisplayName}</h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" title="Copiar enlace" onClick={() => copyDirectLink(currentMovie)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" title="Abrir en nueva pestaña" onClick={() => openInNewTab(currentMovie)}>
                <ExternalLink className="h-4 w-4" />
              </Button>
              {/* Subtitles */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className={`h-8 w-8 ${subtitlesEnabled ? 'text-amber-400 hover:text-amber-300' : 'text-white hover:text-white/80'}`} title="Subtítulos">
                    {loadingSubtitles ? <Loader2 className="h-4 w-4 animate-spin" /> : subtitlesEnabled ? <Subtitles className="h-4 w-4" /> : <CaptionsOff className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {activeTrack && (
                    <DropdownMenuItem onClick={toggleSubtitles}>
                      {subtitlesEnabled ? <CaptionsOff className="h-4 w-4 mr-2" /> : <Subtitles className="h-4 w-4 mr-2" />}
                      {subtitlesEnabled ? 'Ocultar subtítulos' : 'Mostrar subtítulos'}
                      <span className="ml-auto text-xs text-muted-foreground">{activeTrack.label}</span>
                    </DropdownMenuItem>
                  )}
                  {availableSubtitles.length > 0 && <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Subtítulos encontrados</div>
                    {availableSubtitles.map((sub) => (
                      <DropdownMenuItem key={sub.path} onClick={() => { loadSubtitle(sub); toast.success(`Subtítulo: ${sub.label}`); }}>
                        <Subtitles className="h-4 w-4 mr-2" />
                        {sub.label}
                        {activeTrack?.path === sub.path && <span className="ml-auto text-xs text-amber-400">●</span>}
                      </DropdownMenuItem>
                    ))}
                  </>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => subtitleInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Cargar subtítulo (.srt / .vtt)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              <div className="relative">
                <FileActionsMenu
                  item={currentMovie}
                  onRename={(item) => handleRename(item)}
                  onDelete={(item) => handleDelete(item.path, item.name)}
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" title="Más opciones">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </FileActionsMenu>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" onClick={closeMovie}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {videoError ? (
            /* Error / Unsupported format fallback */
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
              <div className="p-4 rounded-2xl bg-white/10">
                <AlertTriangle className="h-12 w-12 text-amber-400" />
              </div>
              <div className="text-center max-w-md">
                <h3 className="text-lg font-semibold text-white mb-2">Formato no soportado en el navegador</h3>
                <p className="text-sm text-white/60 mb-1">{currentMovie.name}</p>
                <p className="text-xs text-white/40 mb-6">
                  Los archivos {currentMovie.extension.toUpperCase()} con códec HEVC (H.265) no son compatibles con Chrome/Firefox/Edge.
                  Puedes abrir el enlace directamente con VLC u otro reproductor externo.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={() => openInNewTab(currentMovie)}>
                    <ExternalLink className="h-4 w-4 mr-2" />Abrir enlace directo
                  </Button>
                  <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={() => copyDirectLink(currentMovie)}>
                    <Copy className="h-4 w-4 mr-2" />Copiar enlace
                  </Button>
                  <Button variant="ghost" className="text-white/60 hover:text-white" onClick={closeMovie}>
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              autoPlay
              controls
              playsInline
              onError={() => setVideoError(true)}
              src={getStreamUrl(currentMovie)}
            />
          )}
        </div>
      )}

      {/* Hidden subtitle file input */}
      <input
        ref={subtitleInputRef}
        type="file"
        accept=".srt,.vtt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            loadSubtitleFromFile(file);
            toast.success(`Subtítulo cargado: ${file.name}`);
          }
          e.target.value = '';
        }}
      />
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carpetas de Películas</DialogTitle>
            <DialogDescription>{folderPicker.pickerMode ? 'Navega y selecciona una carpeta' : 'Configura las carpetas donde buscas películas'}</DialogDescription>
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
              {movieLibraryPaths.map((p, i) => (
                <div key={p} className="flex items-center gap-2 min-w-0">
                  <Film className="h-4 w-4 text-rose-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono truncate min-w-0" title={p}>{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateMoviePaths(movieLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="/mnt/MisPeliculas" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1 min-w-[120px]" />
              <Button variant="outline" onClick={folderPicker.openPicker} title="Explorar carpetas">
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { if (newPath.trim()) { const p = newPath.trim(); if (movieLibraryPaths.includes(p)) { toast.info('Ya existe'); return; } try { const np = [...movieLibraryPaths, p]; setMovieLibraryPaths(np); await saveMoviePaths(np); toast.success('Carpeta agregada'); setNewPath(''); } catch { toast.error('Error al guardar'); } } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Las carpetas se guardan en la base de datos y se mantienen al reiniciar.</p>
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
                <Label htmlFor="cover-upload-movie" className="cursor-pointer">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    Subir carátula
                  </div>
                </Label>
                <input
                  id="cover-upload-movie"
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
              <Label htmlFor="edit-folder-name-movie" className="text-sm">Nombre de la carpeta</Label>
              <Input
                id="edit-folder-name-movie"
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

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goBack} disabled={moviePathHistory.length <= 1}><ArrowLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goUp}><ChevronUp className="h-4 w-4" /></Button>
          {movieLibraryPaths.map((p) => (
            <Button key={p} variant={movieCurrentPath === p ? 'secondary' : 'ghost'} size="sm" className="h-8 flex-shrink-0 text-xs max-w-[140px]" onClick={() => { setMoviePathHistory([p]); setMovieCurrentPath(p); }}>
              <Film className="h-3.5 w-3.5 mr-1 shrink-0" /><span className="truncate">{p.split('/').pop()}</span>
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => navigateTo('/')}><HomeIcon className="h-4 w-4" /></Button>
          {movieCurrentPath !== '/' && !movieLibraryPaths.includes(movieCurrentPath) && (
            <><ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span className="text-sm font-medium truncate">{movieCurrentPath.split('/').pop()}</span></>
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
        <Button variant={activeTab === 'local' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('local')}>
          <Film className="h-3.5 w-3.5 mr-1" />Archivos Locales
        </Button>
        <Button variant={activeTab === 'bookmarks' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('bookmarks')}>
          <Bookmark className="h-3.5 w-3.5 mr-1" />Mis Películas
        </Button>
      </div>

      {movieIsSearching ? (
        /* ── Unified Search Results ── */
        <div className="space-y-6">
          {(filteredFolders.length > 0 || filteredMovies.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Film className="h-4 w-4" />Archivos Locales
                <Badge variant="secondary" className="text-xs">{filteredFolders.length + filteredMovies.length}</Badge>
              </h3>
              <div className="space-y-4">
                {filteredFolders.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filteredFolders.sort((a, b) => a.name.localeCompare(b.name)).map((folder) => (
                      <Card key={folder.path} className="group cursor-pointer hover:border-rose-300 dark:hover:border-rose-700 transition-all hover:shadow-md hover:-translate-y-0.5 relative" onClick={() => navigateTo(folder.path)}>
                        <button
                          className={`absolute top-2 left-2 z-10 p-1 rounded-full bg-black/40 backdrop-blur-sm transition-colors ${favoritePaths.has(folder.path) ? 'text-rose-500' : 'text-white/60 hover:text-rose-500'}`}
                          onClick={(e) => toggleFolderFavorite(folder, e)}
                          disabled={favoriteLoading === folder.path}
                        >
                          <Heart className={`h-4 w-4 ${favoritePaths.has(folder.path) ? 'fill-rose-500' : ''}`} />
                        </button>
                        <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                          <div className="relative">
                            <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/30"><Folder className="h-6 w-6 text-rose-600 dark:text-rose-400" /></div>
                            {folder.itemCount > 0 ? <Badge variant="secondary" className="absolute -top-1 -right-1 text-[9px] bg-rose-500/70 text-white h-4 w-4 flex items-center justify-center p-0">{folder.itemCount}</Badge> : null}
                          </div>
                          <p className="text-xs font-medium truncate w-full">{folder.name}</p>
                          <p className="text-[10px] text-muted-foreground">{folder.itemCount} video{folder.itemCount !== 1 ? 's' : ''}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {filteredMovies.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredMovies.sort((a, b) => a.name.localeCompare(b.name)).map((movie) => {
                      const ext = movie.extension.toUpperCase();
                      return (
                        <Card key={movie.path} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative" onClick={() => playMovie(movie)}>
                          <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                            <Film className="h-12 w-12 text-white/20 group-hover:text-white/40 transition-colors" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                              <div className="w-14 h-14 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100"><Play className="h-7 w-7 text-rose-600 dark:text-rose-400 ml-1" /></div>
                            </div>
                            <Badge className="absolute top-2 right-2 text-[10px] bg-black/60 text-white border-none">{ext}</Badge>
                          </div>
                          <CardContent className="p-3"><h4 className="text-sm font-medium truncate">{movie.name.replace(/\.[^.]+$/, '')}</h4><span className="text-xs text-muted-foreground">{formatBytes(movie.size)}</span></CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {filteredMovieBms.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Bookmark className="h-4 w-4" />Mis Películas
                <Badge variant="secondary" className="text-xs">{filteredMovieBms.length}</Badge>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredMovieBms.map((bm) => (
                  <Card key={String(bm.id)} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="aspect-[2/3] relative bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-950/40 dark:to-pink-950/40">
                      {bm.posterPath ? <img src={String(bm.posterPath)} alt={String(bm.title)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex flex-col items-center justify-center"><Film className="h-12 w-12 text-rose-300 dark:text-rose-700" /></div>}
                      {bm.streamingUrl && <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center"><div className="opacity-0 group-hover:opacity-100 transition-all"><Button size="icon" className="h-10 w-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); window.open(String(bm.streamingUrl), '_blank'); }}><Play className="h-5 w-5 ml-0.5" /></Button></div></div>}
                    </div>
                    <CardContent className="p-3"><p className="text-sm font-medium truncate">{String(bm.title)}</p>{bm.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{String(bm.notes)}</p>}</CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {filteredFolders.length === 0 && filteredMovies.length === 0 && filteredMovieBms.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin resultados</p>
                <p className="text-sm text-muted-foreground">No se encontró &quot;{searchQuery}&quot; en archivos ni en Mis Películas</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (<>
      {activeTab === 'local' && (
      <>
      {/* Quick stats */}
      {!loading && (movies.length > 0 || folders.length > 0) && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
          <span className="font-medium text-rose-600 dark:text-rose-400">{movies.length} películas</span>
          <span>{folders.length} carpetas</span>
          {movies.length > 0 && <span>{formatBytes(totalSize)}</span>}
          <span className="font-mono truncate">{movieCurrentPath}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-lg" />)}</div>
      ) : folders.length === 0 && movies.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Film className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="font-medium mb-1">No hay películas aquí</p>
            <p className="text-sm text-muted-foreground">Configura tus carpetas de películas con el botón <MoreVertical className="h-3.5 w-3.5 inline" /> arriba</p>
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
                    <Card key={folder.path} className="group cursor-pointer overflow-hidden hover:border-rose-300 dark:hover:border-rose-700 transition-all hover:shadow-lg hover:-translate-y-1" onClick={() => navigateTo(folder.path)}>
                      {/* Cover */}
                      <div className="aspect-[2/3] relative bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-950/40 dark:to-pink-950/40 overflow-hidden">
                        {hasCover ? (
                          <img
                            src={`/api/music/cover?path=${encodeURIComponent(folder.path)}`}
                            alt={folder.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <Folder className="h-12 w-12 text-rose-300 dark:text-rose-700" />
                            <Film className="h-6 w-6 text-rose-400 dark:text-rose-600" />
                          </div>
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                            <Button size="icon" className="h-10 w-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); navigateTo(folder.path); }}>
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
                          <Badge variant="secondary" className="text-[10px] bg-rose-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Play className="h-2.5 w-2.5" />{folder.itemCount}</Badge>
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

          {/* Movie Grid */}
          {filteredMovies.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {sortedMovies.map((movie) => {
                const displayName = movie.name.replace(/\.[^.]+$/, '');
                const ext = movie.extension.toUpperCase();
                return (
                  <Card key={movie.path} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative" onClick={() => playMovie(movie)}>
                    <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                      <Film className="h-12 w-12 text-white/20 group-hover:text-white/40 transition-colors" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100">
                          <Play className="h-7 w-7 text-rose-600 dark:text-rose-400 ml-1" />
                        </div>
                      </div>
                      <Badge className="absolute top-2 right-2 text-[10px] bg-black/60 text-white border-none">{ext}</Badge>
                    </div>
                    <CardContent className="p-3">
                      <h4 className="text-sm font-medium truncate">{displayName}</h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{formatBytes(movie.size)}</span>
                        <span className="text-[10px] text-muted-foreground">{formatTimeAgo(movie.modifiedAt)}</span>
                      </div>
                    </CardContent>
                    {/* Action buttons on hover (below heart) */}
                    <div className="absolute top-10 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <Button
                        variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow"
                        onClick={(e) => { e.stopPropagation(); copyDirectLink(movie); }}
                        title="Copiar enlace directo"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <FileActionsMenu 
                        item={movie} 
                        onRename={handleRename} 
                        onDelete={(m) => handleDelete(m.path, m.name)}
                      >
                        <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
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
        <div className="space-y-6">
          {/* ── Mis Películas Favoritas ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />Mis Películas Favoritas
                <Badge variant="secondary" className="text-xs">{movieBookmarks.filter((bm) => favoritePaths.has(getBmPath(bm))).length}</Badge>
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowAddBookmark(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Agregar
              </Button>
            </div>
            {movieBookmarks.filter((bm) => favoritePaths.has(getBmPath(bm))).length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <Heart className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="font-medium mb-1">Sin favoritos aún</p>
                  <p className="text-sm text-muted-foreground">Haz clic en el <Heart className="h-3.5 w-3.5 inline text-rose-400 fill-rose-400" /> junto a cualquier película</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {movieBookmarks.filter((bm) => favoritePaths.has(getBmPath(bm))).map((bm) => {
                  const moviePath = getBmPath(bm);
                  return (
                    <Card key={String(bm.id)} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300" onClick={() => {
                      if (!moviePath) { toast.error('Esta película no tiene ruta local'); return; }
                      setActiveTab('local');
                      navigateTo(moviePath);
                    }}>
                      <div className="aspect-[2/3] relative bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-950/40 dark:to-pink-950/40 overflow-hidden">
                        <img
                          src={`/api/music/cover?path=${encodeURIComponent(moviePath)}`}
                          alt={String(bm.title)}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <Folder className="h-12 w-12 text-rose-300 dark:text-rose-700" />
                          <Film className="h-6 w-6 text-rose-400 dark:text-rose-600" />
                        </div>
                        {/* Navigate overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-all">
                            <Button size="icon" className="h-10 w-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg" onClick={(e) => {
                              e.stopPropagation();
                              setActiveTab('local');
                              navigateTo(moviePath);
                            }}>
                              <FolderOpen className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                        {/* Heart button - clickable to unfavorite */}
                        <button
                          className="absolute top-2 left-2 z-10 p-1 rounded-full bg-black/40 backdrop-blur-sm transition-colors text-rose-500 hover:text-rose-600"
                          onClick={(e) => { e.stopPropagation(); toggleFolderFavorite({ name: String(bm.title), path: moviePath }, e); }}
                          disabled={favoriteLoading === moviePath}
                          title="Quitar de favoritos"
                        >
                          <Heart className="h-4 w-4 fill-rose-500" />
                        </button>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">{String(bm.title)}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{moviePath ? moviePath.split('/').slice(-2, -1).pop() : ''}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Mis Películas (all bookmarks) ── */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{movieBookmarks.filter((bm) => !getBmPath(bm)).length} película{movieBookmarks.filter((bm) => !getBmPath(bm)).length !== 1 ? 's' : ''} guardada{movieBookmarks.filter((bm) => !getBmPath(bm)).length !== 1 ? 's' : ''}</p>
              <Button size="sm" onClick={() => setShowAddBookmark(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Agregar
              </Button>
            </div>
          {movieBookmarks.filter((bm) => !getBmPath(bm)).length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bookmark className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin películas guardadas aún</p>
                <p className="text-sm text-muted-foreground">Guarda películas con links para verlas online</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {movieBookmarks.filter((bm) => !getBmPath(bm)).map((bm) => (
                <Card key={String(bm.id)} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  {/* Poster */}
                  <div className="aspect-[2/3] relative bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-950/40 dark:to-pink-950/40">
                    {bm.posterPath ? (
                      <img
                        src={String(bm.posterPath)}
                        alt={String(bm.title)}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Film className="h-12 w-12 text-rose-300 dark:text-rose-700" />
                      </div>
                    )}
                    {/* Play / Open overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                        {bm.streamingUrl && (
                          <Button size="icon" className="h-10 w-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); window.open(String(bm.streamingUrl), '_blank'); }}>
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
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditMovieDialog(bm); }}>
                            <Edit className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteMovieBookmark(String(bm.id)); }} className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {/* Movie info */}
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">{String(bm.title)}</p>
                    {bm.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{String(bm.notes)}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
      </>)}

      {/* Add/Edit Bookmark Dialog */}
      <Dialog open={showAddBookmark} onOpenChange={(open) => { setShowAddBookmark(open); if (!open) { setEditingMovieBm(null); setBmTitle(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMovieBm ? 'Editar Película' : 'Agregar Película'}</DialogTitle>
            <DialogDescription>{editingMovieBm ? 'Modifica los detalles de la película' : 'Guarda un enlace a tu película favorita'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={bmTitle} onChange={(e) => setBmTitle(e.target.value)} placeholder="Nombre de la película" />
            </div>
            <div>
              <Label>URL para ver (Netflix, Prime, YouTube...)</Label>
              <Input value={bmExternalUrl} onChange={(e) => setBmExternalUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>URL del Poster (opcional)</Label>
              <Input value={bmCoverUrl} onChange={(e) => setBmCoverUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={bmNotes} onChange={(e) => setBmNotes(e.target.value)} placeholder="Notas..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddBookmark(false); setEditingMovieBm(null); setBmTitle(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes(''); }}>Cancelar</Button>
            {editingMovieBm ? (
              <Button onClick={updateMovieBookmark} disabled={!bmTitle.trim()}>Actualizar</Button>
            ) : (
              <Button onClick={createMovieBookmark} disabled={!bmTitle.trim()}>Guardar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
