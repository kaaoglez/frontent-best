import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const bookmarks = await db.tvShowBookmark.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    const enriched = bookmarks.map((bm) => {
      if (bm.notes && String(bm.notes).startsWith('local:')) {
        try {
          const info = JSON.parse(String(bm.notes).slice(6));
          return { ...bm, isLocal: true, localPath: info.path, localSize: info.size || null };
        } catch { return { ...bm, isLocal: false }; }
      }
      return { ...bm, isLocal: false };
    });
    return NextResponse.json({ bookmarks: enriched });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch TV show bookmarks', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, posterPath, streamingUrl, notes, status, rating, seasons, currentSeason, currentEpisode, network, genre } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Duplicate check by local path (heart favorite from folder)
    if (notes && String(notes).startsWith('local:')) {
      try {
        const localInfo = JSON.parse(String(notes).slice(6));
        if (localInfo.path) {
          const allBookmarks = await db.tvShowBookmark.findMany({ where: { notes: { contains: 'local:' } } });
          const duplicate = allBookmarks.find((bm) => {
            try {
              const info = JSON.parse(String(bm.notes).slice(6));
              return info.path === localInfo.path;
            } catch { return false; }
          });
          if (duplicate) {
            return NextResponse.json(
              { error: 'Esta serie ya está en favoritos', bookmark: duplicate },
              { status: 409 }
            );
          }
        }
      } catch { /* ignore parse error */ }
    }

    const bookmark = await db.tvShowBookmark.create({
      data: {
        title: title.trim(),
        posterPath: posterPath || null,
        streamingUrl: streamingUrl || null,
        notes: notes || null,
        status: status || 'pendiente',
        rating: rating ?? null,
        seasons: seasons ?? null,
        currentSeason: currentSeason ?? null,
        currentEpisode: currentEpisode ?? null,
        network: network || null,
        genre: genre || null,
      },
    });

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create TV show bookmark', details: String(error) }, { status: 500 });
  }
}
