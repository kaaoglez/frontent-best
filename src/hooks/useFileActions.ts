'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Hook for file rename + delete operations.
 * Used across ALL media sections (Library, Music, Movies, TV Shows, Images, Disk Explorer).
 */
export function useFileActions(onSuccess?: () => void) {
  const [renameItem, setRenameItem] = useState<{ path: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleRename = useCallback((item: { path: string; name: string }) => {
    setRenameItem(item);
    setRenameValue(item.name);
  }, []);

  const handleDelete = useCallback(
    async (filePath: string, name: string) => {
      if (!confirm(`¿Eliminar "${name}"?`)) return;
      try {
        const res = await fetch('/api/files/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath }),
        });
        if (res.ok) {
          toast.success(`"${name}" eliminado`);
          onSuccess?.();
        } else {
          toast.error('Error al eliminar');
        }
      } catch {
        toast.error('Error de conexión');
      }
    },
    [onSuccess],
  );

  const confirmRename = useCallback(async () => {
    if (!renameItem || !renameValue.trim() || renameValue.trim() === renameItem.name) {
      setRenameItem(null);
      return;
    }
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: renameItem.path, newName: renameValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ newName: renameValue.trim() }));
        toast.success(`Renombrado a "${data.newName || renameValue.trim()}"`);
        onSuccess?.();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al renombrar');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setRenameItem(null);
  }, [renameItem, renameValue, onSuccess]);

  return {
    renameItem,
    setRenameItem,
    renameValue,
    setRenameValue,
    handleRename,
    handleDelete,
    confirmRename,
  };
}
