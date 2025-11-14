import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const currencies = await prisma.exchangeRateCache.findMany({
      select: { currency: true },
      orderBy: { currency: 'asc' },
    });

    return NextResponse.json({
      currencies: currencies.map((c) => c.currency),
    });
  } catch (error) {
    console.error('Get currencies error:', error);
    return NextResponse.json(
      { error: 'Failed to get currencies' },
      { status: 500 }
    );
  }
}
