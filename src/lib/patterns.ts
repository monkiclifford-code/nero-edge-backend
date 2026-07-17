import type {
  Candle,
  AMDEvent,
  CHoCHEvent,
  BOSEvent,
  MPattern,
  WPattern,
  DetectedSignal,
  DetectorConfig,
  MarketMode,
  PDHPDL,
  UserSettings,
} from './types';

// --- Market Profile Detection ---
export function detectMarketProfile(symbol: string): MarketMode {
  const s = symbol.toLowerCase();
  if (s.includes('xau') || s.includes('gold')) return 'GOLD';
  if (
    s.includes('v10') ||
    s.includes('v25') ||
    s.includes('v50') ||
    s.includes('v75') ||
    s.includes('v100') ||
    s.includes('10s') ||
    s.includes('30s') ||
    s.includes('100s')
  )
    return 'VOLATILITY';
  if (
    s.includes('us30') ||
    s.includes('dj30') ||
    s.includes('nas100') ||
    s.includes('spx500') ||
    s.includes('ger30') ||
    s.includes('dax') ||
    s.includes('jpn225') ||
    s.includes('uk100')
  )
    return 'INDICES';
  if (
    s.includes('oil') ||
    s.includes('wti') ||
    s.includes('brent') ||
    s.includes('xbr') ||
    s.includes('xti')
  )
    return 'OIL';
  if (
    s.includes('eur') ||
    s.includes('gbp') ||
    s.includes('jpy') ||
    s.includes('aud') ||
    s.includes('nzd') ||
    s.includes('chf') ||
    s.includes('cad')
  )
    return 'FOREX';
  return 'UNKNOWN';
}

function getAutoTolerance(mode: MarketMode, baseTolerance: number, useAuto: boolean): number {
  if (!useAuto) return baseTolerance;
  if (mode === 'FOREX') return 1.25;
  if (mode === 'GOLD') return 2.15;
  if (mode === 'INDICES') return 3.5;
  if (mode === 'OIL') return 2.8;
  if (mode === 'VOLATILITY') return 3.25;
  return baseTolerance;
}

function getAutoMinStrength(mode: MarketMode, baseStrength: number, useAuto: boolean): number {
  if (!useAuto) return baseStrength;
  if (mode === 'FOREX') return 65;
  if (mode === 'GOLD') return 55;
  if (mode === 'INDICES') return 50;
  if (mode === 'OIL') return 50;
  if (mode === 'VOLATILITY') return 45;
  return baseStrength;
}

// --- PDH / PDL Detection ---
export function detectPDHPDL(candles: Candle[]): PDHPDL {
  if (candles.length < 48) {
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    return {
      pdh: Math.max(...highs),
      pdl: Math.min(...lows),
      pdhTime: candles[highs.indexOf(Math.max(...highs))]?.time || 0,
      pdlTime: candles[lows.indexOf(Math.min(...lows))]?.time || 0,
    };
  }

  // Use last ~24 candles as "today", previous ~24 as "yesterday"
  const yesterday = candles.slice(-48, -24);

  const pdh = Math.max(...yesterday.map((c) => c.high));
  const pdl = Math.min(...yesterday.map((c) => c.low));
  const pdhCandle = yesterday.find((c) => c.high === pdh);
  const pdlCandle = yesterday.find((c) => c.low === pdl);

  return {
    pdh,
    pdl,
    pdhTime: pdhCandle?.time || 0,
    pdlTime: pdlCandle?.time || 0,
  };
}

// --- CHoCH / BOS Detection ---
function detectChoCH_BOS(candles: Candle[]): { choch: CHoCHEvent | null; bos: BOSEvent | null } {
  let lastSwingHigh = 0;
  let lastSwingLow = 0;
  let choch: CHoCHEvent | null = null;
  let bos: BOSEvent | null = null;

  for (let i = 2; i < candles.length - 2; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const prev2H = candles[i - 2].high;
    const prev1H = candles[i - 1].high;
    const next1H = candles[i + 1].high;
    const next2H = candles[i + 2].high;
    const prev2L = candles[i - 2].low;
    const prev1L = candles[i - 1].low;
    const next1L = candles[i + 1].low;
    const next2L = candles[i + 2].low;

    if (h > prev1H && h > prev2H && h > next1H && h > next2H) {
      if (h > lastSwingHigh) {
        bos = {
          type: 'BULL',
          time: candles[i].time,
          level: h,
          message: `BOS BULL | swing high=${h.toFixed(5)}`,
        };
      }
      if (h < lastSwingHigh && lastSwingHigh > 0) {
        choch = {
          type: 'BEAR',
          time: candles[i].time,
          level: h,
          message: `CHoCH BEAR | lower high=${h.toFixed(5)} prev=${lastSwingHigh.toFixed(5)}`,
        };
        bos = null;
      }
      lastSwingHigh = h;
    }

    if (l < prev1L && l < prev2L && l < next1L && l < next2L) {
      if (l < lastSwingLow || lastSwingLow === 0) {
        bos = {
          type: 'BEAR',
          time: candles[i].time,
          level: l,
          message: `BOS BEAR | swing low=${l.toFixed(5)}`,
        };
      }
      if (l > lastSwingLow && lastSwingLow > 0) {
        choch = {
          type: 'BULL',
          time: candles[i].time,
          level: l,
          message: `CHoCH BULL | higher low=${l.toFixed(5)} prev=${lastSwingLow.toFixed(5)}`,
        };
        bos = null;
      }
      lastSwingLow = l;
    }
  }

  return { choch, bos };
}

// --- AMD (Accumulation-Manipulation-Distribution) Detection ---
function detectAMD(candles: Candle[]): AMDEvent[] {
  const events: AMDEvent[] = [];
  if (candles.length < 15) return events;

  let phase: 'NONE' | 'ACCUMULATION' | 'MANIPULATION' | 'DISTRIBUTION' = 'NONE';
  let rangeHigh = 0;
  let rangeLow = 0;
  let lastChoCHTime = 0;

  for (let i = 12; i < candles.length; i++) {
    const curr = candles[i];
    const currRange = curr.high - curr.low;

    let avgRange = 0;
    for (let j = 1; j <= 12; j++) {
      const c = candles[i - j];
      avgRange += c.high - c.low;
    }
    avgRange /= 12;

    if (phase === 'NONE' || phase === 'DISTRIBUTION') {
      if (currRange < avgRange * 0.6 && avgRange > 0) {
        phase = 'ACCUMULATION';
        rangeHigh = curr.high;
        rangeLow = curr.low;
        for (let j = 0; j <= i; j++) {
          if (candles[j].high > rangeHigh) rangeHigh = candles[j].high;
          if (candles[j].low < rangeLow) rangeLow = candles[j].low;
        }
        events.push({
          phase: 'ACCUMULATION',
          time: curr.time,
          rangeHigh,
          rangeLow,
          message: `ACCUMULATION | Range contracted to ${(currRange / avgRange * 100).toFixed(0)}% of avg | High=${rangeHigh.toFixed(5)} Low=${rangeLow.toFixed(5)}`,
        });
      }
    }

    if (phase === 'ACCUMULATION') {
      if (curr.high > rangeHigh) rangeHigh = curr.high;
      if (curr.low < rangeLow) rangeLow = curr.low;

      const firstAccumCandle = events.filter((e) => e.phase === 'ACCUMULATION').pop();
      if (firstAccumCandle) {
        const breakThreshold = avgRange * 0.3;
        if (
          curr.high > firstAccumCandle.rangeHigh + breakThreshold ||
          curr.low < firstAccumCandle.rangeLow - breakThreshold
        ) {
          phase = 'MANIPULATION';
          events.push({
            phase: 'MANIPULATION',
            time: curr.time,
            rangeHigh,
            rangeLow,
            message: `MANIPULATION | Price broke accumulation range | High=${curr.high.toFixed(5)} Low=${curr.low.toFixed(5)}`,
          });
        }
      }
    }

    if (phase === 'MANIPULATION') {
      // Method 1: Look for CHoCH (lower high after manipulation high)
      const recent = candles.slice(Math.max(0, i - 12), i + 1);
      const { choch } = detectChoCH_BOS(recent);
      if (choch && choch.time > lastChoCHTime) {
        lastChoCHTime = choch.time;
        phase = 'DISTRIBUTION';
        events.push({
          phase: 'DISTRIBUTION',
          time: curr.time,
          rangeHigh,
          rangeLow,
          message: `DISTRIBUTION | CHoCH confirmed | ${choch.message}`,
        });
        continue;
      }

      // Method 2: If price retraces >50% of the manipulation move back into accumulation range
      const firstAccum = events.filter((e) => e.phase === 'ACCUMULATION').pop();
      const manipEvent = events.filter((e) => e.phase === 'MANIPULATION').pop();
      if (firstAccum && manipEvent && manipEvent.time < curr.time) {
        const accumMid = (firstAccum.rangeHigh + firstAccum.rangeLow) / 2;
        // For bullish manipulation (broke above), check if price fell back below accumulation mid
        if (curr.close < accumMid && curr.close < firstAccum.rangeHigh) {
          phase = 'DISTRIBUTION';
          events.push({
            phase: 'DISTRIBUTION',
            time: curr.time,
            rangeHigh,
            rangeLow,
            message: `DISTRIBUTION | Price retraced into accumulation range | Close=${curr.close.toFixed(5)} vs AccumMid=${accumMid.toFixed(5)}`,
          });
          continue;
        }
      }
    }
  }

  return events;
}

// --- M Pattern Detection ---
function detectMPattern(
  candles: Candle[],
  config: DetectorConfig,
  marketMode: MarketMode
): MPattern | null {
  const lb = Math.min(config.lookbackBars, candles.length);
  if (lb < 10) return null;

  const peaks: number[] = [];
  for (let i = 3; i < lb - 3; i++) {
    const h = candles[candles.length - 1 - i].high;
    const hm2 = candles[candles.length - 1 - (i - 2)].high;
    const hm1 = candles[candles.length - 1 - (i - 1)].high;
    const hp1 = candles[candles.length - 1 - (i + 1)].high;
    const hp2 = candles[candles.length - 1 - (i + 2)].high;
    if (h > hm1 && h > hm2 && h > hp1 && h > hp2) {
      peaks.push(i);
    }
  }

  if (peaks.length < 2) return null;

  const tolerance = getAutoTolerance(marketMode, config.patternTolerance, config.useEliteAutoMode);
  const pointMult = 0.00001;

  for (let p = 0; p < peaks.length - 1; p++) {
    const p1 = peaks[p];
    const p2 = peaks[p + 1];
    if (p2 - p1 < 3 || p2 - p1 > 20) continue;

    let midLow = Infinity;
    for (let i = p1; i <= p2; i++) {
      const l = candles[candles.length - 1 - i].low;
      if (l < midLow) midLow = l;
    }

    const h1 = candles[candles.length - 1 - p1].high;
    const h2 = candles[candles.length - 1 - p2].high;

    if (h2 <= h1 + tolerance * pointMult * 50) {
      return {
        time: candles[candles.length - 1].time,
        neckline: midLow,
        top: h1,
        bottom: midLow,
        leftPeakBar: candles.length - 1 - p1,
        rightPeakBar: candles.length - 1 - p2,
        strength: 0,
        message: `M Pattern | peaks at ${h1.toFixed(5)} & ${h2.toFixed(5)} | neckline=${midLow.toFixed(5)}`,
      };
    }
  }

  return null;
}

// --- W Pattern Detection ---
function detectWPattern(
  candles: Candle[],
  config: DetectorConfig,
  marketMode: MarketMode
): WPattern | null {
  const lb = Math.min(config.lookbackBars, candles.length);
  if (lb < 10) return null;

  const valleys: number[] = [];
  for (let i = 3; i < lb - 3; i++) {
    const l = candles[candles.length - 1 - i].low;
    const lm2 = candles[candles.length - 1 - (i - 2)].low;
    const lm1 = candles[candles.length - 1 - (i - 1)].low;
    const lp1 = candles[candles.length - 1 - (i + 1)].low;
    const lp2 = candles[candles.length - 1 - (i + 2)].low;
    if (l < lm1 && l < lm2 && l < lp1 && l < lp2) {
      valleys.push(i);
    }
  }

  if (valleys.length < 2) return null;

  const tolerance = getAutoTolerance(marketMode, config.patternTolerance, config.useEliteAutoMode);
  const pointMult = 0.00001;

  for (let v = 0; v < valleys.length - 1; v++) {
    const v1 = valleys[v];
    const v2 = valleys[v + 1];
    if (v2 - v1 < 3 || v2 - v1 > 20) continue;

    let midHigh = 0;
    for (let i = v1; i <= v2; i++) {
      const h = candles[candles.length - 1 - i].high;
      if (h > midHigh) midHigh = h;
    }

    const l1 = candles[candles.length - 1 - v1].low;
    const l2 = candles[candles.length - 1 - v2].low;

    if (l2 >= l1 - tolerance * pointMult * 50) {
      return {
        time: candles[candles.length - 1].time,
        neckline: midHigh,
        top: midHigh,
        bottom: l1,
        leftValleyBar: candles.length - 1 - v1,
        rightValleyBar: candles.length - 1 - v2,
        strength: 0,
        message: `W Pattern | valleys at ${l1.toFixed(5)} & ${l2.toFixed(5)} | neckline=${midHigh.toFixed(5)}`,
      };
    }
  }

  return null;
}

// --- Pattern Strength Calculation ---
function calculatePatternStrength(
  isM: boolean,
  neckline: number,
  top: number,
  bottom: number,
  lastClose: number,
  chochBull: boolean,
  chochBear: boolean,
  sweepDetected: boolean,
  sweepHigh: boolean,
  trendOK: boolean
): number {
  let score = 0;
  const range = Math.abs(top - bottom);
  if (range > 0) score += 25;
  if (isM && lastClose < neckline) score += 20;
  if (!isM && lastClose > neckline) score += 20;
  if (isM && chochBear) score += 20;
  if (!isM && chochBull) score += 20;
  if (trendOK) score += 20;
  if (sweepDetected && isM && sweepHigh) score += 15;
  if (sweepDetected && !isM && !sweepHigh) score += 15;
  return score;
}

// --- Engulfing Check ---
function checkEngulfing(candles: Candle[], bullish: boolean): boolean {
  if (candles.length < 3) return false;
  const c1 = candles[candles.length - 1];
  const c2 = candles[candles.length - 2];
  if (bullish) {
    return c1.close > c1.open && c2.close < c2.open && c1.open <= c2.close && c1.close >= c2.open;
  } else {
    return c1.close < c1.open && c2.close > c2.open && c1.open >= c2.close && c1.close <= c2.open;
  }
}

// --- Trend Filter ---
function checkTrendFilter(candles: Candle[], dir: 'BUY' | 'SELL'): boolean {
  if (candles.length < 55) return true;
  const fastEMA = calculateEMA(candles, 50);
  const slowEMA = calculateEMA(candles, 200);
  if (fastEMA === 0 || slowEMA === 0) return true;
  if (dir === 'BUY' && fastEMA > slowEMA) return true;
  if (dir === 'SELL' && fastEMA < slowEMA) return true;
  return false;
}

function calculateEMA(candles: Candle[], period: number): number {
  if (candles.length < period) return 0;
  const closes = candles.slice(-period).map((c) => c.close);
  const multiplier = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }
  return ema;
}

// --- Main Detector ---
export function detectPatternsV13(
  candles: Candle[],
  config: DetectorConfig,
  symbol: string = 'EURUSD'
): { signals: DetectedSignal[]; pdhpdl: PDHPDL } {
  const results: DetectedSignal[] = [];
  const marketMode = detectMarketProfile(symbol);
  const minStrength = getAutoMinStrength(marketMode, config.minStrength, config.useEliteAutoMode);
  const pdhpdl = detectPDHPDL(candles);

  if (candles.length < 10) return { signals: results, pdhpdl };

  // Detect CHoCH / BOS
  const { choch, bos } = detectChoCH_BOS(candles);
  if (choch) {
    results.push({ choch });
  }
  if (bos) {
    results.push({ bos });
  }

  // Detect AMD
  const amdEvents = detectAMD(candles);
  for (const amd of amdEvents) {
    results.push({ amd });
  }

  // Detect sweep (PDH/PDL)
  const recentHigh = Math.max(...candles.slice(-24).map((c) => c.high));
  const recentLow = Math.min(...candles.slice(-24).map((c) => c.low));
  const prevHigh = Math.max(...candles.slice(-48, -24).map((c) => c.high));
  const prevLow = Math.min(...candles.slice(-48, -24).map((c) => c.low));

  let sweepDetected = false;
  let sweepHigh = false;

  if (recentHigh > prevHigh) {
    sweepDetected = true;
    sweepHigh = true;
    results.push({
      sweep: {
        type: 'PDH',
        time: candles[candles.length - 1].time,
        price: recentHigh,
        message: `PDH swept! ${recentHigh.toFixed(5)} > ${prevHigh.toFixed(5)}`,
      },
    });
  } else if (recentLow < prevLow) {
    sweepDetected = true;
    sweepHigh = false;
    results.push({
      sweep: {
        type: 'PDL',
        time: candles[candles.length - 1].time,
        price: recentLow,
        message: `PDL swept! ${recentLow.toFixed(5)} < ${prevLow.toFixed(5)}`,
      },
    });
  }

  // Detect M Pattern
  const mPattern = detectMPattern(candles, config, marketMode);
  if (mPattern) {
    const chochBear = choch?.type === 'BEAR';
    const trendOK = checkTrendFilter(candles, 'SELL');
    const strength = calculatePatternStrength(
      true,
      mPattern.neckline,
      mPattern.top,
      mPattern.bottom,
      candles[candles.length - 1].close,
      false,
      chochBear,
      sweepDetected,
      sweepHigh,
      trendOK
    );
    mPattern.strength = strength;

    if (!config.useStrengthFilter || strength >= minStrength) {
      results.push({ mPattern });

      if (config.tradeBreak) {
        const curr = candles[candles.length - 1];
        const prev = candles[candles.length - 2];
        if (curr.close < mPattern.neckline && prev.close >= mPattern.neckline) {
          const chochOK = !config.requireCHoCH || chochBear;
          const engulfOK = !config.requireEngulf || checkEngulfing(candles, false);
          const trendFilterOK = !config.useTrendFilter || trendOK;

          if (chochOK && engulfOK && trendFilterOK) {
            const entryPrice = curr.close;
            const sl = entryPrice + config.slPts * 0.00001;
            const tp = entryPrice - config.tpPts * 0.00001;
            results.push({
              breakEntry: {
                type: 'SELL',
                time: curr.time,
                entryPrice,
                sl,
                tp,
                pattern: 'M',
                neckline: mPattern.neckline,
                chochOK,
                engulfOK,
                trendOK: trendFilterOK,
                message: `SELL Break Entry — M Pattern | Px=${entryPrice.toFixed(5)} | Neckline=${mPattern.neckline.toFixed(5)} | Strength=${strength}`,
              },
            });
          }
        }
      }

      if (config.tradeRetest) {
        const curr = candles[candles.length - 1];
        const zone = config.retestZone * 0.00001 * 50;
        const price = curr.close;
        if (price >= mPattern.neckline - zone && price <= mPattern.neckline + zone && curr.close < curr.open) {
          const engulfOK = !config.requireEngulf || checkEngulfing(candles, false);
          const trendFilterOK = !config.useTrendFilter || checkTrendFilter(candles, 'SELL');

          if (engulfOK && trendFilterOK) {
            const entryPrice = price;
            const sl = entryPrice + config.slPts * 0.00001;
            const tp = entryPrice - config.tpPts * 0.00001;
            results.push({
              retestEntry: {
                type: 'SELL',
                time: curr.time,
                entryPrice,
                sl,
                tp,
                pattern: 'M',
                neckline: mPattern.neckline,
                zone,
                engulfOK,
                trendOK: trendFilterOK,
                message: `SELL Retest Entry — M Pattern | Px=${entryPrice.toFixed(5)} | Zone=±${zone.toFixed(5)} | Strength=${strength}`,
              },
            });
          }
        }
      }
    }
  }

  // Detect W Pattern
  const wPattern = detectWPattern(candles, config, marketMode);
  if (wPattern) {
    const chochBull = choch?.type === 'BULL';
    const trendOK = checkTrendFilter(candles, 'BUY');
    const strength = calculatePatternStrength(
      false,
      wPattern.neckline,
      wPattern.top,
      wPattern.bottom,
      candles[candles.length - 1].close,
      chochBull,
      false,
      sweepDetected,
      sweepHigh,
      trendOK
    );
    wPattern.strength = strength;

    if (!config.useStrengthFilter || strength >= minStrength) {
      results.push({ wPattern });

      if (config.tradeBreak) {
        const curr = candles[candles.length - 1];
        const prev = candles[candles.length - 2];
        if (curr.close > wPattern.neckline && prev.close <= wPattern.neckline) {
          const chochOK = !config.requireCHoCH || chochBull;
          const engulfOK = !config.requireEngulf || checkEngulfing(candles, true);
          const trendFilterOK = !config.useTrendFilter || trendOK;

          if (chochOK && engulfOK && trendFilterOK) {
            const entryPrice = curr.close;
            const sl = entryPrice - config.slPts * 0.00001;
            const tp = entryPrice + config.tpPts * 0.00001;
            results.push({
              breakEntry: {
                type: 'BUY',
                time: curr.time,
                entryPrice,
                sl,
                tp,
                pattern: 'W',
                neckline: wPattern.neckline,
                chochOK,
                engulfOK,
                trendOK: trendFilterOK,
                message: `BUY Break Entry — W Pattern | Px=${entryPrice.toFixed(5)} | Neckline=${wPattern.neckline.toFixed(5)} | Strength=${strength}`,
              },
            });
          }
        }
      }

      if (config.tradeRetest) {
        const curr = candles[candles.length - 1];
        const zone = config.retestZone * 0.00001 * 50;
        const price = curr.close;
        if (price >= wPattern.neckline - zone && price <= wPattern.neckline + zone && curr.close > curr.open) {
          const engulfOK = !config.requireEngulf || checkEngulfing(candles, true);
          const trendFilterOK = !config.useTrendFilter || checkTrendFilter(candles, 'BUY');

          if (engulfOK && trendFilterOK) {
            const entryPrice = price;
            const sl = entryPrice - config.slPts * 0.00001;
            const tp = entryPrice + config.tpPts * 0.00001;
            results.push({
              retestEntry: {
                type: 'BUY',
                time: curr.time,
                entryPrice,
                sl,
                tp,
                pattern: 'W',
                neckline: wPattern.neckline,
                zone,
                engulfOK,
                trendOK: trendFilterOK,
                message: `BUY Retest Entry — W Pattern | Px=${entryPrice.toFixed(5)} | Zone=±${zone.toFixed(5)} | Strength=${strength}`,
              },
            });
          }
        }
      }
    }
  }

  return { signals: results, pdhpdl };
}

// --- Settings to Config converter ---
export function settingsToConfig(settings: UserSettings): DetectorConfig {
  return {
    slPts: settings.slPts,
    tpPts: settings.tpPts,
    lookbackBars: settings.lookbackBars,
    patternTolerance: settings.patternTolerance,
    requireCHoCH: settings.requireCHoCH,
    requireEngulf: settings.requireEngulf,
    tradeBreak: settings.tradeBreak,
    tradeRetest: settings.tradeRetest,
    retestZone: settings.retestZone,
    useStrengthFilter: settings.useStrengthFilter,
    minStrength: settings.minStrength,
    useTrendFilter: settings.useTrendFilter,
    useEliteAutoMode: settings.useEliteAutoMode,
  };
}
