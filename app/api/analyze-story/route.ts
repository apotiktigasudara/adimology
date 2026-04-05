import { NextRequest, NextResponse } from 'next/server';
import { createAgentStory, getAgentStoriesByEmiten } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const emiten = searchParams.get('emiten')?.toUpperCase();

  if (!emiten) {
    return NextResponse.json({ error: 'Missing emiten parameter' }, { status: 400 });
  }

  try {
    const stories = await getAgentStoriesByEmiten(emiten);
    
    if (!stories || stories.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: null,
        message: 'No analysis found'
      });
    }

    return NextResponse.json({ 
      success: true, 
      data: stories 
    });
  } catch (error) {
    console.error('Error fetching agent story:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch analysis' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emiten = body.emiten?.toUpperCase();
    const keyStats = body.keyStats;

    if (!emiten) {
      return NextResponse.json({ error: 'Missing emiten parameter' }, { status: 400 });
    }

    // Create pending record
    const story = await createAgentStory(emiten);

    // Trigger background route (Vercel)
    const host = request.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    console.log(`[Agent Story] Triggering background route at: ${baseUrl}/api/analyze-story-background`);

    // Fire and forget - don't await
    fetch(`${baseUrl}/api/analyze-story-background?emiten=${emiten}&id=${story.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyStats })
    }).catch(err => console.error('Failed to trigger background route:', err));

    return NextResponse.json({ 
      success: true, 
      data: story,
      message: 'Analysis started'
    });
  } catch (error) {
    console.error('Error starting agent story:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to start analysis' 
    }, { status: 500 });
  }
}
