// ── File Extensions ─────────────────────────────────────────────────────────

export const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'm4b', 'wma', 'opus', 'webm', 'aiff',
]);

export const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ts',
  'vob', 'ogv', 'divx', 'xvid', 'rm', 'rmvb', 'asf', 'f4v', 'mts', 'm2ts', 'tp', 'trp',
  'h264', 'h265', 'hevc', '264', '265', 'mpe', 'mpv', 'm2v', 'm4p', 'f4p',
]);

export const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif',
  'raw', 'cr2', 'nef', 'orf', 'dng',
]);

export const DOCUMENT_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'json', 'xml',
  'html', 'htm', 'md', 'epub', 'mobi', 'djvu', 'rtf', 'odt',
]);

export const ALL_MEDIA_EXTENSIONS = new Set([
  ...AUDIO_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
]);

// ── MIME Types ────────────────────────────────────────────────────────────

export const MEDIA_MIME_TYPES: Record<string, string> = {
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.m4b': 'audio/mp4',
  '.wma': 'audio/x-ms-wma',
  '.opus': 'audio/opus',
  '.webm': 'audio/webm',
  '.aiff': 'audio/aiff',
  // Video
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.m4v': 'video/mp4',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.3gp': 'video/3gpp',
  '.ts': 'video/mp2t',
  '.vob': 'video/dvd',
  '.ogv': 'video/ogg',
  '.divx': 'video/x-msvideo',
  '.xvid': 'video/x-msvideo',
  '.rm': 'application/vnd.rn-realmedia',
  '.rmvb': 'application/vnd.rn-realmedia-vbr',
  '.asf': 'video/x-ms-asf',
  '.f4v': 'video/mp4',
  '.mts': 'video/mp2t',
  '.m2ts': 'video/mp2t',
  '.tp': 'video/mp2t',
  '.trp': 'video/mp2t',
  '.h264': 'video/mp4',
  '.h265': 'video/mp4',
  '.hevc': 'video/mp4',
  '.264': 'video/mp4',
  '.265': 'video/mp4',
  '.mpe': 'video/mpeg',
  '.mpv': 'video/mpeg',
  '.m2v': 'video/mpeg',
  '.m4p': 'video/mp4',
  '.f4p': 'video/mp4',
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

export const DOWNLOAD_MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.epub': 'application/epub+zip',
  '.mobi': 'application/x-mobipocket-ebook',
  '.djvu': 'image/vnd.djvu',
};

// ── Helpers ───────────────────────────────────────────────────────────────

export function getMimeType(ext: string): string {
  return MEDIA_MIME_TYPES[ext] || DOWNLOAD_MIME_TYPES[ext] || 'application/octet-stream';
}

export function getExtensionsForType(type: string): Set<string> {
  switch (type) {
    case 'video': return VIDEO_EXTENSIONS;
    case 'image': return IMAGE_EXTENSIONS;
    default: return AUDIO_EXTENSIONS;
  }
}
