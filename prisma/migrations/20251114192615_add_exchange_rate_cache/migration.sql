-- CreateTable
CREATE TABLE "ExchangeRateCache" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRateCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRateCache_currency_key" ON "ExchangeRateCache"("currency");

-- CreateIndex
CREATE INDEX "ExchangeRateCache_updatedAt_idx" ON "ExchangeRateCache"("updatedAt");
