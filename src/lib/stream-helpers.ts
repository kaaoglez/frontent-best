import fs from 'fs';
import path from 'path';
import { getMimeType } from './constants';

export function createFileReadableStream(
  filePath: string,
  options?: { start?: number; end?: number }
): ReadableStream<Uint8Array> {
  const file = fs.createReadStream(filePath, options);
  let controllerClosed = false;

  return new ReadableStream({
    start(controller) {
      file.on('data', (chunk: Buffer) => {
        if (controllerClosed) return;
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          // controller already closed
        }
      });
      file.on('end', () => {
        if (!controllerClosed) {
          controllerClosed = true;
          try { controller.close(); } catch { /* ignore */ }
        }
      });
      file.on('error', (err: NodeJS.ErrnoException) => {
        if (!controllerClosed) {
          controllerClosed = true;
          try { controller.error(err); } catch { /* ignore */ }
        }
      });
    },
    cancel() {
      controllerClosed = true;
      file.destroy();
    },
  });
}

export function streamFileResponse(filePath: string, fileSize: number, mimeType?: string): Response {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeType || getMimeType(ext);

  return new Response(
    createFileReadableStream(filePath),
    {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      },
    }
  );
}

export function streamRangeResponse(
  filePath: string,
  fileSize: number,
  start: number,
  end: number,
  mimeType?: string
): Response {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeType || getMimeType(ext);
  const chunkSize = end - start + 1;

  return new Response(
    createFileReadableStream(filePath, { start, end }),
    {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    }
  );
}

export function parseRangeHeader(range: string | null, fileSize: number): { start: number; end: number } | null {
  if (!range) return null;
  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  if (isNaN(start) || start >= fileSize) return null;
  return { start, end: Math.min(end, fileSize - 1) };
}
