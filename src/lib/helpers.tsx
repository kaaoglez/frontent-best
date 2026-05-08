import React from 'react';
import {
  Folder, Image as ImageIcon, Music, Film, Archive,
  FileType, FileText, Code, File,
  CheckCircle, PrinterIcon, Clock, AlertTriangle, X, CircleDot,
} from 'lucide-react';
import type { FileItem } from '@/lib/store';

// ─── Fetch ────────────────────────────────────────────────────

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// ─── Formatting ──────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay > 0) return `hace ${diffDay}d`;
  if (diffHr > 0) return `hace ${diffHr}h`;
  if (diffMin > 0) return `hace ${diffMin}m`;
  return 'ahora';
}

// ─── File Icons ──────────────────────────────────────────────

export function fileIcon(item: FileItem): React.ReactNode {
  if (item.isDirectory) {
    return <Folder className="h-5 w-5 text-amber-500 fill-amber-200 dark:fill-amber-900/30" />;
  }
  const ext = item.extension?.replace('.', '') || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    return <ImageIcon className="h-5 w-5 text-emerald-500" />;
  }
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) {
    return <Music className="h-5 w-5 text-violet-500" />;
  }
  if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) {
    return <Film className="h-5 w-5 text-rose-500" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive className="h-5 w-5 text-orange-500" />;
  }
  if (['pdf'].includes(ext)) {
    return <FileType className="h-5 w-5 text-red-500" />;
  }
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
    return <FileText className="h-5 w-5 text-blue-500" />;
  }
  if (['js', 'ts', 'py', 'html', 'css', 'json', 'xml'].includes(ext)) {
    return <Code className="h-5 w-5 text-cyan-500" />;
  }
  return <File className="h-5 w-5 text-muted-foreground" />;
}

// ─── Printer Status ──────────────────────────────────────────

export function printStatusIcon(status: string): React.ReactNode {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case 'printing':
      return <PrinterIcon className="h-4 w-4 text-amber-500 animate-pulse" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-sky-500" />;
    case 'failed':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'cancelled':
      return <X className="h-4 w-4 text-muted-foreground" />;
    default:
      return <CircleDot className="h-4 w-4 text-muted-foreground" />;
  }
}

export function printStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    printing: 'Imprimiendo',
    completed: 'Completado',
    failed: 'Fallido',
    cancelled: 'Cancelado',
  };
  return map[status] || status;
}

export function printStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'printing':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'pending':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
    case 'failed':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

// ─── Book Status ─────────────────────────────────────────────

export function bookStatusColor(status: string): string {
  switch (status) {
    case 'Leído':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'Leyendo':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400';
    case 'Favorito':
      return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

export function bookStatusLabel(status: string): string {
  const map: Record<string, string> = {
    'No leído': 'No leído',
    'Leyendo': 'Leyendo',
    'Leído': 'Leído',
    'Favorito': 'Favorito',
  };
  return map[status] || status;
}
