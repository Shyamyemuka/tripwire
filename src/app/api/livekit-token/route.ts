import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const roomName = body.roomName || 'tripwire-demo-room';
    const participantName = body.participantName || `user-${Math.random().toString(36).slice(2, 7)}`;

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      // Return gracefully with mock/browser fallback mode if env variables are not yet configured
      return NextResponse.json({
        token: 'local-demo-token',
        wsUrl: wsUrl || 'wss://demo.livekit.cloud',
        isMock: true,
        participantName,
        roomName,
      });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
      ttl: '1h',
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      token,
      wsUrl,
      isMock: false,
      participantName,
      roomName,
    });
  } catch (err) {
    console.error('LiveKit token generation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate LiveKit token' },
      { status: 500 }
    );
  }
}
