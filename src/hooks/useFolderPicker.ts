'use client';

import { useState, useCallback, useRef } from 'react';

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
    pickerMode, view, disks, disksLoading, directories, loading,
    pickerPath, pickerHistory,
    openPicker, closePicker, navigateTo, goBack, goUp, goToDisks, handleSelect,
  };
}
