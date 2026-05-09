import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const bookmarks = await db.movieBookmark.findMany({
      where: { status: 'favorita_imagen' },
      orderBy: { createdAt: 'desc' },
    }) as unknown as Array<Record<string, unknown>>;

    // Enrich bookmarks with parsed local info from notes
    const enriched = bookmarks.map((bm) => {
      if (bm.notes && String(bm.notes).startsWith('local:')) {
        try {
          const info = JSON.parse(String(bm.notes).slice(6));
          return { ...bm, isLocal: true, localPath: info.path, localSize: info.size || null };
        } catch {
          return { ...bm, isLocal: false };
        }
      }
      return { ...bm, isLocal: false };
    });

    return NextResponse.json({ bookmarks: enriched });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch image bookmarks', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = body.title as string;
    const notes = body.notes as string | null;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    // Prevent duplicates
    const all = await db.movieBookmark.findMany({
      where: { status: 'favorita_imagen' },
      select: { id: true, notes: true },
    });
    if (notes && notes.startsWith('local:')) {
      const dup = all.find((b) => b.notes && b.notes.includes(notes.slice(6)));
      if (dup) {
        return NextResponse.json({ error: 'Esta imagen ya está en tus favoritos' }, { status: 409 });
      }
    }

    const bookmark = await db.movieBookmark.create({
      data: {
        title,
        notes,
        status: 'favorita_imagen',
      },
    });

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create image bookmark', details: String(error) }, { status: 500 });
  }
}
