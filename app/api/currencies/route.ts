import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { refreshExchangeRates } from '@/lib/utils/currencyConversion';

export async function GET(request: NextRequest) {
  try {
    // Check if cache is empty
    const count = await prisma.exchangeRateCache.count();

    // If empty, populate it
    if (count === 0) {
      try {
        await refreshExchangeRates();
      } catch (error) {
        console.error('Failed to populate exchange rate cache:', error);
        // Continue anyway, return what we have
      }
    }

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
