import { NextRequest, NextResponse } from 'next/server';
import { upsertSession } from '@/lib/supabase';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age':       '86400',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, expires_at } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    let expiresAtDate: Date | undefined;
    if (expires_at) {
      if (typeof expires_at === 'number') {
        expiresAtDate = new Date(expires_at * 1000);
      } else {
        expiresAtDate = new Date(expires_at);
      }
    }

    await upsertSession('stockbit_token', token, expiresAtDate);

    return NextResponse.json({
      success: true,
      message: 'Token updated successfully',
      expires_at: expiresAtDate,
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error: unknown) {
    console.error('Update Token Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update token' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
