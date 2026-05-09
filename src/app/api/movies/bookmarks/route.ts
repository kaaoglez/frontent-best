import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status');

  try {
    const where: Record<string, unknown> = {
      status: { not: 'favorita_imagen' }, // Exclude image favorites (they have their own API)
    };
    if (status) {
      where.status = status;
    }

    const bookmarks = await db.movieBookmark.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
    return NextResponse.json(
      { error: 'Failed to fetch movie bookmarks', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tmdbId,
      title,
      originalTitle,
      overview,
      posterPath,
      backdropPath,
      releaseDate,
      voteAverage,
      genreIds,
      streamingUrl,
      notes,
      status,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'El título es obligatorio' },
        { status: 400 }
      );
    }

    // Duplicate check by tmdbId
    if (tmdbId) {
      const existing = await db.movieBookmark.findFirst({
        where: { tmdbId: tmdbId as number },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Esta película ya está guardada', bookmark: existing },
          { status: 409 }
        );
      }
    }

    // Duplicate check by local path (heart favorite from folder)
    if (notes && String(notes).startsWith('local:')) {
      try {
        const localInfo = JSON.parse(String(notes).slice(6));
        if (localInfo.path) {
          const allBookmarks = await db.movieBookmark.findMany({ where: { notes: { contains: 'local:' } } });
          const duplicate = allBookmarks.find((bm) => {
            try {
              const info = JSON.parse(String(bm.notes).slice(6));
              return info.path === localInfo.path;
            } catch { return false; }
          });
          if (duplicate) {
            return NextResponse.json(
              { error: 'Esta carpeta ya está en favoritos', bookmark: duplicate },
              { status: 409 }
            );
          }
        }
      } catch { /* ignore parse error */ }
    }

    const bookmark = await db.movieBookmark.create({
      data: {
        tmdbId: tmdbId ? (tmdbId as number) : null,
        title: title.trim(),
        originalTitle: originalTitle?.trim() || null,
        overview: overview || null,
        posterPath: posterPath || null,
        backdropPath: backdropPath || null,
        releaseDate: releaseDate || null,
        voteAverage: voteAverage ?? null,
        genreIds: typeof genreIds === 'string' ? genreIds : JSON.stringify(genreIds || []),
        streamingUrl: streamingUrl?.trim() || null,
        notes: notes?.trim() || null,
        status: status || 'pendiente',
      },
    });

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    console.error('Error creating movie bookmark:', error);
    return NextResponse.json(
      { error: 'Error al guardar la película', details: String(error) },
      { status: 500 }
    );
  }
}
