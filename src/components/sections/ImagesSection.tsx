'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore, type MediaItem } from '@/lib/store';
import { toast } from 'sonner';
import { fetchWithTimeout, formatBytes, formatTimeAgo } from '@/lib/helpers';
import { useFolderPicker } from '@/hooks/useFolderPicker';
import { useFileActions } from '@/hooks/useFileActions';
import { FolderPickerContent } from '@/components/shared/FolderPickerContent';
import {
  X, RefreshCw, FolderPlus,
  ChevronRight, ChevronUp, ChevronLeft, Search, ArrowUpDown,
  FolderOpen, Folder, Image as ImageIcon, Grid3X3, List, Download,
  MoreVertical, ArrowLeft,
  Home as HomeIcon, LayoutDashboard, Plus, Eye, Heart, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import FileActionsMenu from '@/components/shared/FileActionsMenu';

export default function ImagesSection() {
  const {
    imageCurrentPath, setImageCurrentPath,
    imagePathHistory, setImagePathHistory,
    imageLibraryPaths, setImageLibraryPaths,
    currentImage, setCurrentImage,
  } = useAppStore();
  const [folders, setFolders] = useState<Array<{ name: string; path: string; itemCount: number }>>([]);
  const [images, setImages] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [newPath, setNewPath] = useState('');
  const folderPicker = useFolderPicker(async (path) => {
    try {
      const current = useAppStore.getState().imageLibraryPaths;
      if (current.includes(path)) { toast.info('Esta carpeta ya está en la lista'); return; }
      const newPaths = [...current, path];
      useAppStore.getState().setImageLibraryPaths(newPaths);
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'imageLibraryPaths', value: JSON.stringify(newPaths) }) });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success('Carpeta agregada');
    } catch (e) { toast.error('No se pudo guardar la carpeta'); console.error(e); }
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'masonry'>('grid');
  const { renameItem, setRenameItem, renameValue, setRenameValue, handleRename, handleDelete, confirmRename } = useFileActions(() => loadImages());
  const [sortAsc, setSortAsc] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);
  const [favoriteImages, setFavoriteImages] = useState<Array<Record<string, unknown>>>([]);
  const [activeTab, setActiveTab] = useState<'local' | 'bookmarks'>('local');

  // ── Image Bookmarks ──
  const getBmPath = (bm: Record<string, unknown>): string => {
    if (bm.localPath) return String(bm.localPath);
    if (bm.notes && String(bm.notes).startsWith('local:')) {
      try { return JSON.parse(String(bm.notes).slice(6)).path || ''; } catch { return ''; }
    }
    return '';
  };

  const favoritePaths = new Set(favoriteImages.map(getBmPath).filter(Boolean));

  const loadFavorites = useCallback(async () => {
    try {
      const res = await fetch('/api/images/bookmarks');
      if (res.ok) {
        const data = await res.json();
        setFavoriteImages(data.bookmarks || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  const deleteFavorite = async (id: string) => {
    try {
      const res = await fetchWithTimeout(`/api/images/bookmarks/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Imagen quitada de favoritos'); loadFavorites(); }
    } catch { toast.error('Error al quitar favorito'); }
  };

  const toggleImageFavorite = async (img: MediaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavoriteLoading(img.path);
    const existing = favoriteImages.find((bm) => favoritePaths.has(img.path));
    if (existing) {
      try {
        const res = await fetchWithTimeout(`/api/images/bookmarks/${existing.id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Imagen quitada de favoritos'); loadFavorites(); }
      } catch { toast.error('Error al quitar favorito'); }
    } else {
      try {
        const res = await fetch('/api/images/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: img.name,
            notes: `local:${JSON.stringify({ path: img.path, size: img.size || null })}`,
          }),
        });
        if (res.ok) { toast.success('Imagen agregada a favoritos ❤️'); loadFavorites(); }
        else if (res.status === 409) toast.info('Ya está en favoritos');
        else { const data = await res.json().catch(() => ({})); toast.error(data.error || 'Error al guardar favorito'); }
      } catch { toast.error('Error de conexión'); }
    }
    setFavoriteLoading(null);
  };

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/media/stream?path=${encodeURIComponent(imageCurrentPath)}&type=image`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setImages((data.files || []).map((f: Record<string, unknown>) => ({ ...f, type: 'image' as const })));
      }
    } catch {
      toast.error('Error cargando imágenes');
    } finally {
      setLoading(false);
    }
  }, [imageCurrentPath]);

  useEffect(() => { loadImages(); }, [loadImages]);

  // Load saved paths from DB
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings?key=imageLibraryPaths');
        if (res.ok) {
          const data = await res.json();
          if (data.value) {
            const saved = JSON.parse(data.value) as string[];
            if (saved.length > 0) {
              setImageLibraryPaths(saved);
              setImageCurrentPath(saved[0]);
              setImagePathHistory([saved[0]]);
            }
          }
        }
      } catch { /* use defaults */ }
    };
    loadSettings();
  }, [setImageLibraryPaths, setImageCurrentPath, setImagePathHistory]);

  const savePaths = useCallback(async (paths: string[]) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'imageLibraryPaths', value: JSON.stringify(paths) }),
      });
    } catch { /* ignore */ }
  }, []);

  const updatePaths = useCallback((newPaths: string[]) => {
    setImageLibraryPaths(newPaths);
    savePaths(newPaths);
  }, [setImageLibraryPaths, savePaths]);

  const navigateTo = (p: string) => {
    setImagePathHistory([...imagePathHistory, p]);
    setImageCurrentPath(p);
  };

  const goBack = () => {
    if (imagePathHistory.length > 1) {
      const h = [...imagePathHistory]; h.pop();
      setImagePathHistory(h);
      setImageCurrentPath(imagePathHistory[imagePathHistory.length - 2]);
    }
  };

  const goUp = () => {
    const parent = imageCurrentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== imageCurrentPath) navigateTo(parent);
  };

  const openImage = (img: MediaItem) => setCurrentImage(img);

  const filteredFolders = searchQuery ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : folders;
  const filteredImages = searchQuery ? images.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase())) : images;
  const filteredFavoriteImages = searchQuery
    ? favoriteImages.filter((bm) => String(bm.title).toLowerCase().includes(searchQuery.toLowerCase()))
    : favoriteImages;
  const isSearching = searchQuery.trim().length > 0;
  const sortedFolders = sortAsc
    ? [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name));
  const sortedImages = sortAsc
    ? [...filteredImages].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredImages].sort((a, b) => b.name.localeCompare(a.name));
  const totalSize = images.reduce((s, i) => s + i.size, 0);



  const currentImageIndex = currentImage ? images.findIndex((i) => i.path === currentImage.path) : -1;
  const hasPrevImage = currentImageIndex > 0;
  const hasNextImage = currentImageIndex < images.length - 1;

  const navigatePrevImage = () => {
    if (hasPrevImage) setCurrentImage(images[currentImageIndex - 1]);
  };
  const navigateNextImage = () => {
    if (hasNextImage) setCurrentImage(images[currentImageIndex + 1]);
  };

  // Keyboard nav for image viewer
  useEffect(() => {
    if (!currentImage) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navigatePrevImage();
      if (e.key === 'ArrowRight') navigateNextImage();
      if (e.key === 'Escape') setCurrentImage(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  // ─── Image Viewer Overlay ──────────────────────────────
  if (currentImage) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/50">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <ImageIcon className="h-4 w-4 text-white/70 flex-shrink-0" />
              <h3 className="text-sm font-medium text-white truncate">{currentImage.name}</h3>
              <span className="text-xs text-white/50 flex-shrink-0">{formatBytes(currentImage.size)}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={navigatePrevImage} disabled={!hasPrevImage}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-white/70 min-w-[60px] text-center">{currentImageIndex + 1} / {images.length}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={navigateNextImage} disabled={!hasNextImage}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <a href={`/api/media/stream?path=${encodeURIComponent(currentImage.path)}`} download={currentImage.name} className="ml-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
              <div className="ml-1">
                <FileActionsMenu
                  item={currentImage}
                  onRename={(item) => handleRename(item)}
                  onDelete={(item) => handleDelete(item.path, item.name)}
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </FileActionsMenu>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setCurrentImage(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            <img
              src={`/api/media/stream?path=${encodeURIComponent(currentImage.path)}`}
              alt={currentImage.name}
              className="max-w-full max-h-full object-contain rounded shadow-2xl"
            />
          </div>
        </div>

        {/* Rename Dialog - rendered on top of the image viewer */}
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
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Path bar + search + actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goBack} disabled={imagePathHistory.length <= 1}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goUp}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 flex-shrink-0" onClick={() => { setImagePathHistory([imageLibraryPaths[0] || '/mnt/Canal']); setImageCurrentPath(imageLibraryPaths[0] || '/mnt/Canal'); }}>
            <HomeIcon className="h-4 w-4 mr-1" />Imágenes
          </Button>
          {imagePathHistory.length > 1 && imagePathHistory.slice(1).map((p, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <Button variant="ghost" size="sm" className="h-8 max-w-[140px]" onClick={() => {
                setImagePathHistory(imagePathHistory.slice(0, i + 2));
                setImageCurrentPath(p);
              }}>
                <span className="truncate">{p.split('/').pop()}</span>
              </Button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 w-40 pl-9 text-sm" />
          </div>
          <div className="flex border rounded-md overflow-hidden">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('grid')}><Grid3X3 className="h-4 w-4" /></Button>
            <Button variant={viewMode === 'masonry' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('masonry')}><LayoutDashboard className="h-4 w-4" /></Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button>
          </div>
          <Button variant={sortAsc ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setSortAsc(!sortAsc)} title={sortAsc ? 'A → Z' : 'Z → A'}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowSettings(true)}>
            <MoreVertical className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadImages}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <Button variant={activeTab === 'local' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('local')}>
          <ImageIcon className="h-3.5 w-3.5 mr-1" />Imágenes Locales
        </Button>
        <Button variant={activeTab === 'bookmarks' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => { setActiveTab('bookmarks'); loadFavorites(); }}>
          <Heart className="h-3.5 w-3.5 mr-1" />Mis Favoritas
        </Button>
      </div>

      {isSearching ? (
        /* ── Unified Search Results ── */
        <div className="space-y-6">
          {(filteredFolders.length > 0 || filteredImages.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />Archivos Locales
                <Badge variant="secondary" className="text-xs">{filteredFolders.length + filteredImages.length}</Badge>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredFolders.sort((a, b) => a.name.localeCompare(b.name)).map((f) => (
                  <Card key={f.path} className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden" onClick={() => navigateTo(f.path)}>
                    <div className="aspect-video relative bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-950/40 dark:to-pink-950/40 flex flex-col items-center justify-center gap-2 p-3">
                      <Folder className="h-10 w-10 text-rose-500/70" />
                      <div className="text-center">
                        <p className="text-xs font-medium truncate w-full">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground">{f.itemCount} imágenes</p>
                      </div>
                    </div>
                  </Card>
                ))}
                {filteredImages.sort((a, b) => a.name.localeCompare(b.name)).map((img) => (
                  <Card key={img.path} className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden" onClick={() => openImage(img)}>
                    <div className="aspect-[2/3] relative bg-muted">
                      <img src={`/api/media/stream?path=${encodeURIComponent(img.path)}`} alt={img.name} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                      <button
                        className={`absolute top-2 left-2 z-10 p-1 rounded-full bg-black/40 backdrop-blur-sm transition-colors ${favoritePaths.has(img.path) ? 'text-rose-500' : 'text-white/60 hover:text-rose-500'}`}
                        onClick={(e) => toggleImageFavorite(img, e)}
                        disabled={favoriteLoading === img.path}
                      >
                        <Heart className={`h-4 w-4 ${favoritePaths.has(img.path) ? 'fill-rose-500' : ''}`} />
                      </button>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{img.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatBytes(img.size)}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {filteredFavoriteImages.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Heart className="h-4 w-4" />Mis Favoritas
                <Badge variant="secondary" className="text-xs">{filteredFavoriteImages.length}</Badge>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredFavoriteImages.map((bm) => {
                  const bmPath = String(bm.localPath || getBmPath(bm));
                  return (
                  <Card key={String(bm.id)} className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden" onClick={() => { if (bm.localPath) openImage({ name: String(bm.title), path: String(bm.localPath), size: (bm.localSize as number) || 0, type: 'image' }); }}>
                    <div className="aspect-[2/3] relative bg-muted">
                      {bm.localPath && (
                        <img src={`/api/media/stream?path=${encodeURIComponent(String(bm.localPath))}`} alt={String(bm.title)} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                      )}
                      {/* Heart button to unfavorite */}
                      <button
                        className="absolute top-2 left-2 z-10 p-1 rounded-full bg-black/40 backdrop-blur-sm transition-colors text-rose-500 hover:text-rose-600"
                        onClick={(e) => { e.stopPropagation(); if (bmPath) { const fakeImg = { name: String(bm.title), path: bmPath, size: (bm.localSize as number) || 0, type: 'image' as const }; toggleImageFavorite(fakeImg, e); } }}
                        disabled={favoriteLoading === bmPath}
                      >
                        <Heart className="h-4 w-4 fill-rose-500" />
                      </button>
                      <div className="absolute top-2 right-2 z-10">
                        <Button variant="ghost" size="icon" className="h-7 w-7 bg-black/40 backdrop-blur-sm text-white hover:text-red-400" onClick={(e) => { e.stopPropagation(); deleteFavorite(String(bm.id)); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{String(bm.title)}</p>
                      {bm.localSize && <p className="text-[10px] text-muted-foreground">{formatBytes(Number(bm.localSize))}</p>}
                    </div>
                  </Card>
                  );
                })}
              </div>
            </div>
          )}
          {filteredFolders.length === 0 && filteredImages.length === 0 && filteredFavoriteImages.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin resultados</p>
                <p className="text-sm text-muted-foreground">No se encontró &quot;{searchQuery}&quot; en archivos ni en Mis Favoritas</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : activeTab === 'bookmarks' ? (
        /* ── Bookmarks Tab ── */
        <div>
          {filteredFavoriteImages.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Heart className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No tienes imágenes favoritas</p>
                <p className="text-xs text-muted-foreground mt-1">Haz clic en el corazón ❤️ en cualquier imagen para guardarla aquí</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span>{filteredFavoriteImages.length} imagen{filteredFavoriteImages.length !== 1 ? 'es' : ''} favorita{filteredFavoriteImages.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredFavoriteImages.map((bm) => {
                  const bmPath = String(bm.localPath || getBmPath(bm));
                  const isFav = favoritePaths.has(bmPath);
                  return (
                  <Card key={String(bm.id)} className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden" onClick={() => { if (bm.localPath) openImage({ name: String(bm.title), path: String(bm.localPath), size: (bm.localSize as number) || 0, type: 'image' }); }}>
                    <div className="aspect-[2/3] relative bg-muted">
                      {bm.localPath && (
                        <img src={`/api/media/stream?path=${encodeURIComponent(String(bm.localPath))}`} alt={String(bm.title)} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {/* Heart button to unfavorite */}
                      <button
                        className="absolute top-2 left-2 z-10 p-1 rounded-full bg-black/40 backdrop-blur-sm transition-colors text-rose-500 hover:text-rose-600"
                        onClick={(e) => { e.stopPropagation(); if (bmPath) { const fakeImg = { name: String(bm.title), path: bmPath, size: (bm.localSize as number) || 0, type: 'image' as const }; toggleImageFavorite(fakeImg, e); } }}
                        disabled={favoriteLoading === bmPath}
                      >
                        <Heart className="h-4 w-4 fill-rose-500" />
                      </button>
                      <div className="absolute top-2 right-2 z-10">
                        <Button variant="ghost" size="icon" className="h-7 w-7 bg-black/40 backdrop-blur-sm text-white hover:text-red-400" onClick={(e) => { e.stopPropagation(); deleteFavorite(String(bm.id)); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{String(bm.title)}</p>
                      {bm.localSize && <p className="text-[10px] text-muted-foreground">{formatBytes(Number(bm.localSize))}</p>}
                    </div>
                  </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : null}

      {!isSearching && activeTab === 'local' && (
      <>
      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carpetas de Imágenes</DialogTitle>
            <DialogDescription>{folderPicker.pickerMode ? 'Navega y selecciona una carpeta' : 'Configura las carpetas donde buscas imágenes'}</DialogDescription>
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
              {imageLibraryPaths.map((p, i) => (
                <div key={i} className="flex items-center gap-2 min-w-0">
                  <ImageIcon className="h-4 w-4 text-rose-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono truncate min-w-0" title={p}>{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updatePaths(imageLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="/mnt/MisFotos" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1 min-w-[120px]" />
              <Button variant="outline" onClick={folderPicker.openPicker} title="Explorar carpetas">
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { if (newPath.trim()) { const p = newPath.trim(); if (imageLibraryPaths.includes(p)) { toast.info('Ya existe'); return; } try { const np = [...imageLibraryPaths, p]; setImageLibraryPaths(np); await savePaths(np); toast.success('Carpeta agregada'); setNewPath(''); } catch { toast.error('Error al guardar'); } } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
          </div>
          )}
          <DialogFooter>{!folderPicker.pickerMode && <Button variant="outline" onClick={() => setShowSettings(false)}>Cerrar</Button>}</DialogFooter>
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

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="font-mono text-xs">{imageCurrentPath}</span>
        <span className="flex-1" />
        <span>{folders.length} carpetas</span>
        <span>{images.length} imágenes</span>
        <span>{formatBytes(totalSize)}</span>
      </div>

      {/* Loading */}
      {loading ? (
        <div className={viewMode === 'list' ? 'space-y-2' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'}>
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className={viewMode === 'list' ? 'h-12 rounded-lg' : 'aspect-[2/3] rounded-lg'} />)}
        </div>
      ) : filteredFolders.length === 0 && filteredImages.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ImageIcon className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No se encontraron imágenes</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Navega a una carpeta con archivos de imagen (JPG, PNG, GIF, WebP...)</p>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <FolderPlus className="h-4 w-4 mr-1" />Configurar carpetas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div ref={containerRef}>
          {/* Folders */}
          {filteredFolders.length > 0 && viewMode !== 'list' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mb-4">
              {sortedFolders.map((f) => (
                <Card key={f.path} className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden" onClick={() => navigateTo(f.path)}>
                  <div className="aspect-video relative bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-950/40 dark:to-pink-950/40 flex flex-col items-center justify-center gap-2 p-3">
                    <Folder className="h-10 w-10 text-rose-500/70" />
                    <div className="text-center">
                      <p className="text-xs font-medium truncate w-full">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{f.itemCount} imágenes</p>
                    </div>
                    {/* Actions menu */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <FileActionsMenu item={f} onRename={handleRename} onDelete={(fi) => handleDelete(fi.path, fi.name)} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {filteredFolders.length > 0 && viewMode === 'list' && (
            <div className="space-y-1 mb-4">
              {sortedFolders.map((f) => (
                <div key={f.path} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigateTo(f.path)}>
                  <Folder className="h-4 w-4 text-rose-500" />
                  <span className="text-sm flex-1">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{f.itemCount} imágenes</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}

          {/* Images grid */}
          {viewMode === 'grid' && filteredImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {sortedImages.map((img) => (
                <Card key={img.path} className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden" onClick={() => openImage(img)}>
                  <div className="aspect-[2/3] relative bg-muted">
                    <img
                      src={`/api/media/stream?path=${encodeURIComponent(img.path)}`}
                      alt={img.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {/* Heart button */}
                    <button
                      className={`absolute top-2 left-2 z-10 p-1 rounded-full bg-black/40 backdrop-blur-sm transition-colors ${favoritePaths.has(img.path) ? 'text-rose-500' : 'text-white/60 hover:text-rose-500'}`}
                      onClick={(e) => toggleImageFavorite(img, e)}
                      disabled={favoriteLoading === img.path}
                    >
                      <Heart className={`h-4 w-4 ${favoritePaths.has(img.path) ? 'fill-rose-500' : ''}`} />
                    </button>
                    {/* Actions menu */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <FileActionsMenu item={img} onRename={handleRename} onDelete={(i) => handleDelete(i.path, i.name)} />
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{img.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBytes(img.size)}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Masonry view */}
          {viewMode === 'masonry' && filteredImages.length > 0 && (
            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-3 space-y-3">
              {sortedImages.map((img) => (
                <div key={img.path} className="break-inside-avoid group cursor-pointer" onClick={() => openImage(img)}>
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    <img
                      src={`/api/media/stream?path=${encodeURIComponent(img.path)}`}
                      alt={img.name}
                      className="w-full h-auto object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {/* Heart button */}
                    <button
                      className={`absolute top-2 left-2 z-10 p-1 rounded-full bg-black/40 backdrop-blur-sm transition-colors ${favoritePaths.has(img.path) ? 'text-rose-500' : 'text-white/60 hover:text-rose-500'}`}
                      onClick={(e) => toggleImageFavorite(img, e)}
                      disabled={favoriteLoading === img.path}
                    >
                      <Heart className={`h-4 w-4 ${favoritePaths.has(img.path) ? 'fill-rose-500' : ''}`} />
                    </button>
                    {/* Actions menu */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <FileActionsMenu item={img} onRename={handleRename} onDelete={(i) => handleDelete(i.path, i.name)} />
                    </div>
                  </div>
                  <p className="text-xs font-medium truncate mt-1.5 px-1">{img.name}</p>
                </div>
              ))}
            </div>
          )}

          {/* List view */}
          {viewMode === 'list' && filteredImages.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {sortedImages.map((img) => (
                    <div key={img.path} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => openImage(img)}>
                      <div className="w-10 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
                        <img src={`/api/media/stream?path=${encodeURIComponent(img.path)}`} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{img.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0">{formatBytes(img.size)}</p>
                      <p className="text-xs text-muted-foreground flex-shrink-0 w-20 text-right">{formatTimeAgo(img.modifiedAt)}</p>
                      <button
                        className={`p-1 rounded-full transition-colors ${favoritePaths.has(img.path) ? 'text-rose-500' : 'text-muted-foreground/50 hover:text-rose-500'}`}
                        onClick={(e) => toggleImageFavorite(img, e)}
                        disabled={favoriteLoading === img.path}
                      >
                        <Heart className={`h-4 w-4 ${favoritePaths.has(img.path) ? 'fill-rose-500' : ''}`} />
                      </button>
                      <FileActionsMenu item={img} onRename={handleRename} onDelete={(i) => handleDelete(i.path, i.name)} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={(e) => { e.stopPropagation(); openImage(img); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}


// ─── Main App ────────────────────────────────────────────────
