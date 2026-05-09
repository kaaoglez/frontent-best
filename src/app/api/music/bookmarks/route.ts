import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    let bookmarks: Array<Record<string, unknown>>;

    // Try full Prisma query first (works if schema matches DB)
    try {
      bookmarks = await db.musicBookmark.findMany({
        orderBy: { createdAt: 'desc' },
      }) as unknown as Array<Record<string, unknown>>;
    } catch {
      // Fallback: raw SQL with only columns that always existed
      console.warn('MusicBookmark.findMany failed, using raw SQL fallback');
      try {
        bookmarks = await db.$queryRawUnsafe(
          'SELECT id, title, artist, album, coverUrl, externalUrl, notes, isFavorite, createdAt, updatedAt FROM MusicBookmark ORDER BY createdAt DESC'
        ) as Array<Record<string, unknown>>;
      } catch (err2) {
        // Last resort: try with localPath/localSize columns (old schema)
        console.warn('Raw SQL fallback failed, trying with legacy columns');
        bookmarks = await db.$queryRawUnsafe(
          'SELECT id, title, artist, album, coverUrl, externalUrl, localPath, localSize, notes, isFavorite, createdAt, updatedAt FROM MusicBookmark ORDER BY createdAt DESC'
        ) as Array<Record<string, unknown>>;
      }
    }

    // Enrich with isLocal flag from ANY format
    const enriched = bookmarks.map((bm) => {
      // Format 1: localPath field exists and has value
      if (bm.localPath) {
        return { ...bm, isLocal: true };
      }
      // Format 2: externalUrl has "local:" prefix
      if (bm.externalUrl && String(bm.externalUrl).startsWith('local:')) {
        const path = String(bm.externalUrl).slice(6);
        return { ...bm, isLocal: true, localPath: path };
      }
      // Format 3: notes has "local:" JSON prefix
      if (bm.notes && String(bm.notes).startsWith('local:')) {
        try {
          const info = JSON.parse(String(bm.notes).slice(6));
          return { ...bm, isLocal: true, localPath: info.path as string, localSize: (info.size as number) || null };
        } catch {
          return { ...bm, isLocal: false };
        }
      }
      return { ...bm, isLocal: false };
    });

    return NextResponse.json({ bookmarks: enriched });
  } catch (error) {
    console.error('Fetch music bookmarks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch music bookmarks', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = body.title as string;
    const artist = body.artist as string | null;
    const album = body.album as string | null;
    const coverUrl = body.coverUrl as string | null;
    const externalUrl = body.externalUrl as string | null;
    const localPath = body.localPath as string | null;
    const localSize = body.localSize as number | null;
    const isFavorite = body.isFavorite as boolean | null;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    // Build data - only use fields that always existed in the schema
    const data: Record<string, unknown> = {
      title,
      artist: artist || null,
      album: album || null,
      coverUrl: coverUrl || null,
      isFavorite: isFavorite ?? true,
    };

    // For external links
    if (externalUrl) {
      data.externalUrl = externalUrl;
      data.notes = (body.notes as string | null) || null;
    }

    // For local tracks - store path info in notes field (always exists)
    if (localPath) {
      const localInfo = JSON.stringify({ path: localPath, size: localSize || null });
      data.notes = `local:${localInfo}`;
      data.externalUrl = null; // Don't set externalUrl for local tracks

      // Prevent duplicates
      const all = await db.musicBookmark.findMany({ select: { id: true, notes: true, externalUrl: true } });
      const dup = all.find((b) => {
        if (b.notes && b.notes.startsWith('local:') && b.notes.includes(localPath)) return true;
        if (b.externalUrl === `local:${localPath}`) return true;
        return false;
      });
      if (dup) {
        return NextResponse.json(
          { error: 'Esta canción ya está en tus favoritos' },
          { status: 409 }
        );
      }
    }

    let bookmark;
    try {
      bookmark = await db.musicBookmark.create({ data });
    } catch {
      // Fallback: try without any extra fields that might not exist in old schema
      const simpleData: Record<string, unknown> = {
        title,
        artist: artist || null,
        album: album || null,
        coverUrl: coverUrl || null,
        isFavorite: isFavorite ?? true,
      };
      if (localPath) {
        simpleData.notes = `local:${JSON.stringify({ path: localPath, size: localSize || null })}`;
      }
      bookmark = await db.musicBookmark.create({ data: simpleData });
    }

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    console.error('Create music bookmark error:', error);
    return NextResponse.json(
      { error: 'Failed to create music bookmark', details: String(error) },
      { status: 500 }
    );
  }
}
