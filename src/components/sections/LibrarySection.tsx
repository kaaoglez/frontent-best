'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore, type MediaItem } from '@/lib/store';
import { toast } from 'sonner';
import { fetchWithTimeout, formatBytes, bookStatusColor, bookStatusLabel } from '@/lib/helpers';
import { useFolderPicker } from '@/hooks/useFolderPicker';
import {
  X, RefreshCw, Upload, Download, FolderPlus,
  ChevronRight, ChevronLeft, ChevronUp, Search, Plus, Edit, BookOpen,
  Eye, FileText, FolderOpen, Folder, ArrowLeft, MoreVertical, ExternalLink, ArrowUpDown,
  File, Image as ImageIcon, BookMarked, Headphones, Bookmark, Star, HardDrive, AlertTriangle,
  Trash2, Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import FileActionsMenu from '@/components/shared/FileActionsMenu';

function bookFileIcon(ext: string): React.ReactNode {
  const lower = ext.toLowerCase();
  if (lower === 'pdf') return <BookOpen className="h-6 w-6 text-red-500" />;
  if (['epub', 'mobi', 'azw3'].includes(lower)) return <BookMarked className="h-6 w-6 text-amber-600 dark:text-amber-400" />;
  if (['cbz', 'cbr'].includes(lower)) return <ImageIcon className="h-6 w-6 text-violet-500" />;
  if (['djvu', 'fb2'].includes(lower)) return <FileText className="h-6 w-6 text-sky-500" />;
  if (['doc', 'docx'].includes(lower)) return <FileText className="h-6 w-6 text-blue-600" />;
  if (['rtf'].includes(lower)) return <FileText className="h-6 w-6 text-orange-500" />;
  return <File className="h-6 w-6 text-muted-foreground" />;
}

function bookFileIconSmall(ext: string): React.ReactNode {
  const lower = ext.toLowerCase();
  if (lower === 'pdf') return <BookOpen className="h-4 w-4 text-red-500" />;
  if (['epub', 'mobi', 'azw3'].includes(lower)) return <BookMarked className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
  if (['cbz', 'cbr'].includes(lower)) return <ImageIcon className="h-4 w-4 text-violet-500" />;
  if (['djvu', 'fb2'].includes(lower)) return <FileText className="h-4 w-4 text-sky-500" />;
  if (['doc', 'docx'].includes(lower)) return <FileText className="h-4 w-4 text-blue-600" />;
  if (['rtf'].includes(lower)) return <FileText className="h-4 w-4 text-orange-500" />;
  if (['mp3', 'm4a', 'm4b', 'wav', 'ogg', 'flac', 'aac', 'wma', 'opus'].includes(lower)) return <Headphones className="h-4 w-4 text-violet-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function bookExtColor(ext: string): string {
  const lower = ext.toLowerCase();
  if (lower === 'pdf') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (['epub', 'mobi', 'azw3'].includes(lower)) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  if (['cbz', 'cbr'].includes(lower)) return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
  if (['djvu', 'fb2'].includes(lower)) return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
  if (['doc', 'docx'].includes(lower)) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  if (['mp3', 'm4a', 'm4b', 'wav', 'ogg', 'flac', 'aac', 'wma', 'opus'].includes(lower)) return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400';
}

export default function LibrarySection() {
  const {
    libraryCurrentPath, setLibraryCurrentPath,
    libraryPathHistory, setLibraryPathHistory,
    libraryLibraryPaths, setLibraryLibraryPaths,
  } = useAppStore();
  const [folders, setFolders] = useState<Array<{ name: string; path: string; itemCount: number; subFolderCount: number }>>([]);
  const [books, setBooks] = useState<Array<{ name: string; path: string; size: number; modifiedAt: string; extension: string; isAudiobook?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [coverPaths, setCoverPaths] = useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [newPath, setNewPath] = useState('');
  const folderPicker = useFolderPicker(async (path) => {
    try {
      const current = useAppStore.getState().libraryLibraryPaths;
      if (current.includes(path)) { toast.info('Esta carpeta ya está en la lista'); return; }
      const newPaths = [...current, path];
      useAppStore.getState().setLibraryLibraryPaths(newPaths);
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'libraryLibraryPaths', value: JSON.stringify(newPaths) }) });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success('Carpeta agregada');
    } catch (e) { toast.error('No se pudo guardar la carpeta'); console.error(e); }
  });
  const [downloading, setDownloading] = useState<string | null>(null);
  const [readingBook, setReadingBook] = useState<{ name: string; path: string; extension: string } | null>(null);
  const [playingAudiobook, setPlayingAudiobook] = useState<{ name: string; path: string; extension: string } | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [activeTab, setActiveTab] = useState<'local' | 'bookmarks'>('local');
  const [bookmarks, setBookmarks] = useState<Array<Record<string, unknown>>>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [bookStatusFilter, setBookStatusFilter] = useState('all');
  const [showAddBookDialog, setShowAddBookDialog] = useState(false);
  const [editingBookBm, setEditingBookBm] = useState<Record<string, unknown> | null>(null);
  const [bookForm, setBookForm] = useState({ title: '', author: '', externalUrl: '', isbn: '', format: 'Físico', status: 'No leído', notes: '' });

  const loadBooks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/books/scan?path=${encodeURIComponent(libraryCurrentPath)}`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setBooks(data.files || []);
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
      toast.error('Error escaneando libros');
    } finally {
      setLoading(false);
    }
  }, [libraryCurrentPath]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  // Load saved library paths from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings?key=libraryLibraryPaths');
        if (res.ok) {
          const data = await res.json();
          if (data.value) {
            const saved = JSON.parse(data.value) as string[];
            if (saved.length > 0) {
              setLibraryLibraryPaths(saved);
              setLibraryCurrentPath(saved[0]);
              setLibraryPathHistory([saved[0]]);
            }
          }
        }
      } catch { /* use defaults */ }
    };
    loadSettings();
  }, [setLibraryLibraryPaths, setLibraryCurrentPath, setLibraryPathHistory]);

  // Save library paths to database
  const saveLibraryPaths = useCallback(async (paths: string[]) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'libraryLibraryPaths', value: JSON.stringify(paths) }),
      });
    } catch { /* ignore */ }
  }, []);

  // Wrapper that updates store AND saves to DB
  const updateLibraryPaths = useCallback((newPaths: string[]) => {
    setLibraryLibraryPaths(newPaths);
    saveLibraryPaths(newPaths);
  }, [setLibraryLibraryPaths, saveLibraryPaths]);

  const navigateTo = (path: string) => {
    setLibraryPathHistory([...libraryPathHistory, path]);
    setLibraryCurrentPath(path);
  };

  const goBack = () => {
    if (libraryPathHistory.length > 1) {
      const h = [...libraryPathHistory]; h.pop();
      setLibraryPathHistory(h);
      setLibraryCurrentPath(libraryPathHistory[libraryPathHistory.length - 2]);
    }
  };

  const goUp = () => {
    const parent = libraryCurrentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== libraryCurrentPath) navigateTo(parent);
  };

  const closeReader = () => {
    setReadingBook(null);
    setEpubChapters([]);
    setCurrentEpubChapter(0);
    setEpubTitle('');
    setEpubLoading(false);
    setEpubError(false);
  };
  const [epubChapters, setEpubChapters] = useState<Array<{ id: string; href: string; title: string }>>([]);
  const [currentEpubChapter, setCurrentEpubChapter] = useState(0);
  const [epubTitle, setEpubTitle] = useState('');
  const [epubLoading, setEpubLoading] = useState(false);
  const [epubError, setEpubError] = useState(false);

  const isViewable = (ext: string) => ['pdf', 'txt'].includes(ext.toLowerCase());
  const isEpub = (ext: string) => ['epub'].includes(ext.toLowerCase());
  const isAudiobook = (ext: string) => ['mp3', 'm4a', 'm4b', 'wav', 'ogg', 'flac', 'aac', 'wma', 'opus'].includes(ext.toLowerCase());

  const handleReadOrDownload = async (book: { name: string; path: string; extension: string; size: number }) => {
    if (isAudiobook(book.extension)) {
      setPlayingAudiobook(book);
    } else if (isEpub(book.extension) || isViewable(book.extension)) {
      setReadingBook(book);
    } else {
      await handleDownload(book.path, book.name);
    }
  };

  // Load EPUB chapters list from server-side parser
  useEffect(() => {
    if (!readingBook) return;
    const ext = readingBook.extension.toLowerCase();
    if (ext !== 'epub') return;

    let cancelled = false;

    const loadEpub = async () => {
      try {
        setEpubLoading(true);
        setEpubError(false);

        const res = await fetch(`/api/books/epub?path=${encodeURIComponent(readingBook.path)}`);
        if (!res.ok) {
          setEpubError(true);
          setEpubLoading(false);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        setEpubTitle(data.title || readingBook.name.replace(/\.epub$/i, ''));
        setEpubChapters(data.chapters || []);
        setCurrentEpubChapter(0);
        setEpubLoading(false);
      } catch (err) {
        console.error('Error loading EPUB:', err);
        if (!cancelled) { setEpubError(true); setEpubLoading(false); }
      }
    };

    loadEpub();
  }, [readingBook]);

  // Keyboard navigation for EPUB
  useEffect(() => {
    if (!readingBook || readingBook.extension.toLowerCase() !== 'epub') return;
    if (epubChapters.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentEpubChapter((prev) => Math.max(0, prev - 1));
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentEpubChapter((prev) => Math.min(epubChapters.length - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readingBook, epubChapters.length]);

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      setDownloading(filePath);
      const res = await fetch(`/api/books/scan?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Descargando "${fileName}"`);
      } else {
        toast.error('Error al descargar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDownloading(null);
    }
  };

  const [showCoverUpload, setShowCoverUpload] = useState(false);
  const [renameItem, setRenameItem] = useState<{ path: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [editFolder, setEditFolder] = useState<{ path: string; name: string } | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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
        loadBooks();
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleRename = (item: { path: string; name: string }) => {
    setRenameItem(item);
    setRenameValue(item.name);
  };

  const confirmRename = async () => {
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
        loadBooks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al renombrar');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setRenameItem(null);
  };

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
      loadBooks();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingEdit(false);
    }
  };

  // Edit individual book (rename + cover for its folder)
  const [editBook, setEditBook] = useState<{ path: string; name: string } | null>(null);
  const [editBookName, setEditBookName] = useState('');
  const [editBookCoverFile, setEditBookCoverFile] = useState<File | null>(null);
  const [editBookCoverPreview, setEditBookCoverPreview] = useState<string | null>(null);
  const [savingBookEdit, setSavingBookEdit] = useState(false);

  const handleEditBook = async (item: { path: string; name: string }) => {
    setEditBook(item);
    setEditBookName(item.name);
    setEditBookCoverFile(null);
    const parentDir = item.path.substring(0, item.path.lastIndexOf('/'));
    try {
      const res = await fetch(`/api/music/cover?path=${encodeURIComponent(parentDir)}`);
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
        const blob = await res.blob();
        setEditBookCoverPreview(URL.createObjectURL(blob));
      } else {
        setEditBookCoverPreview(null);
      }
    } catch {
      setEditBookCoverPreview(null);
    }
  };

  const saveEditBook = async () => {
    if (!editBook || !editBookName.trim()) return;
    setSavingBookEdit(true);
    try {
      if (editBookName.trim() !== editBook.name) {
        const res = await fetch('/api/files/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: editBook.path, newName: editBookName.trim() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || 'Error al renombrar');
          setSavingBookEdit(false);
          return;
        }
      }
      if (editBookCoverFile) {
        const parentDir = editBook.path.substring(0, editBook.path.lastIndexOf('/'));
        const formData = new FormData();
        formData.append('path', parentDir);
        formData.append('cover', editBookCoverFile);
        const coverRes = await fetch('/api/music/cover', { method: 'POST', body: formData });
        if (!coverRes.ok) {
          const data = await coverRes.json().catch(() => ({}));
          toast.error(data.error || 'Error al subir carátula');
          setSavingBookEdit(false);
          return;
        }
      }
      toast.success('Libro actualizado');
      setEditBook(null);
      setEditBookCoverFile(null);
      if (editBookCoverPreview) URL.revokeObjectURL(editBookCoverPreview);
      setEditBookCoverPreview(null);
      loadBooks();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingBookEdit(false);
    }
  };

  // ─── Book Bookmarks ──────────────────────────────────
  const loadBookmarks = useCallback(async () => {
    setBookmarksLoading(true);
    try {
      const res = await fetch(`/api/books/bookmarks?status=all`);
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch { toast.error('Error cargando marcadores de libros'); }
    finally { setBookmarksLoading(false); }
  }, []);

  useEffect(() => {
    loadBookmarks(); // Load bookmarks on mount so search can find them
  }, [loadBookmarks]);

  // Unified search: filter local files AND bookmarks by searchQuery
  const filteredFolders = searchQuery ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : folders;
  const filteredBooks = searchQuery ? books.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase())) : books;
  const filteredBookmarks = searchQuery
    ? bookmarks.filter((bm) =>
        String(bm.title).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(bm.author || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : (bookStatusFilter === 'all' ? bookmarks : bookmarks.filter((bm) => String(bm.status) === bookStatusFilter));
  const isSearching = searchQuery.trim().length > 0;

  const resetBookForm = () => setBookForm({ title: '', author: '', externalUrl: '', isbn: '', format: 'Físico', status: 'No leído', notes: '' });

  const openAddBookDialog = () => {
    setEditingBookBm(null);
    resetBookForm();
    setShowAddBookDialog(true);
  };

  const openEditBookDialog = (bm: Record<string, unknown>) => {
    setEditingBookBm(bm);
    setBookForm({
      title: String(bm.title || ''),
      author: String(bm.author || ''),
      externalUrl: String(bm.externalUrl || ''),
      isbn: String(bm.isbn || ''),
      format: String(bm.format || 'Físico'),
      status: String(bm.status || 'No leído'),
      notes: String(bm.notes || ''),
    });
    setShowAddBookDialog(true);
  };

  const saveBookBookmark = async () => {
    if (!bookForm.title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }
    const loading = toast.loading('Guardando libro...');
    try {
      const payload = {
        title: bookForm.title.trim(),
        author: bookForm.author.trim() || null,
        externalUrl: bookForm.externalUrl.trim() || null,
        isbn: bookForm.isbn.trim() || null,
        format: bookForm.format,
        status: bookForm.status,
        notes: bookForm.notes.trim() || null,
      };
      if (editingBookBm) {
        const res = await fetchWithTimeout(`/api/books/bookmarks/${editingBookBm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('Libro actualizado', { id: loading });
          setShowAddBookDialog(false);
          loadBookmarks();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || 'Error al actualizar', { id: loading });
        }
      } else {
        const res = await fetchWithTimeout('/api/books/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('Libro agregado', { id: loading });
          setShowAddBookDialog(false);
          loadBookmarks();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || 'Error al agregar el libro', { id: loading });
        }
      }
    } catch (err) {
      console.error('Book bookmark error:', err);
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Error de conexión', { id: loading });
    }
  };

  const deleteBookBookmark = async (id: unknown) => {
    if (!confirm('¿Eliminar este libro?')) return;
    try {
      const res = await fetch(`/api/books/bookmarks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Libro eliminado');
        loadBookmarks();
      } else { toast.error('Error al eliminar'); }
    } catch { toast.error('Error de conexión'); }
  };

  // (filteredBookmarks is defined above with unified search logic)

  const bookFormatColor = (format: string) => {
    switch (format) {
      case 'Digital': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'Audiolibro': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
      default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }
  };

  const sortedFolders = sortAsc
    ? [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name));
  const sortedBooks = sortAsc
    ? [...filteredBooks].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredBooks].sort((a, b) => b.name.localeCompare(a.name));
  const totalSize = books.reduce((s, b) => s + b.size, 0);
  const totalBookCount = folders.reduce((s, f) => s + f.itemCount, 0) + books.length;
  const bookTitle = readingBook?.name.replace(/\.[^.]+$/, '') || '';
  const audiobookTitle = playingAudiobook?.name.replace(/\.[^.]+$/, '') || '';

  return (
    <div className="space-y-4">
      {/* Book Reader Overlay */}
      {readingBook && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <BookOpen className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <h3 className="text-sm font-medium truncate">{bookTitle}</h3>
              <Badge variant="outline" className="text-[10px] flex-shrink-0">{readingBook.extension.toUpperCase()}</Badge>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {readingBook.extension.toLowerCase() === 'epub' && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentEpubChapter(Math.max(0, currentEpubChapter - 1))} disabled={currentEpubChapter === 0} title="Capítulo anterior">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                    {currentEpubChapter + 1} / {epubChapters.length}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentEpubChapter(Math.min(epubChapters.length - 1, currentEpubChapter + 1))} disabled={currentEpubChapter >= epubChapters.length - 1} title="Capítulo siguiente">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleDownload(readingBook.path, readingBook.name)}>
                <Download className="h-3.5 w-3.5" />Descargar
              </Button>
              <FileActionsMenu
                item={readingBook}
                onRename={(item) => handleRename(item)}
                onDelete={(item) => handleDelete(item.path, item.name)}
              >
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </FileActionsMenu>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeReader}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Content */}
          <div className="flex-1 relative">
            {readingBook.extension.toLowerCase() === 'epub' ? (
              <div className="w-full h-full flex">
                {/* Chapter sidebar */}
                {epubChapters.length > 0 && (
                  <div className="w-56 flex-shrink-0 border-r border-border bg-card overflow-y-auto hidden md:block">
                    <div className="p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">ÍNDICE</p>
                      <p className="text-sm font-medium truncate mb-3">{epubTitle || bookTitle}</p>
                      <div className="space-y-0.5">
                        {epubChapters.map((ch, i) => (
                          <button
                            key={ch.id}
                            className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors truncate ${
                              i === currentEpubChapter
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium'
                                : 'text-muted-foreground hover:bg-muted'
                            }`}
                            onClick={() => setCurrentEpubChapter(i)}
                          >
                            {ch.title || `Cap. ${i + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {/* Chapter content */}
                <div className="flex-1 relative">
                  {epubLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
                      <div className="text-center space-y-3">
                        <RefreshCw className="h-8 w-8 mx-auto text-amber-500 animate-spin" />
                        <p className="text-sm text-muted-foreground">Cargando EPUB...</p>
                      </div>
                    </div>
                  )}
                  {epubError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
                      <div className="text-center space-y-3">
                        <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
                        <p className="text-sm font-medium">Error al cargar el EPUB</p>
                        <Button variant="outline" size="sm" onClick={() => handleDownload(readingBook.path, readingBook.name)}>
                          <Download className="h-3.5 w-3.5 mr-1" />Descargar archivo
                        </Button>
                      </div>
                    </div>
                  )}
                  {!epubLoading && !epubError && epubChapters.length > 0 && (
                    <iframe
                      key={currentEpubChapter}
                      src={`/api/books/epub?path=${encodeURIComponent(readingBook.path)}&chapter=${currentEpubChapter}`}
                      className="w-full h-full border-0"
                      title={epubChapters[currentEpubChapter]?.title || `Capítulo ${currentEpubChapter + 1}`}
                    />
                  )}
                </div>
              </div>
            ) : (readingBook.extension.toLowerCase() === 'pdf' || readingBook.extension.toLowerCase() === 'txt') ? (
              <iframe
                src={`/api/books/scan?path=${encodeURIComponent(readingBook.path)}&inline=true`}
                className="w-full h-full border-0"
                title={readingBook.name}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted/30">
                <div className="text-center space-y-4 max-w-md p-8">
                  <div className="p-4 rounded-2xl bg-amber-100 dark:bg-amber-900/30 mx-auto w-fit">
                    <BookOpen className="h-12 w-12 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium">Vista previa no disponible</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Los archivos {readingBook.extension.toUpperCase()} no se pueden previsualizar en el navegador.
                      Descarga el archivo para abrirlo con tu lector de libros.
                    </p>
                  </div>
                  <Button onClick={() => handleDownload(readingBook.path, readingBook.name)}>
                    <Download className="h-4 w-4 mr-2" />Descargar {readingBook.name}
                  </Button>
                  <Button variant="ghost" onClick={closeReader}>Cerrar</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audiobook Player Overlay */}
      {playingAudiobook && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Headphones className="h-4 w-4 text-violet-600 flex-shrink-0" />
              <h3 className="text-sm font-medium truncate">{audiobookTitle}</h3>
              <Badge variant="outline" className="text-[10px] flex-shrink-0">Audiolibro</Badge>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleDownload(playingAudiobook.path, playingAudiobook.name)}>
                <Download className="h-3.5 w-3.5" />Descargar
              </Button>
              <FileActionsMenu
                item={playingAudiobook}
                onRename={(item) => handleRename(item)}
                onDelete={(item) => handleDelete(item.path, item.name)}
              >
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </FileActionsMenu>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPlayingAudiobook(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Player */}
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
            <div className="text-center space-y-6 max-w-lg w-full px-6">
              <div className="p-6 rounded-3xl bg-violet-100 dark:bg-violet-900/30 mx-auto w-fit">
                <Headphones className="h-20 w-20 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold truncate">{audiobookTitle}</h2>
                <p className="text-sm text-muted-foreground mt-1">{playingAudiobook.extension.toUpperCase()} · Audiobook</p>
              </div>
              <div className="w-full">
                <audio
                  controls
                  autoPlay
                  className="w-full h-14 rounded-lg"
                  src={`/api/books/scan?path=${encodeURIComponent(playingAudiobook.path)}`}
                >
                  Tu navegador no soporta el elemento de audio.
                </audio>
              </div>
              <Button variant="ghost" onClick={() => setPlayingAudiobook(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" />Volver a la biblioteca
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goBack} disabled={libraryPathHistory.length <= 1}><ArrowLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goUp}><ChevronUp className="h-4 w-4" /></Button>
          {libraryLibraryPaths.map((p) => (
            <Button key={p} variant={libraryCurrentPath === p ? 'secondary' : 'ghost'} size="sm" className="h-8 flex-shrink-0 text-xs max-w-[140px]" onClick={() => { setLibraryPathHistory([p]); setLibraryCurrentPath(p); }}>
              <HardDrive className="h-3.5 w-3.5 mr-1 shrink-0" /><span className="truncate">{p.split('/').pop()}</span>
            </Button>
          ))}
          {!libraryLibraryPaths.includes(libraryCurrentPath) && (
            <><ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span className="text-sm font-medium truncate">{libraryCurrentPath.split('/').pop()}</span></>
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
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadBooks}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={activeTab === 'local' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('local')}>
          <HardDrive className="h-3.5 w-3.5 mr-1" />Archivos Locales
        </Button>
        <Button variant={activeTab === 'bookmarks' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('bookmarks')}>
          <Bookmark className="h-3.5 w-3.5 mr-1" />Mis Libros
        </Button>
      </div>

      {isSearching ? (
        /* ── Unified Search Results ── */
        <div className="space-y-6">
          {(filteredFolders.length > 0 || filteredBooks.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Folder className="h-4 w-4" />Archivos Locales
                <Badge variant="secondary" className="text-xs">{filteredFolders.length + filteredBooks.length}</Badge>
              </h3>
              <div className="space-y-4">
                {filteredFolders.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {filteredFolders.sort((a, b) => a.name.localeCompare(b.name)).map((folder) => (
                      <Card key={folder.path} className="group cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-all hover:shadow-md hover:-translate-y-0.5" onClick={() => navigateTo(folder.path)}>
                        <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                          <div className="relative">
                            <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30"><Folder className="h-6 w-6 text-amber-600 dark:text-amber-400" /></div>
                            {folder.itemCount > 0 ? <Badge variant="secondary" className="absolute -top-1 -right-1 text-[9px] bg-amber-500/70 text-white h-4 w-4 flex items-center justify-center p-0">{folder.itemCount}</Badge> : null}
                          </div>
                          <p className="text-xs font-medium truncate w-full">{folder.name}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {filteredBooks.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredBooks.sort((a, b) => a.name.localeCompare(b.name)).map((book) => {
                      const ext = book.extension.replace('.', '').toUpperCase();
                      return (
                        <Card key={book.path} className="group hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all cursor-pointer" onClick={() => handleReadOrDownload(book)}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2.5 rounded-xl flex-shrink-0 ${book.isAudiobook ? 'bg-violet-100 dark:bg-violet-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                                {book.isAudiobook ? <Headphones className="h-5 w-5 text-violet-600 dark:text-violet-400" /> : <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-medium truncate">{book.name.replace(/\.[^.]+$/, '')}</h4>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="text-[10px]">{ext}</Badge>
                                  <span>{formatBytes(book.size)}</span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
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
                <BookMarked className="h-4 w-4" />Mis Libros
                <Badge variant="secondary" className="text-xs">{filteredBookmarks.length}</Badge>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBookmarks.map((bm: Record<string, unknown>) => (
                  <Card key={String(bm.id)} className="group hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex-shrink-0 mt-0.5"><BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold line-clamp-2 leading-tight">{String(bm.title)}</h4>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              {bm.externalUrl && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(String(bm.externalUrl), '_blank')}><ExternalLink className="h-3.5 w-3.5" /></Button>}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBookDialog(bm)}><Edit className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteBookBookmark(String(bm.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                          {bm.author && <p className="text-xs text-muted-foreground mt-0.5">{String(bm.author)}</p>}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {bm.format && <Badge variant="outline" className="text-[10px]">{String(bm.format)}</Badge>}
                            {bm.status && <Badge className={`text-[10px] ${bookStatusColor(String(bm.status))}`}>{String(bm.status)}</Badge>}
                          </div>
                          {bm.notes && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{String(bm.notes)}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {filteredFolders.length === 0 && filteredBooks.length === 0 && filteredBookmarks.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin resultados</p>
                <p className="text-sm text-muted-foreground">No se encontró &quot;{searchQuery}&quot; en archivos ni en Mis Libros</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (<>
      {activeTab === 'local' && (
      <>
      {/* Quick stats */}
      {!loading && (totalBookCount > 0 || folders.length > 0) && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
          <span className="font-medium text-amber-600 dark:text-amber-400">{totalBookCount} libros</span>
          <span>{folders.length} carpetas</span>
          {books.length > 0 && <span>{formatBytes(totalSize)}</span>}
          <span className="font-mono truncate">{libraryCurrentPath}</span>
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carpetas de Biblioteca</DialogTitle>
            <DialogDescription>{folderPicker.pickerMode ? 'Navega y selecciona una carpeta' : 'Configura las carpetas donde buscar libros'}</DialogDescription>
          </DialogHeader>
          {folderPicker.pickerMode ? (
            folderPicker.pickerContent
          ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {libraryLibraryPaths.map((p, i) => (
                <div key={p} className="flex items-center gap-2 min-w-0">
                  <HardDrive className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono truncate min-w-0" title={p}>{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateLibraryPaths(libraryLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="/mnt/MisLibros" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1 min-w-[120px]" />
              <Button variant="outline" onClick={folderPicker.openPicker} title="Explorar carpetas">
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { if (newPath.trim()) { const p = newPath.trim(); if (libraryLibraryPaths.includes(p)) { toast.info('Ya existe'); return; } try { const np = [...libraryLibraryPaths, p]; setLibraryLibraryPaths(np); await saveLibraryPaths(np); toast.success('Carpeta agregada'); setNewPath(''); } catch { toast.error('Error al guardar'); } } }} disabled={!newPath.trim()}>
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
                <Label htmlFor="cover-upload-book" className="cursor-pointer">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    Subir carátula
                  </div>
                </Label>
                <input
                  id="cover-upload-book"
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
              <Label htmlFor="edit-folder-name-book" className="text-sm">Nombre de la carpeta</Label>
              <Input
                id="edit-folder-name-book"
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

      {/* Edit Book Dialog (rename + cover) */}
      <Dialog open={!!editBook} onOpenChange={(open) => { if (!open) { setEditBook(null); setEditBookCoverFile(null); if (editBookCoverPreview) URL.revokeObjectURL(editBookCoverPreview); setEditBookCoverPreview(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Libro</DialogTitle>
            <DialogDescription>Cambia el nombre o agrega una carátula</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-32 h-44 rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/50">
                {(editBookCoverPreview || editBookCoverFile) ? (
                  <img
                    src={editBookCoverFile ? URL.createObjectURL(editBookCoverFile) : editBookCoverPreview!}
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
                <Label htmlFor="cover-upload-bookfile" className="cursor-pointer">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    Subir carátula
                  </div>
                </Label>
                <input
                  id="cover-upload-bookfile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setEditBookCoverFile(file);
                    e.target.value = '';
                  }}
                />
                {editBookCoverFile && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditBookCoverFile(null)}>
                    <X className="h-3 w-3 mr-1" />Quitar
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-book-name" className="text-sm">Nombre del libro</Label>
              <Input
                id="edit-book-name"
                value={editBookName}
                onChange={(e) => setEditBookName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEditBook(); if (e.key === 'Escape') { setEditBook(null); setEditBookCoverFile(null); if (editBookCoverPreview) URL.revokeObjectURL(editBookCoverPreview); setEditBookCoverPreview(null); } }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditBook(null); setEditBookCoverFile(null); if (editBookCoverPreview) URL.revokeObjectURL(editBookCoverPreview); setEditBookCoverPreview(null); }}>Cancelar</Button>
            <Button onClick={saveEditBook} disabled={savingBookEdit || !editBookName.trim() || (editBookName.trim() === editBook?.name && !editBookCoverFile)}>
              {savingBookEdit ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" />Guardando...</> : 'Guardar'}
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

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] rounded-xl" />)}
        </div>
      ) : folders.length === 0 && books.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="font-medium mb-1">No hay libros aquí</p>
            <p className="text-sm text-muted-foreground mb-4">Navega a una carpeta con archivos de libros (PDF, EPUB, MOBI...)</p>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <FolderPlus className="h-4 w-4 mr-1" />Configurar carpetas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Folder Grid */}
          {filteredFolders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Carpetas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sortedFolders.map((folder) => {
                  const hasCover = coverPaths[folder.path];
                  return (
                    <Card key={folder.path} className="group cursor-pointer overflow-hidden hover:border-amber-300 dark:hover:border-amber-700 transition-all hover:shadow-lg hover:-translate-y-1" onClick={() => navigateTo(folder.path)}>
                      <div className="aspect-[2/3] relative bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40 overflow-hidden">
                        {hasCover ? (
                          <img
                            src={`/api/music/cover?path=${encodeURIComponent(folder.path)}`}
                            alt={folder.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <FolderOpen className="h-12 w-12 text-amber-300 dark:text-amber-700" />
                            <BookOpen className="h-6 w-6 text-amber-400 dark:text-amber-600" />
                          </div>
                        )}
                        {/* Badge */}
                        <div className="absolute top-2 right-2">
                          {folder.itemCount > 0 ? (
                            <Badge variant="secondary" className="text-[10px] bg-amber-500/70 text-white backdrop-blur-sm flex items-center gap-1"><BookOpen className="h-2.5 w-2.5" />{folder.itemCount}</Badge>
                          ) : folder.subFolderCount ? (
                            <Badge variant="secondary" className="text-[10px] bg-sky-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Folder className="h-2.5 w-2.5" />{folder.subFolderCount}</Badge>
                          ) : null}
                        </div>
                        {/* Actions menu */}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <FileActionsMenu item={folder} onRename={handleRename} onDelete={(f) => handleDelete(f.path, f.name)} onEdit={handleEditFolder} />
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">{folder.itemCount > 0 ? `${folder.itemCount} libro${folder.itemCount !== 1 ? 's' : ''}` : folder.subFolderCount ? `${folder.subFolderCount} subcarpeta${folder.subFolderCount !== 1 ? 's' : ''}` : 'Vacío'}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Book Files Grid */}
          {filteredBooks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Libros ({sortedBooks.length})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sortedBooks.map((book) => {
                  const bTitle = book.name.replace(/\.[^.]+$/, '');
                  const parentDir = book.path.substring(0, book.path.lastIndexOf('/'));
                  const canView = isViewable(book.extension) || isEpub(book.extension);
                  const isAudio = isAudiobook(book.extension);
                  return (
                    <Card key={book.path} className="group cursor-pointer overflow-hidden hover:border-amber-300 dark:hover:border-amber-700 transition-all hover:shadow-lg hover:-translate-y-1" onClick={() => handleReadOrDownload(book)}>
                      <div className={`aspect-[3/4] relative flex items-center justify-center p-4 ${isAudio ? 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30' : 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30'}`}>
                        {!isAudio && (
                          <img
                            src={`/api/music/cover?path=${encodeURIComponent(parentDir)}`}
                            alt={bTitle}
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        {isAudio && (
                          <Headphones className="h-16 w-16 text-violet-300 dark:text-violet-700" />
                        )}
                        {/* Extension badge */}
                        <Badge className={`absolute top-2 right-2 text-[10px] ${bookExtColor(book.extension)}`}>
                          {book.extension.toUpperCase()}
                        </Badge>
                        {/* Action overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-2">
                          <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                            <Button
                              size="icon"
                              className={`h-10 w-10 rounded-full ${isAudio ? 'bg-violet-500 hover:bg-violet-600' : canView ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'} text-white shadow-lg`}
                              onClick={(e) => { e.stopPropagation(); handleReadOrDownload(book); }}
                              title={isAudio ? 'Escuchar' : canView ? 'Leer' : 'Descargar'}
                            >
                              {isAudio ? <Play className="h-5 w-5" /> : canView ? <Eye className="h-5 w-5" /> : (
                                downloading === book.path ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />
                              )}
                            </Button>
                          </div>
                        </div>
                        {/* Actions menu */}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <FileActionsMenu item={book} onRename={handleRename} onDelete={(b) => handleDelete(b.path, b.name)} onEdit={handleEditBook} />
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5">{bookFileIconSmall(book.extension)}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium line-clamp-2 leading-tight">{bTitle}</p>
                            <p className="text-xs text-muted-foreground">{formatBytes(book.size)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {activeTab === 'bookmarks' && (
      <div className="space-y-4">
        {/* Actions bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" className="h-8" onClick={openAddBookDialog}>
            <Plus className="h-3.5 w-3.5 mr-1" />Agregar Libro
          </Button>
          <div className="flex gap-1 ml-auto flex-wrap">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'No leído', label: 'No leído' },
              { key: 'Leyendo', label: 'Leyendo' },
              { key: 'Leído', label: 'Leído' },
              { key: 'Favorito', label: 'Favorito' },
            ].map((f) => (
              <Button
                key={f.key}
                variant={bookStatusFilter === f.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setBookStatusFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadBookmarks} disabled={bookmarksLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${bookmarksLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Bookmarks List */}
        {bookmarksLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookMarked className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="font-medium mb-1">No hay libros guardados</p>
              <p className="text-sm text-muted-foreground mb-4">Agrega libros a tu colección con el botón "Agregar Libro"</p>
              <Button variant="outline" size="sm" onClick={openAddBookDialog}>
                <Plus className="h-4 w-4 mr-1" />Agregar Libro
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBookmarks.map((bm: Record<string, unknown>) => (
              <Card key={String(bm.id)} className="group hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex-shrink-0 mt-0.5">
                      <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold line-clamp-2 leading-tight">{String(bm.title)}</h4>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          {bm.externalUrl && (
                            <a href={String(bm.externalUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBookDialog(bm)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteBookBookmark(bm.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {bm.author && (
                        <p className="text-xs text-muted-foreground mt-0.5">{String(bm.author)}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {bm.format && (
                          <Badge variant="outline" className={`text-[10px] border ${bookFormatColor(String(bm.format))}`}>
                            {String(bm.format)}
                          </Badge>
                        )}
                        {bm.status && (
                          <Badge variant="outline" className={`text-[10px] border ${bookStatusColor(String(bm.status))}`}>
                            {bookStatusLabel(String(bm.status))}
                          </Badge>
                        )}
                        {bm.rating != null && Number(bm.rating) > 0 && (
                          <span className="text-xs text-amber-500 flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            {Number(bm.rating).toFixed(1)}
                          </span>
                        )}
                      </div>
                      {bm.isbn && (
                        <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">ISBN: {String(bm.isbn)}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      )}
      </>)}

      {/* Add/Edit Book Dialog */}
      <Dialog open={showAddBookDialog} onOpenChange={setShowAddBookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBookBm ? 'Editar Libro' : 'Agregar Libro'}</DialogTitle>
            <DialogDescription>{editingBookBm ? 'Modifica los datos del libro' : 'Agrega un nuevo libro a tu colección'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Título del libro"
                value={bookForm.title}
                onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Autor</Label>
              <Input
                placeholder="Nombre del autor"
                value={bookForm.author}
                onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Enlace externo (URL)</Label>
              <Input
                placeholder="https://..."
                value={bookForm.externalUrl}
                onChange={(e) => setBookForm({ ...bookForm, externalUrl: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ISBN</Label>
                <Input
                  placeholder="978-..."
                  value={bookForm.isbn}
                  onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Formato</Label>
                <Select value={bookForm.format} onValueChange={(v) => setBookForm({ ...bookForm, format: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Físico">Físico</SelectItem>
                    <SelectItem value="Digital">Digital</SelectItem>
                    <SelectItem value="Audiolibro">Audiolibro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={bookForm.status} onValueChange={(v) => setBookForm({ ...bookForm, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="No leído">No leído</SelectItem>
                  <SelectItem value="Leyendo">Leyendo</SelectItem>
                  <SelectItem value="Leído">Leído</SelectItem>
                  <SelectItem value="Favorito">Favorito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas personales..."
                value={bookForm.notes}
                onChange={(e) => setBookForm({ ...bookForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBookDialog(false)}>Cancelar</Button>
            <Button onClick={saveBookBookmark} disabled={!bookForm.title.trim()}>{editingBookBm ? 'Guardar' : 'Agregar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
