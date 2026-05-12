import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Save video progress (upsert)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoPath, position, duration } = body;

    if (!videoPath || position == null) {
      return NextResponse.json({ error: 'videoPath and position are required' }, { status: 400 });
    }

    // Upsert: update if exists, create if not
    const existing = await db.videoProgress.findUnique({ where: { videoPath } });

    if (existing) {
      await db.videoProgress.update({
        where: { videoPath },
        data: {
          position,
          duration: duration || existing.duration,
        },
      });
    } else {
      await db.videoProgress.create({
        data: { videoPath, position, duration: duration || 0 },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving video progress:', error);
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 });
  }
}

// Get video progress
export async function GET(request: NextRequest) {
  try {
    const videoPath = request.nextUrl.searchParams.get('path');

    if (!videoPath) {
      return NextResponse.json({ error: 'path parameter required' }, { status: 400 });
    }

    const progress = await db.videoProgress.findUnique({ where: { videoPath } });

    if (!progress) {
      return NextResponse.json({ progress: null });
    }

    return NextResponse.json({
      progress: {
        position: progress.position,
        duration: progress.duration,
        updatedAt: progress.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting video progress:', error);
    return NextResponse.json({ error: 'Failed to get progress' }, { status: 500 });
  }
}

// Delete video progress (marked as watched)
export async function DELETE(request: NextRequest) {
  try {
    const videoPath = request.nextUrl.searchParams.get('path');

    if (!videoPath) {
      return NextResponse.json({ error: 'path parameter required' }, { status: 400 });
    }

    await db.videoProgress.delete({ where: { videoPath } }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete progress' }, { status: 500 });
  }
}
