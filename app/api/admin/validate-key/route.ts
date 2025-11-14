import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { adminKey } = await request.json();

    if (!adminKey) {
      return NextResponse.json(
        { valid: false, error: 'Admin key is required' },
        { status: 400 }
      );
    }

    const correctKey = process.env.ADMIN_SECRET_KEY;

    if (!correctKey) {
      console.error('ADMIN_SECRET_KEY not set in environment');
      return NextResponse.json(
        { valid: false, error: 'Admin key configuration error' },
        { status: 500 }
      );
    }

    // Compare keys securely
    const isValid = adminKey === correctKey;

    if (!isValid) {
      return NextResponse.json(
        { valid: false, error: 'Invalid admin secret key' },
        { status: 401 }
      );
    }

    return NextResponse.json({ valid: true, success: true });
  } catch (error) {
    console.error('Admin key validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}
