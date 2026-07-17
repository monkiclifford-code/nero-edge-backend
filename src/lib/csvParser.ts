import type { Candle } from './types';

export function parseCSV(text: string): Candle[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const candles: Candle[] = [];

  // Try to detect format
  const header = lines[0].toLowerCase();
  const hasStandardHeader = header.includes('time') || header.includes('date');

  const startIdx = hasStandardHeader ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/[,\t;]/).map((s) => s.trim());

    // Format 1: time,open,high,low,close[,vol]
    if (parts.length >= 5) {
      let time: number | null = null;
      let open = 0;
      let high = 0;
      let low = 0;
      let close = 0;

      const firstVal = parts[0];

      // Check if first column is a timestamp number
      if (/^\d{10,}$/.test(firstVal)) {
        time = parseInt(firstVal, 10);
        open = parseFloat(parts[1]);
        high = parseFloat(parts[2]);
        low = parseFloat(parts[3]);
        close = parseFloat(parts[4]);
      }
      // Check if first column is a date string like 2025.01.01 or 2025-01-01
      else if (/^\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(firstVal)) {
        const dateStr = firstVal.replace(/\./g, '-');
        const timeStr = parts[1] || '00:00';
        const dateTimeStr = `${dateStr}T${timeStr}`;
        time = new Date(dateTimeStr).getTime() / 1000;
        open = parseFloat(parts[2]);
        high = parseFloat(parts[3]);
        low = parseFloat(parts[4]);
        close = parseFloat(parts[5]);
      }
      // Check if first column is just open (no timestamp)
      else if (!isNaN(parseFloat(firstVal)) && parseFloat(firstVal) > 1000) {
        // Assume open,high,low,close format with no time
        time = startIdx + i;
        open = parseFloat(parts[0]);
        high = parseFloat(parts[1]);
        low = parseFloat(parts[2]);
        close = parseFloat(parts[3]);
      }

      if (time !== null && !isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close)) {
        candles.push({ time, open, high, low, close });
      }
    }
  }

  // Sort by time ascending
  candles.sort((a, b) => a.time - b.time);

  return candles;
}

export function generateSampleData(count: number = 200): Candle[] {
  const candles: Candle[] = [];
  let price = 1.0850;
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < count; i++) {
    const time = now - (count - i) * 3600; // hourly candles
    const volatility = 0.0010;
    const trend = Math.sin(i * 0.05) * 0.002;

    const open = price;
    const move = (Math.random() - 0.5) * volatility + trend;
    const close = open + move;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    candles.push({ time, open, high, low, close });
    price = close;
  }

  // Inject a sweep pattern at ~70%
  const sweepIdx = Math.floor(count * 0.7);
  if (sweepIdx > 2 && sweepIdx < count - 5) {
    // Create a buy sweep: break below prev low, close back above
    candles[sweepIdx].low = candles[sweepIdx - 1].low - 0.0015;
    candles[sweepIdx].close = candles[sweepIdx - 1].low + 0.0005;
    candles[sweepIdx].high = Math.max(candles[sweepIdx].open, candles[sweepIdx].close) + 0.0003;

    // Confirm next candle: open and close above sweep high
    candles[sweepIdx + 1].open = candles[sweepIdx].high + 0.0002;
    candles[sweepIdx + 1].close = candles[sweepIdx].high + 0.0010;
    candles[sweepIdx + 1].high = candles[sweepIdx + 1].close + 0.0003;
    candles[sweepIdx + 1].low = candles[sweepIdx + 1].open - 0.0003;
  }

  return candles;
}
