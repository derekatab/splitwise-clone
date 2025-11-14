export interface ConversionResult {
  amountCAD: number;
  exchangeRate: number;
  originalCurrency: string;
  originalAmount: number;
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
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${fromCurrency}`
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.result === 'error') {
      throw new Error(`Exchange rate API error: ${data['error-type']}`);
    }

    const cadRate = data.conversion_rates.CAD;
    const amountCAD = amount * cadRate;

    return {
      amountCAD: parseFloat(amountCAD.toFixed(2)),
      exchangeRate: parseFloat(cadRate.toFixed(6)),
      originalCurrency: fromCurrency,
      originalAmount: amount,
    };
  } catch (error) {
    console.error('Currency conversion error:', error);
    throw new Error('Failed to convert currency');
  }
}
