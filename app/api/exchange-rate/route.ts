import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const currency = request.nextUrl.searchParams.get('currency');

    if (!currency) {
      return NextResponse.json(
        { error: 'Currency parameter required' },
        { status: 400 }
      );
    }

    if (currency === 'CAD') {
      return NextResponse.json({ rate: 1 });
    }

    const cached = await prisma.exchangeRateCache.findUnique({
      where: { currency },
    });

    if (!cached) {
      return NextResponse.json(
        { error: 'Currency not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ rate: cached.rate });
  } catch (error) {
    console.error('Get exchange rate error:', error);
    return NextResponse.json(
      { error: 'Failed to get exchange rate' },
      { status: 500 }
    );
  }
}
