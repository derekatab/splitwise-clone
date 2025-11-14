import { prisma } from '@/lib/prisma';

export interface ConversionResult {
  amountCAD: number;
  exchangeRate: number;
  originalCurrency: string;
  originalAmount: number;
}

async function fetchAndCacheRates(fromCurrency: string): Promise<void> {
  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/CAD`
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.result === 'error') {
      throw new Error(`Exchange rate API error: ${data['error-type']}`);
    }

    // Update all rates in the database
    const rates = data.conversion_rates;
    for (const [currency, rate] of Object.entries(rates)) {
      await prisma.exchangeRateCache.upsert({
        where: { currency },
        update: { rate: rate as number },
        create: { currency, rate: rate as number },
      });
    }
  } catch (error) {
    console.error('Failed to fetch and cache rates:', error);
    throw error;
  }
}

export async function convertToCAD(
  amount: number,
  fromCurrency: string
): Promise<ConversionResult> {
  if (fromCurrency === 'CAD') {
    return {
      amountCAD: amount,
      exchangeRate: 1,
      originalCurrency: 'CAD',
      originalAmount: amount,
    };
  }

  try {
    let cachedRate = await prisma.exchangeRateCache.findUnique({
      where: { currency: fromCurrency },
    });

    if (!cachedRate) {
      await fetchAndCacheRates(fromCurrency);
      cachedRate = await prisma.exchangeRateCache.findUnique({
        where: { currency: fromCurrency },
      });
    }

    if (!cachedRate) {
      throw new Error(`Currency ${fromCurrency} not supported`);
    }

    // DIVIDE by the rate (e.g., 1000 VND / 18620.6662 = ~0.054 CAD)
    const amountCAD = amount / cachedRate.rate;

    return {
      amountCAD: parseFloat(amountCAD.toFixed(2)),
      exchangeRate: parseFloat(cachedRate.rate.toFixed(6)),
      originalCurrency: fromCurrency,
      originalAmount: amount,
    };
  } catch (error) {
    console.error('Currency conversion error:', error);
    throw new Error('Failed to convert currency');
  }
}


export async function refreshExchangeRates(): Promise<void> {
  await fetchAndCacheRates('CAD');
}