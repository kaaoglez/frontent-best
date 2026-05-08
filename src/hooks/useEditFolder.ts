'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Hook for editing a folder (rename + cover upload).
 * Used by Library, Movies, and TV Shows sections.
 */
export function useEditFolder(onSuccess?: () => void) {
  const [editFolder, setEditFolder] = useState<{ path: string; name: string } | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleEditFolder = useCallback(async (item: { path: string; name: string }) => {
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
  }, []);

  const close = useCallback(() => {
    setEditFolder(null);
    setEditCoverFile(null);
    if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
    setEditCoverPreview(null);
  }, [editCoverPreview]);

  const saveEditFolder = useCallback(async () => {
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
        const folderPath =
          editFolderName.trim() !== editFolder.name
            ? editFolder.path.replace(/[^/]+$/, editFolderName.trim())
            : editFolder.path;
        const formData = new FormData();
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
      close();
      onSuccess?.();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingEdit(false);
    }
  }, [editFolder, editFolderName, editCoverFile, editCoverPreview, onSuccess, close]);

  return {
    editFolder,
    setEditFolder,
    editFolderName,
    setEditFolderName,
    editCoverFile,
    setEditCoverFile,
    editCoverPreview,
    setEditCoverPreview,
    savingEdit,
    handleEditFolder,
    saveEditFolder,
    close,
  };
}
