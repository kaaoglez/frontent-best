'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  HardDrive, FolderOpen, Folder, FolderPlus,
  ArrowLeft, ChevronUp, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/lib/helpers';

export function useFolderPicker(onSelect: (path: string) => void | Promise<void>) {
  const [pickerPath, setPickerPath] = useState('/home/z');
  const [directories, setDirectories] = useState<Array<{ name: string; path: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [pickerHistory, setPickerHistory] = useState<string[]>(['/home/z']);
  const [disks, setDisks] = useState<Array<{ name: string; mountPath: string; mounted: boolean; usagePercent: number; freeSpace: number }>>([]);
  const [disksLoading, setDisksLoading] = useState(false);
  const [view, setView] = useState<'disks' | 'browser'>('disks');
  const [pickerMode, setPickerMode] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const loadDirectories = useCallback(async (targetPath: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/files?path=${encodeURIComponent(targetPath)}`);
      if (res.ok) {
        const data = await res.json();
        setDirectories((data.items || []).filter((item: { isDirectory: boolean }) => item.isDirectory).map((item: { name: string; path: string }) => ({ name: item.name, path: item.path })));
      } else { setDirectories([]); }
    } catch { setDirectories([]); }
    finally { setLoading(false); }
  }, []);

  const loadDisks = useCallback(async () => {
    try {
      setDisksLoading(true);
      const res = await fetch('/api/disks/info');
      if (res.ok) { const data = await res.json(); setDisks(data.disks || []); }
    } catch { setDisks([]); }
    finally { setDisksLoading(false); }
  }, []);

  const openPicker = useCallback(() => {
    setPickerMode(true);
    setPickerPath('/home/z');
    setPickerHistory(['/home/z']);
    setView('disks');
    loadDisks();
  }, [loadDisks]);

  const closePicker = useCallback(() => {
    setPickerMode(false);
  }, []);

  const navigateTo = useCallback((path: string) => {
    const newHistory = [...pickerHistory, path];
    setPickerHistory(newHistory);
    setPickerPath(path);
    setView('browser');
    loadDirectories(path);
  }, [pickerHistory, loadDirectories]);

  const goBack = useCallback(() => {
    if (pickerHistory.length > 1) {
      const newHistory = pickerHistory.slice(0, -1);
      const parent = newHistory[newHistory.length - 1];
      setPickerHistory(newHistory);
      setPickerPath(parent);
      loadDirectories(parent);
    }
  }, [pickerHistory, loadDirectories]);

  const goUp = useCallback(() => {
    const parent = pickerPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== pickerPath) {
      setPickerHistory([...pickerHistory, parent]);
      setPickerPath(parent);
      loadDirectories(parent);
    }
  }, [pickerPath, pickerHistory, loadDirectories]);

  const goToDisks = useCallback(() => {
    setView('disks');
    setPickerHistory(['/home/z']);
    setPickerPath('/home/z');
  }, []);

  const handleSelect = useCallback(async () => {
    const pathToSelect = pickerPath;
    await onSelectRef.current(pathToSelect);
    setPickerMode(false);
  }, [pickerPath]);

  return {
    pickerMode, openPicker, closePicker,
    pickerContent: (
      <>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto pb-1 border-b mb-2">
          <Button variant={view === 'disks' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7 flex-shrink-0" onClick={goToDisks} title="Ver discos">
            <HardDrive className="h-4 w-4" />
          </Button>
          {view === 'browser' && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={goBack} disabled={pickerHistory.length <= 1}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={goUp} disabled={pickerPath === '/'}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <span className="text-xs font-mono text-muted-foreground truncate px-2">{pickerPath}</span>
            </>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto min-h-[200px] max-h-[400px] -mx-6 px-6">
          {view === 'disks' ? (
            disksLoading ? (
              <div className="space-y-2 py-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : disks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <HardDrive className="h-10 w-10 mb-2" /><p className="text-sm">No se encontraron discos</p>
              </div>
            ) : (
              <div className="space-y-1.5 py-1">
                {disks.map((disk) => (
                  <button key={disk.mountPath} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/80 transition-colors text-left group border border-transparent hover:border-border" onClick={() => disk.mounted ? navigateTo(disk.mountPath) : toast.error(`Disco "${disk.name}" no está montado`)} disabled={!disk.mounted}>
                    <div className={`p-2 rounded-lg flex-shrink-0 ${disk.mounted ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'}`}>
                      <HardDrive className={`h-5 w-5 ${disk.mounted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${!disk.mounted ? 'text-muted-foreground' : ''}`}>{disk.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{disk.mountPath}</p>
                    </div>
                    {disk.mounted ? (
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{formatBytes(disk.freeSpace)} libre</span>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${disk.usagePercent > 90 ? 'bg-red-500' : disk.usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${disk.usagePercent}%` }} />
                        </div>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-[10px] flex-shrink-0 text-muted-foreground">Desmontado</Badge>
                    )}
                    {disk.mounted && <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )
          ) : (
            loading ? (
              <div className="space-y-2 py-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : directories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mb-2" /><p className="text-sm">No hay carpetas aquí</p>
              </div>
            ) : (
              <div className="space-y-0.5 py-1">
                {directories.map((dir) => (
                  <button key={dir.path} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/80 transition-colors text-left group" onClick={() => navigateTo(dir.path)}>
                    <Folder className="h-5 w-5 text-amber-500 fill-amber-200 dark:fill-amber-900/30 flex-shrink-0" />
                    <span className="text-sm font-medium truncate flex-1">{dir.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end mt-2">
          <Button variant="outline" onClick={closePicker}>← Volver</Button>
          {view === 'browser' && (
            <Button onClick={handleSelect}><FolderPlus className="h-4 w-4 mr-1" />Seleccionar esta carpeta</Button>
          )}
        </div>
      </>
    ),
  };
}
