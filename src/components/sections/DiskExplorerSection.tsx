'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, ArrowUpDown, ChevronRight, ChevronUp, Download,
  FolderOpen, FolderPlus, Grid3X3, HardDrive, Home as HomeIcon,
  List, RefreshCw, Server as ServerIcon, Trash2, Upload, X,
} from 'lucide-react';
import { useAppStore, type FileItem } from '@/lib/store';
import { toast } from 'sonner';
import { formatBytes, formatTimeAgo, fileIcon } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function DiskExplorerSection() {
  const { currentPath, setCurrentPath, pathHistory, setPathHistory, selectedFiles, setSelectedFiles, toggleFileSelection, viewMode, setViewMode, diskPaths, setDiskPaths } = useAppStore();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showMkdir, setShowMkdir] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const loadFiles = useCallback(async () => {
    if (currentPath === '/') {
      setLoading(false);
      setFiles([]);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/files?path=${encodeURIComponent(currentPath)}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.items || []);
      } else {
        toast.error('Error al cargar directorio');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    loadFiles();
    setSelectedFiles([]);
  }, [currentPath, loadFiles, setSelectedFiles]);

  const navigateTo = (path: string) => {
    setPathHistory([...pathHistory, path]);
    setCurrentPath(path);
  };

  const goBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = [...pathHistory];
      newHistory.pop();
      const parent = pathHistory[pathHistory.length - 2];
      setPathHistory(newHistory);
      setCurrentPath(parent);
    } else {
      setPathHistory(['/']);
      setCurrentPath('/');
    }
  };

  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== currentPath) {
      navigateTo(parent);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i]);
    }
    formData.append('path', currentPath);

    try {
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.count} archivo(s) subido(s)`);
        loadFiles();
      } else {
        toast.error('Error al subir');
      }
    } catch {
      toast.error('Error de conexión');
    }
    if (uploadRef.current) uploadRef.current.value = '';
    setShowUpload(false);
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const res = await fetch(`/api/files/download?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        toast.error('Error al descargar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleDelete = async (filePath: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (res.ok) {
        toast.success(`"${name}" eliminado`);
        loadFiles();
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleMkdir = async () => {
    if (!newDirName.trim()) return;
    try {
      const res = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPath: currentPath, name: newDirName.trim() }),
      });
      if (res.ok) {
        toast.success(`Carpeta "${newDirName}" creada`);
        setNewDirName('');
        setShowMkdir(false);
        loadFiles();
      } else {
        toast.error('Error al crear carpeta');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleBatchDownload = () => {
    selectedFiles.forEach((path) => {
      const name = path.split('/').pop() || path;
      handleDownload(path, name);
    });
    setSelectedFiles([]);
  };

  const handleBatchDelete = async () => {
    if (!confirm(`¿Eliminar ${selectedFiles.length} elemento(s)?`)) return;
    for (const path of selectedFiles) {
      await handleDelete(path, path.split('/').pop() || path);
    }
    setSelectedFiles([]);
  };

  const sorted = sortAsc
    ? [...files].sort((a, b) => a.name.localeCompare(b.name))
    : [...files].sort((a, b) => b.name.localeCompare(a.name));
  const directories = sorted.filter((f) => f.isDirectory);
  const regularFiles = sorted.filter((f) => !f.isDirectory);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goBack} disabled={currentPath === '/'}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goUp} disabled={currentPath === '/'}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          {currentPath !== '/' && (
            <>
              <Button variant="ghost" size="sm" className="h-8 flex-shrink-0" onClick={() => { setPathHistory(['/']); setCurrentPath('/'); }}>
                <HomeIcon className="h-4 w-4 mr-1" />
                Discos
              </Button>
              <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium truncate">{currentPath.split('/').pop()}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View mode */}
          {currentPath !== '/' && (
          <div className="flex border rounded-md overflow-hidden">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('grid')}>
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('list')}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          )}

          {/* Actions */}
          {currentPath !== '/' && (
          <>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setShowMkdir(true)}>
            <FolderPlus className="h-4 w-4 mr-1" />
            Nueva Carpeta
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-4 w-4 mr-1" />
            Subir
          </Button>
          </>
          )}
          {currentPath !== '/' && (
          <Button variant={sortAsc ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setSortAsc(!sortAsc)} title={sortAsc ? 'A → Z' : 'Z → A'}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadFiles}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Upload zone */}
      {currentPath !== '/' && showUpload && (
        <Card className="border-dashed border-2 border-emerald-300 dark:border-emerald-700">
          <CardContent className="p-6 text-center">
            <Upload className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
            <p className="font-medium mb-1">Arrastra archivos aquí</p>
            <p className="text-sm text-muted-foreground mb-3">o selecciona archivos</p>
            <input
              ref={uploadRef}
              type="file"
              multiple
              className="block mx-auto"
              onChange={handleUpload}
            />
          </CardContent>
        </Card>
      )}

      {/* New Folder Dialog */}
      <Dialog open={showMkdir} onOpenChange={setShowMkdir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Carpeta</DialogTitle>
            <DialogDescription>Crea una nueva carpeta en: {currentPath}</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Nombre de la carpeta"
            value={newDirName}
            onChange={(e) => setNewDirName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleMkdir()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMkdir(false)}>Cancelar</Button>
            <Button onClick={handleMkdir} disabled={!newDirName.trim()}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch actions */}
      {selectedFiles.length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
          <span className="text-sm text-muted-foreground">{selectedFiles.length} seleccionado(s)</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleBatchDownload}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Descargar
          </Button>
          <Button variant="outline" size="sm" className="text-red-500" onClick={handleBatchDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Eliminar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedFiles([])}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Current path */}
      {currentPath !== '/' && <p className="text-xs text-muted-foreground font-mono">{currentPath}</p>}

      {/* Disk Cards View - shows at root */}
      {!loading && currentPath === '/' && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Discos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {diskPaths.map((diskPath) => {
              const diskName = diskPath.split('/').pop() || diskPath;
              const isHome = diskPath.startsWith('/home');
              return (
                <Card
                  key={diskPath}
                  className="group cursor-pointer overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-700 transition-all hover:shadow-lg hover:-translate-y-1"
                  onClick={() => { setPathHistory(['/', diskPath]); setCurrentPath(diskPath); }}
                >
                  <div className="aspect-square relative bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/40 dark:to-teal-950/40 flex flex-col items-center justify-center gap-3">
                    <div className="p-4 rounded-2xl bg-emerald-200/50 dark:bg-emerald-800/30">
                      {isHome ? (
                        <ServerIcon className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <HardDrive className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{diskName}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{diskPath}</span>
                    <ChevronRight className="h-5 w-5 text-emerald-400 dark:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading */}
      {currentPath !== '/' && loading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3' : 'space-y-2'}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className={viewMode === 'grid' ? 'h-24 rounded-lg' : 'h-12 rounded-lg'} />
          ))}
        </div>
      ) : currentPath !== '/' && files.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Directorio vacío</p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {directories.map((item) => (
            <Card
              key={item.path}
              className={`group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden ${
                selectedFiles.includes(item.path) ? 'ring-2 ring-emerald-500 border-emerald-300' : ''
              }`}
              onClick={(e) => {
                if (e.detail === 2) { navigateTo(item.path); return; }
                toggleFileSelection(item.path);
              }}
              onDoubleClick={() => navigateTo(item.path)}
            >
              <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                {fileIcon(item)}
                <p className="text-xs font-medium truncate w-full">{item.name}</p>
              </CardContent>
            </Card>
          ))}
          {regularFiles.map((item) => (
            <Card
              key={item.path}
              className={`group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden ${
                selectedFiles.includes(item.path) ? 'ring-2 ring-emerald-500 border-emerald-300' : ''
              }`}
              onClick={() => toggleFileSelection(item.path)}
            >
              <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                <div className="relative">
                  {fileIcon(item)}
                </div>
                <p className="text-xs font-medium truncate w-full">{item.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(item.size)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {directories.map((item) => (
                <div
                  key={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors ${
                    selectedFiles.includes(item.path) ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''
                  }`}
                  onClick={() => toggleFileSelection(item.path)}
                  onDoubleClick={() => navigateTo(item.path)}
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(item.path)}
                    onChange={() => toggleFileSelection(item.path)}
                    className="flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {fileIcon(item)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground flex-shrink-0">{formatTimeAgo(item.modifiedAt)}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
              {regularFiles.map((item) => (
                <div
                  key={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors ${
                    selectedFiles.includes(item.path) ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''
                  }`}
                  onClick={() => toggleFileSelection(item.path)}
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(item.path)}
                    onChange={() => toggleFileSelection(item.path)}
                    className="flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {fileIcon(item)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground flex-shrink-0">{formatBytes(item.size)}</p>
                  <p className="text-xs text-muted-foreground flex-shrink-0 w-20 text-right">{formatTimeAgo(item.modifiedAt)}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); handleDownload(item.path, item.name); }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600"
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.path, item.name); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
