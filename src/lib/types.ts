export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PDHPDL {
  pdh: number;
  pdl: number;
  pdhTime: number;
  pdlTime: number;
}

export interface SweepEvent {
  type: 'PDH' | 'PDL';
  time: number;
  price: number;
  message: string;
}

export interface CHoCHEvent {
  type: 'BULL' | 'BEAR';
  time: number;
  level: number;
  message: string;
}

export interface BOSEvent {
  type: 'BULL' | 'BEAR';
  time: number;
  level: number;
  message: string;
}

export interface AMDEvent {
  phase: 'ACCUMULATION' | 'MANIPULATION' | 'DISTRIBUTION';
  time: number;
  rangeHigh: number;
  rangeLow: number;
  message: string;
}

export interface MPattern {
  time: number;
  neckline: number;
  top: number;
  bottom: number;
  leftPeakBar: number;
  rightPeakBar: number;
  strength: number;
  message: string;
}

export interface WPattern {
  time: number;
  neckline: number;
  top: number;
  bottom: number;
  leftValleyBar: number;
  rightValleyBar: number;
  strength: number;
  message: string;
}

export interface BreakEntry {
  type: 'BUY' | 'SELL';
  time: number;
  entryPrice: number;
  sl: number;
  tp: number;
  pattern: 'M' | 'W';
  neckline: number;
  chochOK: boolean;
  engulfOK: boolean;
  trendOK: boolean;
  message: string;
}

export interface RetestEntry {
  type: 'BUY' | 'SELL';
  time: number;
  entryPrice: number;
  sl: number;
  tp: number;
  pattern: 'M' | 'W';
  neckline: number;
  zone: number;
  engulfOK: boolean;
  trendOK: boolean;
  message: string;
}

export interface DetectedSignal {
  sweep?: SweepEvent;
  choch?: CHoCHEvent;
  bos?: BOSEvent;
  amd?: AMDEvent;
  mPattern?: MPattern;
  wPattern?: WPattern;
  breakEntry?: BreakEntry;
  retestEntry?: RetestEntry;
}

export interface DetectorConfig {
  slPts: number;
  tpPts: number;
  lookbackBars: number;
  patternTolerance: number;
  requireCHoCH: boolean;
  requireEngulf: boolean;
  tradeBreak: boolean;
  tradeRetest: boolean;
  retestZone: number;
  useStrengthFilter: boolean;
  minStrength: number;
  useTrendFilter: boolean;
  useEliteAutoMode: boolean;
}

export interface UserSettings {
  slPts: number;
  tpPts: number;
  lookbackBars: number;
  patternTolerance: number;
  requireCHoCH: boolean;
  requireEngulf: boolean;
  tradeBreak: boolean;
  tradeRetest: boolean;
  retestZone: number;
  useStrengthFilter: boolean;
  minStrength: number;
  useTrendFilter: boolean;
  useEliteAutoMode: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  slPts: 500,
  tpPts: 1500,
  lookbackBars: 50,
  patternTolerance: 2.0,
  requireCHoCH: false,
  requireEngulf: false,
  tradeBreak: true,
  tradeRetest: true,
  retestZone: 2.0,
  useStrengthFilter: true,
  minStrength: 60,
  useTrendFilter: true,
  useEliteAutoMode: true,
};

export interface SubscriptionState {
  signalCount: number;
  isSubscribed: boolean;
  trialUsed: boolean;
  maxFreeSignals: number;
}

export const DEFAULT_SUBSCRIPTION: SubscriptionState = {
  signalCount: 0,
  isSubscribed: false,
  trialUsed: false,
  maxFreeSignals: 3,
};

export type MarketMode = 'FOREX' | 'GOLD' | 'INDICES' | 'OIL' | 'VOLATILITY' | 'UNKNOWN';

export interface SymbolInfo {
  name: string;
  label: string;
  category: 'FOREX' | 'GOLD' | 'INDICES' | 'OIL' | 'VOLATILITY';
}

export const AVAILABLE_SYMBOLS: SymbolInfo[] = [
  // Forex
  { name: 'EURUSD', label: 'EUR/USD', category: 'FOREX' },
  { name: 'GBPUSD', label: 'GBP/USD', category: 'FOREX' },
  { name: 'USDJPY', label: 'USD/JPY', category: 'FOREX' },
  { name: 'AUDUSD', label: 'AUD/USD', category: 'FOREX' },
  { name: 'USDCAD', label: 'USD/CAD', category: 'FOREX' },
  { name: 'NZDUSD', label: 'NZD/USD', category: 'FOREX' },
  { name: 'USDCHF', label: 'USD/CHF', category: 'FOREX' },
  { name: 'EURGBP', label: 'EUR/GBP', category: 'FOREX' },
  { name: 'EURJPY', label: 'EUR/JPY', category: 'FOREX' },
  { name: 'GBPJPY', label: 'GBP/JPY', category: 'FOREX' },
  // Gold
  { name: 'XAUUSD', label: 'GOLD', category: 'GOLD' },
  // Indices
  { name: 'US30', label: 'US30 / DJ30', category: 'INDICES' },
  { name: 'NAS100', label: 'NAS100', category: 'INDICES' },
  { name: 'SPX500', label: 'SPX500', category: 'INDICES' },
  { name: 'GER30', label: 'GER30 / DAX', category: 'INDICES' },
  // Oil
  { name: 'USOIL', label: 'US OIL / WTI', category: 'OIL' },
  { name: 'UKOIL', label: 'UK OIL / BRENT', category: 'OIL' },
  // Volatility
  { name: 'V10', label: 'Volatility 10', category: 'VOLATILITY' },
  { name: 'V25', label: 'Volatility 25', category: 'VOLATILITY' },
  { name: 'V50', label: 'Volatility 50', category: 'VOLATILITY' },
  { name: 'V75', label: 'Volatility 75', category: 'VOLATILITY' },
  { name: 'V100', label: 'Volatility 100', category: 'VOLATILITY' },
];
