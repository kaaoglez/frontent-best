import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, artist, album, coverUrl, externalUrl, notes, isFavorite } = body;

    const bookmark = await db.musicBookmark.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(artist !== undefined && { artist: artist || null }),
        ...(album !== undefined && { album: album || null }),
        ...(coverUrl !== undefined && { coverUrl: coverUrl || null }),
        ...(externalUrl !== undefined && { externalUrl: externalUrl || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(isFavorite !== undefined && { isFavorite }),
      },
    });

    return NextResponse.json({ bookmark });
  } catch (error) {
    console.error('Update music bookmark error:', error);
    return NextResponse.json(
      { error: 'Failed to update music bookmark', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.musicBookmark.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete music bookmark error:', error);
    return NextResponse.json(
      { error: 'Failed to delete music bookmark', details: String(error) },
      { status: 500 }
    );
  }
}
