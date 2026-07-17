//+------------------------------------------------------------------+
//| Nero Edge AI Pattern Detector v1.3 — SIGNAL EDITION                |
//| Dollar-Based Risk + Signal Distribution via WebRequest()            |
//| Sends signals to backend server for MT5 push distribution           |
//+------------------------------------------------------------------+
#property copyright   "Nero Edge"
#property link        ""
#property version     "1.31"
#property strict

#include <Trade/Trade.mqh>

#define C_BG        C'8,8,12'
#define C_PANEL     C'18,18,24'
#define C_BORDER    C'45,45,60'
#define C_GREEN     C'0,220,120'
#define C_RED       C'240,60,80'
#define C_GOLD      C'255,195,50'
#define C_WHITE     clrWhite
#define C_GRAY      C'130,130,140'
#define C_BLUE      C'60,160,255'
#define C_CYAN      C'0,200,255'
#define C_PURPLE    C'170,90,210'
#define C_ORANGE    C'255,150,50'
#define C_DARKGREEN C'10,40,20'
#define C_DARKRED   C'50,15,15'

input group    "===== SESSION FILTER ====="
input bool     InpUseLondon       = true;
input bool     InpUseNewYork      = true;

input group    "===== PATTERN DETECTION ====="
input int      InpLookbackBars    = 50;
input double   InpPatternTolerance= 2.0;
input bool     InpRequireCHoCH    = false;
input bool     InpRequireEngulf   = false;

input group    "===== ENTRIES ====="
input bool     InpTradeBreak      = true;
input bool     InpTradeRetest     = true;
input double   InpRetestZone      = 2.0;

input group    "===== DOLLAR RISK MANAGEMENT ====="
input double   InpRiskUSD         = 50.0;
input double   InpMaxLot          = 5.0;
input double   InpMinLot          = 0.2;

input group    "===== SL / TP / BE / TRAILING (Points) ====="
input int      InpSLPts           = 500;
input int      InpTPPts           = 1500;
input int      InpBETriggerPts    = 250;
input int      InpBEOffsetPts     = 50;
input int      InpTrailStartPts   = 500;
input int      InpTrailStepPts    = 250;

input group    "===== PROFIT LOCK (Boss Style) ====="
input bool     InpUseProfitLock   = true;
input double   InpLockStep        = 100.0;
input double   InpLockAmount      = 70.0;
input bool     InpCloseIfDrop     = true;
input bool     InpUseTarget       = true;
input double   InpOverallTarget   = 500.0;

input group    "===== FILTERS ====="
input bool     InpUseTrendFilter   = true;
input int      InpFastEMA          = 50;
input int      InpSlowEMA          = 200;
input double   InpMaxSpread        = 500.0;
input int      InpMaxTrades        = 1;
input int      InpMagicNumber      = 91000;

input group    "===== DASHBOARD ====="
input int      InpDashX           = 15;
input int      InpDashY           = 25;
input int      InpRefreshMs       = 500;

input group    "===== BARS EXIT ====="
input bool     InpUseBarsExit     = false;
input ENUM_TIMEFRAMES InpBarsTF   = PERIOD_M5;
input int      InpBarsToExit      = 10;
input int      InpBarsExitDelay    = 1;

input group    "===== PATTERN STRENGTH FILTER ====="
input bool     InpUseStrengthFilter = true;
input int      InpMinStrength       = 60;

input group    "===== ELITE AUTO MODE ====="
input bool     InpUseEliteAutoMode  = true;

input group    "===== SIGNAL SERVER (NEW) ====="
input bool     InpSendSignals       = true;       // Send signals to server
input string   InpServerUrl         = "https://your-server.com/api/signal/webhook";
input string   InpEaSecret          = "neroedge-default-secret";

CTrade         g_trade;
string         D                   = "NeroAI_";
int            g_magic;
int            g_handleH1         = PERIOD_H1;
int            g_handleM5         = PERIOD_M5;
int            g_maFastHandle     = INVALID_HANDLE;
int            g_maSlowHandle     = INVALID_HANDLE;
double         g_prevDayHigh      = 0;
double         g_prevDayLow       = 0;
bool           g_sweepDetected    = false;
bool           g_sweepHigh        = false;
bool           g_mPattern         = false;
bool           g_wPattern         = false;
double         g_patternNeckline  = 0;
double         g_patternTop       = 0;
double         g_patternBottom    = 0;
bool           g_patternBroken    = false;
bool           g_waitingRetest    = false;
bool           g_retestConfirmed  = false;
double         g_lastSwingHigh    = 0;
double         g_lastSwingLow     = 0;
bool           g_chochBull        = false;
bool           g_chochBear        = false;
bool           g_bosBull          = false;
bool           g_bosBear          = false;
string         g_amdPhase         = "NONE";
double         g_amdRangeHigh     = 0;
double         g_amdRangeLow      = 0;
datetime       g_sessionStart     = 0;
datetime       g_sessionEnd       = 0;
string         g_currentSession   = "NONE";
string         g_lastSignal       = "";
string         g_signalType       = "";
datetime       g_lastSignalTime   = 0;
int            g_totalSignals     = 0;
int            g_totalTrades      = 0;
int            g_wins             = 0;
double         g_highestProfit    = 0.0;
double         g_lockedProfit     = 0.0;
bool           g_targetHit        = false;
double         g_patternStrength  = 0;
string         g_marketMode       = "UNKNOWN";
double         g_autoTolerance    = 0;
int            g_autoMinStrength  = 0;
double         g_autoMaxSpread    = 0;

void CreateDashboard(); void UpdateDashboard(); void DeleteDashboard();
void DrawPanel(string n,int x,int y,int w,int h,color bg,color bdr);
void DrawText(string n,int x,int y,string t,color c,int sz,string f);
void DrawLine(string n,int x1,int y1,int x2,int y2,color c);
void CheckPreviousDay(); void DetectSweep(); void DetectCHoCH_BOS(); void DetectAMD();
bool DetectMPattern(double &nl, double &top, double &bot);
bool DetectWPattern(double &nl, double &top, double &bot);
bool CheckEngulfing(bool bullish); void CheckBreakEntry(); void CheckRetestEntry();
void ManageBarsExit(); void ManageTrailingPts(); void ManageBreakEvenPts();
void CheckProfitLock(); void CheckOverallTarget(); void CheckDayReset();
double CalcLots(); double PointsToPrice(int pts); int PriceToPoints(double diff);
double GetFloatingProfit(); void CloseAllPositions(); int CountTrades(); bool CheckTrendFilter(string dir); int GetBarsSinceEntry(ulong ticket);
void SendSignalToServer(string sigType, double entry, double sl, double tp, string pattern, double strength);
double CalculatePatternStrength(bool isM, double neckline, double top, double bottom);
void DetectMarketProfile();
double GetAutoTolerance();
int    GetAutoMinStrength();
double GetAutoMaxSpread();
bool   IsStrengthFilterActive();
bool InSession(); void CheckSession(); void SendAlert(string type, string msg); void Log(string msg);

int OnInit()
{
   g_trade.SetExpertMagicNumber(InpMagicNumber);
   g_trade.SetDeviationInPoints(50);
   g_trade.SetTypeFilling(ORDER_FILLING_IOC);
   g_trade.SetAsyncMode(false);
   g_magic = InpMagicNumber;

   g_maFastHandle = iMA(_Symbol, PERIOD_M5, InpFastEMA, 0, MODE_EMA, PRICE_CLOSE);
   g_maSlowHandle = iMA(_Symbol, PERIOD_M5, InpSlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   if(g_maFastHandle == INVALID_HANDLE || g_maSlowHandle == INVALID_HANDLE)
      { Log("ERROR: MA handles failed"); return INIT_FAILED; }

   DetectMarketProfile();

   ChartSetInteger(0,CHART_COLOR_BACKGROUND,C_BG);
   ChartSetInteger(0,CHART_COLOR_FOREGROUND,C_WHITE);
   ChartSetInteger(0,CHART_SHOW_TRADE_LEVELS,false);

   CreateDashboard(); UpdateDashboard();
   EventSetTimer(1);

   Log("Nero Edge AI Pattern Detector v1.3-SIGNAL initialized | Mode="+g_marketMode+" | SendSignals="+(InpSendSignals?"ON":"OFF"));
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason)
{
   EventKillTimer();
   if(g_maFastHandle != INVALID_HANDLE) IndicatorRelease(g_maFastHandle);
   if(g_maSlowHandle != INVALID_HANDLE) IndicatorRelease(g_maSlowHandle);
   DeleteDashboard();
}
void OnTick()
{
   CheckDayReset(); CheckProfitLock(); CheckOverallTarget(); if(g_targetHit) return;
   if(!InSession()) return;

   CheckPreviousDay(); DetectSweep(); DetectCHoCH_BOS(); DetectAMD();

   double nl=0,top=0,bot=0;
   bool newMP=DetectMPattern(nl,top,bot), newWP=DetectWPattern(nl,top,bot);
   if(newMP && !g_mPattern)
   {
      g_patternStrength = CalculatePatternStrength(true, nl, top, bot);
      if(!IsStrengthFilterActive() || g_patternStrength >= GetAutoMinStrength())
      {
         g_mPattern=true; g_wPattern=false;
         g_patternNeckline=nl; g_patternTop=top; g_patternBottom=bot;
         g_patternBroken=false; g_waitingRetest=false; g_retestConfirmed=false;
         SendAlert("PATTERN","M detected! Strength="+DoubleToString(g_patternStrength,0)+" — Waiting for break...");
      }
      else
      {
         Log("M REJECTED — Strength="+DoubleToString(g_patternStrength,0)+" < Min="+IntegerToString(GetAutoMinStrength()));
      }
   }
   if(newWP && !g_wPattern)
   {
      g_patternStrength = CalculatePatternStrength(false, nl, top, bot);
      if(!IsStrengthFilterActive() || g_patternStrength >= GetAutoMinStrength())
      {
         g_wPattern=true; g_mPattern=false;
         g_patternNeckline=nl; g_patternTop=top; g_patternBottom=bot;
         g_patternBroken=false; g_waitingRetest=false; g_retestConfirmed=false;
         SendAlert("PATTERN","W detected! Strength="+DoubleToString(g_patternStrength,0)+" — Waiting for break...");
      }
      else
      {
         Log("W REJECTED — Strength="+DoubleToString(g_patternStrength,0)+" < Min="+IntegerToString(GetAutoMinStrength()));
      }
   }

   CheckBreakEntry(); CheckRetestEntry();

   ManageBreakEvenPts(); ManageTrailingPts();
   if(InpUseBarsExit) ManageBarsExit();
}
void OnTimer() { UpdateDashboard(); }

//+------------------------------------------------------------------+
//| SEND SIGNAL TO BACKEND SERVER via WebRequest()                      |
//+------------------------------------------------------------------+
void SendSignalToServer(string sigType, double entry, double sl, double tp, string pattern, double strength)
{
   if(!InpSendSignals) return;
   if(StringLen(InpServerUrl) < 10) return;

   string url = InpServerUrl;
   string headers = "Content-Type: application/json\r\nx-ea-secret: " + InpEaSecret + "\r\n";

   // Build JSON payload
   string json = "{";
   json += "\"pair\":\"" + _Symbol + "\",";
   json += "\"type\":\"" + sigType + "\",";
   json += "\"entryPrice\":" + DoubleToString(entry, _Digits) + ",";
   json += "\"stopLoss\":" + DoubleToString(sl, _Digits) + ",";
   json += "\"takeProfit\":" + DoubleToString(tp, _Digits) + ",";
   json += "\"pattern\":\"" + pattern + "\",";
   json += "\"strength\":" + DoubleToString(strength, 0) + ",";
   json += "\"chochDetected\":" + (g_chochBull || g_chochBear ? "true" : "false") + ",";
   json += "\"sweepDetected\":" + (g_sweepDetected ? "true" : "false") + ",";
   json += "\"session\":\"" + g_currentSession + "\"";
   json += "}";

   char data[], response[];
   int res;
   string resultHeaders;

   StringToCharArray(json, data, 0, StringLen(json), CP_UTF8);

   res = WebRequest("POST", url, headers, 5000, data, response, resultHeaders);

   if(res == -1)
   {
      int err = GetLastError();
      Log("SIGNAL SEND FAILED — WebRequest error: " + IntegerToString(err) + " | URL: " + url);
      Log("Make sure the URL is added to Tools > Options > Expert Advisors > Allow WebRequest");
   }
   else
   {
      string resp = CharArrayToString(response, 0, ArraySize(response), CP_UTF8);
      Log("SIGNAL SENT — Server response: " + resp);
   }
}

//+------------------------------------------------------------------+
//| PREVIOUS DAY H1 High/Low (fixed datetime math)                     |
//+------------------------------------------------------------------+
void CheckPreviousDay()
{
   datetime now = TimeCurrent();
   datetime yesterdayStart = now - (now % 86400) - 86400;
   datetime yesterdayEnd   = yesterdayStart + 86400;
   double h=0,l=0;
   for(int i=0; i<48; i++)
   {
      datetime t = iTime(_Symbol, PERIOD_H1, i);
      if(t >= yesterdayStart && t < yesterdayEnd)
      {
         if(h==0 || iHigh(_Symbol, PERIOD_H1, i) > h) h = iHigh(_Symbol, PERIOD_H1, i);
         if(l==0 || iLow(_Symbol, PERIOD_H1, i) < l)  l = iLow(_Symbol, PERIOD_H1, i);
      }
   }
   if(h>0) g_prevDayHigh=h; if(l>0) g_prevDayLow=l;
   if(h==0 || l==0) Log("WARNING: PDH/PDL unavailable — H1 history missing");
}

//+------------------------------------------------------------------+
//| SWEEP DETECTION + 4hr auto-reset                                   |
//+------------------------------------------------------------------+
void DetectSweep()
{
   if(g_prevDayHigh==0 || g_prevDayLow==0) return;

   double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
   double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID);

   if(ask>g_prevDayHigh && !g_sweepDetected)
   {
      g_sweepDetected=true; g_sweepHigh=true;
      SendAlert("SWEEP","PDH swept! Looking for M pattern...");
   }
   else if(bid<g_prevDayLow && !g_sweepDetected)
   {
      g_sweepDetected=true; g_sweepHigh=false;
      SendAlert("SWEEP","PDL swept! Looking for W pattern...");
   }

   static int lastTradeCount = 0;
   static datetime lastSweepReset = 0;
   if(g_totalTrades > lastTradeCount)
   {
      lastTradeCount = g_totalTrades;
      g_sweepDetected = false;
      lastSweepReset = TimeCurrent();
   }
   if(g_sweepDetected && TimeCurrent() - lastSweepReset > 14400)
   {
      g_sweepDetected = false; lastSweepReset = TimeCurrent();
      Log("SWEEP TIMEOUT — resetting after 4hrs");
   }
}

void DetectCHoCH_BOS()
{
   double highs[],lows[]; ArrayResize(highs,InpLookbackBars); ArrayResize(lows,InpLookbackBars);
   for(int i=0;i<InpLookbackBars;i++){highs[i]=iHigh(_Symbol,PERIOD_M5,i); lows[i]=iLow(_Symbol,PERIOD_M5,i);}
   for(int i=2;i<InpLookbackBars-2;i++)
   {
      if(highs[i]>highs[i-1]&&highs[i]>highs[i-2]&&highs[i]>highs[i+1]&&highs[i]>highs[i+2])
      {
         if(highs[i]>g_lastSwingHigh){g_bosBull=true; g_bosBear=false;}
         if(highs[i]<g_lastSwingHigh&&g_lastSwingHigh>0){g_chochBear=true; g_chochBull=false; g_bosBull=false;}
         g_lastSwingHigh=highs[i];
      }
      if(lows[i]<lows[i-1]&&lows[i]<lows[i-2]&&lows[i]<lows[i+1]&&lows[i]<lows[i+2])
      {
         if(lows[i]<g_lastSwingLow||g_lastSwingLow==0){g_bosBear=true; g_bosBull=false;}
         if(lows[i]>g_lastSwingLow&&g_lastSwingLow>0){g_chochBull=true; g_chochBear=false; g_bosBear=false;}
         g_lastSwingLow=lows[i];
      }
   }
}
void DetectAMD()
{
   double h=iHigh(_Symbol,PERIOD_M5,0), l=iLow(_Symbol,PERIOD_M5,0);
   if(g_amdPhase=="NONE"||g_amdPhase=="DISTRIBUTION")
   {
      double avgRange=0;
      for(int i=0;i<12;i++) avgRange+=iHigh(_Symbol,PERIOD_M5,i)-iLow(_Symbol,PERIOD_M5,i);
      avgRange/=12.0;
      if(iHigh(_Symbol,PERIOD_M5,0)-iLow(_Symbol,PERIOD_M5,0)<avgRange*0.6){g_amdPhase="ACCUMULATION"; g_amdRangeHigh=h; g_amdRangeLow=l;}
   }
   if(g_amdPhase=="ACCUMULATION"&&(h>g_amdRangeHigh||l<g_amdRangeLow)) g_amdPhase="MANIPULATION";
   if(g_amdPhase=="MANIPULATION"&&(g_chochBull||g_chochBear)) g_amdPhase="DISTRIBUTION";
}

//+------------------------------------------------------------------+
//| M PATTERN — neckline=mid low, tolerance *50                        |
//+------------------------------------------------------------------+
bool DetectMPattern(double &neckline,double &top,double &bottom)
{
   double h[],l[],c[]; ArrayResize(h,InpLookbackBars); ArrayResize(l,InpLookbackBars); ArrayResize(c,InpLookbackBars);
   for(int i=0;i<InpLookbackBars;i++){h[i]=iHigh(_Symbol,PERIOD_M5,i); l[i]=iLow(_Symbol,PERIOD_M5,i); c[i]=iClose(_Symbol,PERIOD_M5,i);}
   int peaks[]; ArrayResize(peaks,0);
   for(int i=3;i<InpLookbackBars-3;i++) if(h[i]>h[i-1]&&h[i]>h[i-2]&&h[i]>h[i+1]&&h[i]>h[i+2]){int s=ArraySize(peaks); ArrayResize(peaks,s+1); peaks[s]=i;}
   if(ArraySize(peaks)<2) return false;
   for(int p=0;p<ArraySize(peaks)-1;p++)
   {
      int p1=peaks[p],p2=peaks[p+1]; if(p2-p1<3||p2-p1>20) continue;
      double midLow=l[p1]; for(int i=p1;i<=p2;i++) if(l[i]<midLow) midLow=l[i];
      if(h[p2]<=h[p1]+GetAutoTolerance()*_Point*50){neckline=midLow; top=h[p1]; bottom=midLow; return true;}
   }
   return false;
}

//+------------------------------------------------------------------+
//| W PATTERN — neckline=mid high, tolerance *50                       |
//+------------------------------------------------------------------+
bool DetectWPattern(double &neckline,double &top,double &bottom)
{
   double h[],l[],c[]; ArrayResize(h,InpLookbackBars); ArrayResize(l,InpLookbackBars); ArrayResize(c,InpLookbackBars);
   for(int i=0;i<InpLookbackBars;i++){h[i]=iHigh(_Symbol,PERIOD_M5,i); l[i]=iLow(_Symbol,PERIOD_M5,i); c[i]=iClose(_Symbol,PERIOD_M5,i);}
   int valleys[]; ArrayResize(valleys,0);
   for(int i=3;i<InpLookbackBars-3;i++) if(l[i]<l[i-1]&&l[i]<l[i-2]&&l[i]<l[i+1]&&l[i]<l[i+2]){int s=ArraySize(valleys); ArrayResize(valleys,s+1); valleys[s]=i;}
   if(ArraySize(valleys)<2) return false;
   for(int v=0;v<ArraySize(valleys)-1;v++)
   {
      int v1=valleys[v],v2=valleys[v+1]; if(v2-v1<3||v2-v1>20) continue;
      double midHigh=h[v1]; for(int i=v1;i<=v2;i++) if(h[i]>midHigh) midHigh=h[i];
      if(l[v2]>=l[v1]-GetAutoTolerance()*_Point*50){neckline=midHigh; top=midHigh; bottom=l[v1]; return true;}
   }
   return false;
}
bool CheckEngulfing(bool bullish)
{
   double o1=iOpen(_Symbol,PERIOD_M5,1),c1=iClose(_Symbol,PERIOD_M5,1),o2=iOpen(_Symbol,PERIOD_M5,2),c2=iClose(_Symbol,PERIOD_M5,2);
   if(bullish) return(c1>o1&&c2<o2&&o1<=c2&&c1>=o2);
   return(c1<o1&&c2>o2&&o1>=c2&&c1<=o2);
}

//+------------------------------------------------------------------+
//| CHECK BREAK ENTRY — sends signal to server                         |
//+------------------------------------------------------------------+
void CheckBreakEntry()
{
   if(!InpTradeBreak) return;
   if(g_patternBroken || g_waitingRetest || g_retestConfirmed) return;
   if(CountTrades() >= InpMaxTrades) return;

   double c=iClose(_Symbol,PERIOD_M5,0);
   double o=iOpen(_Symbol,PERIOD_M5,0);
   double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
   double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID);

   double spread = (ask - bid) / _Point;
   double autoSpread = GetAutoMaxSpread();
   if(spread > autoSpread)
   {
      Log("SPREAD BLOCK: "+DoubleToString(spread,1)+" > "+DoubleToString(autoSpread,1)+" ("+g_marketMode+")");
      return;
   }

   if(g_mPattern && c<g_patternNeckline && o>=g_patternNeckline)
   {
      bool chochOK  = !InpRequireCHoCH || g_chochBear;
      bool engulfOK = !InpRequireEngulf || CheckEngulfing(false);
      bool trendOK  = !InpUseTrendFilter || CheckTrendFilter("SELL");

      if(!chochOK)  Log("M BREAK BLOCK — CHoCH missing");
      if(!engulfOK) Log("M BREAK BLOCK — No engulfing");
      if(!trendOK)  Log("M BREAK BLOCK — Trend filter rejected SELL");

      if(chochOK && engulfOK && trendOK)
      {
         g_patternBroken=true; g_waitingRetest=true;
         SendAlert("BREAK","M Pattern broken! Waiting for retest...");
         double lots=CalcLots(); if(lots>0)
         {
            g_trade.Sell(lots,_Symbol,bid,ask+PointsToPrice(InpSLPts),bid-PointsToPrice(InpTPPts),"NeroAI_M_Break");
            g_totalTrades++; SendAlert("ENTRY","SELL Entry — M Pattern Break | Lots="+DoubleToString(lots,2));
            // SEND SIGNAL TO SERVER
            SendSignalToServer("SELL", bid, ask+PointsToPrice(InpSLPts), bid-PointsToPrice(InpTPPts), "M", g_patternStrength);
         }
      }
   }

   if(g_wPattern && c>g_patternNeckline && o<=g_patternNeckline)
   {
      bool chochOK  = !InpRequireCHoCH || g_chochBull;
      bool engulfOK = !InpRequireEngulf || CheckEngulfing(true);
      bool trendOK  = !InpUseTrendFilter || CheckTrendFilter("BUY");

      if(!chochOK)  Log("W BREAK BLOCK — CHoCH missing");
      if(!engulfOK) Log("W BREAK BLOCK — No engulfing");
      if(!trendOK)  Log("W BREAK BLOCK — Trend filter rejected BUY");

      if(chochOK && engulfOK && trendOK)
      {
         g_patternBroken=true; g_waitingRetest=true;
         SendAlert("BREAK","W Pattern broken! Waiting for retest...");
         double lots=CalcLots(); if(lots>0)
         {
            g_trade.Buy(lots,_Symbol,ask,bid-PointsToPrice(InpSLPts),ask+PointsToPrice(InpTPPts),"NeroAI_W_Break");
            g_totalTrades++; SendAlert("ENTRY","BUY Entry — W Pattern Break | Lots="+DoubleToString(lots,2));
            // SEND SIGNAL TO SERVER
            SendSignalToServer("BUY", ask, bid-PointsToPrice(InpSLPts), ask+PointsToPrice(InpTPPts), "W", g_patternStrength);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| CHECK RETEST ENTRY — sends signal to server                        |
//+------------------------------------------------------------------+
void CheckRetestEntry()
{
   if(!InpTradeRetest) return;
   if(!g_waitingRetest || g_retestConfirmed) return;
   if(CountTrades() >= InpMaxTrades) return;

   double c=iClose(_Symbol,PERIOD_M5,0);
   double o=iOpen(_Symbol,PERIOD_M5,0);
   double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
   double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID);

   double spread = (ask - bid) / _Point;
   double autoSpread = GetAutoMaxSpread();
   if(spread > autoSpread)
   {
      Log("SPREAD BLOCK (retest): "+DoubleToString(spread,1)+" > "+DoubleToString(autoSpread,1)+" ("+g_marketMode+")");
      return;
   }

   if(g_mPattern)
   {
      double zone=GetAutoTolerance()*_Point*50;
      if(ask>=g_patternNeckline-zone && ask<=g_patternNeckline+zone && c<o && c<g_patternNeckline)
      {
         bool engulfOK = !InpRequireEngulf || CheckEngulfing(false);
         bool trendOK  = !InpUseTrendFilter || CheckTrendFilter("SELL");
         if(!engulfOK) Log("M RETEST BLOCK — No engulfing");
         if(!trendOK)  Log("M RETEST BLOCK — Trend filter rejected SELL");
         if(engulfOK && trendOK)
         {
            g_retestConfirmed=true; g_waitingRetest=false;
            double lots=CalcLots(); if(lots>0)
            {
               g_trade.Sell(lots,_Symbol,bid,ask+PointsToPrice(InpSLPts),bid-PointsToPrice(InpTPPts),"NeroAI_M_Retest");
               g_totalTrades++; SendAlert("ENTRY","SELL Entry — M Pattern Retest | Lots="+DoubleToString(lots,2));
               // SEND SIGNAL TO SERVER
               SendSignalToServer("SELL", bid, ask+PointsToPrice(InpSLPts), bid-PointsToPrice(InpTPPts), "M", g_patternStrength);
            }
         }
      }
   }

   if(g_wPattern)
   {
      double zone=GetAutoTolerance()*_Point*50;
      if(bid>=g_patternNeckline-zone && bid<=g_patternNeckline+zone && c>o && c>g_patternNeckline)
      {
         bool engulfOK = !InpRequireEngulf || CheckEngulfing(true);
         bool trendOK  = !InpUseTrendFilter || CheckTrendFilter("BUY");
         if(!engulfOK) Log("W RETEST BLOCK — No engulfing");
         if(!trendOK)  Log("W RETEST BLOCK — Trend filter rejected BUY");
         if(engulfOK && trendOK)
         {
            g_retestConfirmed=true; g_waitingRetest=false;
            double lots=CalcLots(); if(lots>0)
            {
               g_trade.Buy(lots,_Symbol,ask,bid-PointsToPrice(InpSLPts),ask+PointsToPrice(InpTPPts),"NeroAI_W_Retest");
               g_totalTrades++; SendAlert("ENTRY","BUY Entry — W Pattern Retest | Lots="+DoubleToString(lots,2));
               // SEND SIGNAL TO SERVER
               SendSignalToServer("BUY", ask, bid-PointsToPrice(InpSLPts), ask+PointsToPrice(InpTPPts), "W", g_patternStrength);
            }
         }
      }
   }
}

bool InSession(){CheckSession(); return g_currentSession!="NONE";}

//+------------------------------------------------------------------+
//| SESSION FILTER — 24/7 bypass for synthetic indices                   |
//+------------------------------------------------------------------+
void CheckSession()
{
   if(g_marketMode=="VOLATILITY")
   {
      if(g_currentSession!="24/7"){g_currentSession="24/7"; Log("24/7 mode active (synthetic index)");}
      return;
   }
   MqlDateTime dt; TimeToStruct(TimeCurrent(),dt);
   if(InpUseLondon&&dt.hour>=8&&dt.hour<11){if(g_currentSession!="LONDON"){g_currentSession="LONDON"; Log("London session active");} return;}
   if(InpUseNewYork&&dt.hour>=13&&dt.hour<16){if(g_currentSession!="NEW YORK"){g_currentSession="NEW YORK"; Log("New York session active");} return;}
   g_currentSession="NONE";
}

//+------------------------------------------------------------------+
//| DOLLAR-BASED LOT CALCULATION                                        |
//+------------------------------------------------------------------+
double NormalizeLot(double lots)
{
   double lotStep=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   double minLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double maxLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   if(lotStep>0) lots=MathFloor(lots/lotStep)*lotStep;
   if(lots<minLot) lots=minLot;
   if(lots>maxLot) lots=maxLot;
   if(lots>InpMaxLot && InpMaxLot>0) lots=InpMaxLot;
   if(lots<InpMinLot && InpMinLot>0) lots=InpMinLot;
   return lots;
}
double CalcLots()
{
   double tickValue=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_VALUE);
   if(tickValue<=0) tickValue=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_VALUE_PROFIT);
   if(tickValue<=0){Log("ERROR: tickValue=0 — cannot calc lots"); return 0;}

   double lossPerLot = (InpSLPts * tickValue);
   if(lossPerLot<=0){Log("ERROR: lossPerLot=0 — SL too small"); return 0;}

   double lots = InpRiskUSD / lossPerLot;
   Log("LOT CALC | Risk$="+DoubleToString(InpRiskUSD,2)+" SLpts="+IntegerToString(InpSLPts)+" TickVal="+DoubleToString(tickValue,5)+" RawLots="+DoubleToString(lots,3));
   return NormalizeLot(lots);
}

void SendAlert(string type,string msg){g_lastSignal=msg; g_signalType=type; g_lastSignalTime=TimeCurrent(); g_totalSignals++; Print("[NERO AI] ",msg); if(type=="ENTRY") Alert("ENTRY: ",msg); else if(type=="PATTERN") Alert("PATTERN: ",msg); else if(type=="BREAK") Alert("BREAK: ",msg); else if(type=="SWEEP") Alert("SWEEP: ",msg);}
void Log(string msg){Print("[NERO AI] ",msg);}

void CreateDashboard()
{
   int x=InpDashX,y=InpDashY,w=250;
   DrawPanel(D+"BG",x,y,w,440,C_BG,C_BORDER);
   DrawPanel(D+"TitleBar",x+3,y+3,w-6,34,C_PANEL,C_GOLD);
   DrawText(D+"Title",x+12,y+8,"Nero Edge AI Pattern Detector",C_GOLD,11,"Arial Bold");
   int s1=y+44,s2=s1+20,s3=s2+20,s4=s3+24,s5=s4+20,s6=s5+20,s7=s6+24,s8=s7+16,s9=s8+24,s10=s9+36;
   DrawText(D+"kSess",x+12,s1,"SESSION:",C_GRAY,8,"Arial"); DrawText(D+"vSess",x+80,s1,"WAITING",C_GRAY,9,"Arial Bold");
   DrawText(D+"kAMD",x+12,s2,"AMD:",C_GRAY,8,"Arial"); DrawText(D+"vAMD",x+80,s2,"NONE",C_GRAY,9,"Arial Bold");
   DrawText(D+"kChoch",x+12,s3,"CHoCH:",C_GRAY,8,"Arial"); DrawText(D+"vChoch",x+80,s3,"---",C_GRAY,9,"Arial Bold");
   DrawLine(D+"Sep1",x+8,s3+16,x+w-8,s3+16,C_BORDER);
   DrawText(D+"kPat",x+12,s4,"PATTERN:",C_GRAY,8,"Arial"); DrawText(D+"vPat",x+80,s4,"NONE",C_GRAY,9,"Arial Bold");
   DrawText(D+"kMode",x+12,s5,"MODE:",C_GRAY,8,"Arial"); DrawText(D+"vMode",x+55,s5,"AUTO",C_CYAN,9,"Arial Bold");
   DrawText(D+"kSwp",x+12,s6,"SWEEP:",C_GRAY,8,"Arial"); DrawText(D+"vSwp",x+80,s6,"---",C_GRAY,9,"Arial Bold");
   DrawText(D+"kStat",x+12,s7,"STATUS:",C_GRAY,8,"Arial"); DrawText(D+"vStat",x+80,s7,"SCANNING",C_GREEN,9,"Arial Bold");
   DrawLine(D+"Sep2",x+8,s7+16,x+w-8,s7+16,C_BORDER);
   DrawText(D+"kPDH",x+12,s8,"PDH:",C_GRAY,8,"Arial"); DrawText(D+"vPDH",x+80,s8,"---",C_BLUE,8,"Arial");
   DrawText(D+"kPDL",x+12,s9,"PDL:",C_GRAY,8,"Arial"); DrawText(D+"vPDL",x+80,s9,"---",C_BLUE,8,"Arial");
   DrawLine(D+"Sep3",x+8,s9+16,x+w-8,s9+16,C_BORDER);
   DrawText(D+"kSig",x+12,s10,"SIGNAL:",C_GRAY,8,"Arial"); DrawText(D+"vSig",x+12,s10+14,"No signal yet...",C_GRAY,8,"Arial");
   DrawText(D+"kWin",x+12,s10+40,"WINS:",C_GREEN,8,"Arial"); DrawText(D+"vWin",x+60,s10+40,"0",C_GREEN,9,"Arial Bold");
   DrawText(D+"kTot",x+100,s10+40,"TOTAL:",C_GRAY,8,"Arial"); DrawText(D+"vTot",x+150,s10+40,"0",C_WHITE,9,"Arial Bold");
}
void UpdateDashboard()
{
   color cSess=g_currentSession=="NONE"?C_GRAY:C_GOLD;
   ObjectSetString(0,D+"vSess",OBJPROP_TEXT,g_currentSession); ObjectSetInteger(0,D+"vSess",OBJPROP_COLOR,cSess);
   color cAMD=C_GRAY; if(g_amdPhase=="ACCUMULATION") cAMD=C_BLUE; if(g_amdPhase=="MANIPULATION") cAMD=C_ORANGE; if(g_amdPhase=="DISTRIBUTION") cAMD=C_PURPLE;
   ObjectSetString(0,D+"vAMD",OBJPROP_TEXT,g_amdPhase); ObjectSetInteger(0,D+"vAMD",OBJPROP_COLOR,cAMD);
   string chochTxt="---"; color cChoch=C_GRAY; if(g_chochBull){chochTxt="BULLISH";cChoch=C_GREEN;} if(g_chochBear){chochTxt="BEARISH";cChoch=C_RED;}
   ObjectSetString(0,D+"vChoch",OBJPROP_TEXT,chochTxt); ObjectSetInteger(0,D+"vChoch",OBJPROP_COLOR,cChoch);
   string patTxt="NONE"; color cPat=C_GRAY; if(g_mPattern){patTxt="M DETECTED";cPat=C_RED;} if(g_wPattern){patTxt="W DETECTED";cPat=C_GREEN;} if(g_patternBroken&&g_waitingRetest){patTxt="WAIT RETEST";cPat=C_ORANGE;} if(g_retestConfirmed){patTxt="RETEST OK";cPat=C_GOLD;}
   ObjectSetString(0,D+"vPat",OBJPROP_TEXT,patTxt); ObjectSetInteger(0,D+"vPat",OBJPROP_COLOR,cPat);
   string modeTxt=g_marketMode; color cMode=C_CYAN;
   if(modeTxt=="FOREX") cMode=C_GREEN; else if(modeTxt=="GOLD") cMode=C_GOLD; else if(modeTxt=="VOLATILITY") cMode=C_ORANGE;
   if(!InpUseEliteAutoMode){modeTxt="MANUAL"; cMode=C_GRAY;}
   ObjectSetString(0,D+"vMode",OBJPROP_TEXT,modeTxt); ObjectSetInteger(0,D+"vMode",OBJPROP_COLOR,cMode);
   string swpTxt="---"; color cSwp=C_GRAY; if(g_sweepDetected){swpTxt=g_sweepHigh?"PDH SWEEP":"PDL SWEEP";cSwp=C_ORANGE;}
   ObjectSetString(0,D+"vSwp",OBJPROP_TEXT,swpTxt); ObjectSetInteger(0,D+"vSwp",OBJPROP_COLOR,cSwp);
   string stat="SCANNING"; color cStat=C_GREEN; if(g_patternBroken&&g_waitingRetest){stat="WAIT RETEST";cStat=C_ORANGE;} else if(g_retestConfirmed){stat="ENTRY CONFIRMED";cStat=C_GOLD;} else if(!InSession()){stat="OUT OF SESSION";cStat=C_GRAY;}
   ObjectSetString(0,D+"vStat",OBJPROP_TEXT,stat); ObjectSetInteger(0,D+"vStat",OBJPROP_COLOR,cStat);
   if(g_prevDayHigh>0) ObjectSetString(0,D+"vPDH",OBJPROP_TEXT,DoubleToString(g_prevDayHigh,_Digits));
   if(g_prevDayLow>0) ObjectSetString(0,D+"vPDL",OBJPROP_TEXT,DoubleToString(g_prevDayLow,_Digits));
   if(g_lastSignal!=""){color cSig=g_signalType=="ENTRY"?C_GOLD:(g_signalType=="PATTERN"?C_CYAN:C_WHITE); ObjectSetString(0,D+"vSig",OBJPROP_TEXT,g_lastSignal); ObjectSetInteger(0,D+"vSig",OBJPROP_COLOR,cSig);}
   ObjectSetString(0,D+"vWin",OBJPROP_TEXT,IntegerToString(g_wins)); ObjectSetString(0,D+"vTot",OBJPROP_TEXT,IntegerToString(g_totalTrades));
   ChartRedraw(0);
}
void DeleteDashboard(){int total=ObjectsTotal(0,0,-1); for(int i=total-1;i>=0;i--){string name=ObjectName(0,i,0,-1); if(StringFind(name,D)==0) ObjectDelete(0,name);} ChartRedraw(0);}
void DrawPanel(string n,int x,int y,int w,int h,color bg,color bdr){if(ObjectFind(0,n)>=0) return; ObjectCreate(0,n,OBJ_RECTANGLE_LABEL,0,0,0); ObjectSetInteger(0,n,OBJPROP_XDISTANCE,x); ObjectSetInteger(0,n,OBJPROP_YDISTANCE,y); ObjectSetInteger(0,n,OBJPROP_XSIZE,w); ObjectSetInteger(0,n,OBJPROP_YSIZE,h); ObjectSetInteger(0,n,OBJPROP_BGCOLOR,bg); ObjectSetInteger(0,n,OBJPROP_BORDER_TYPE,BORDER_FLAT); ObjectSetInteger(0,n,OBJPROP_COLOR,bdr); ObjectSetInteger(0,n,OBJPROP_BACK,false); ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false); ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);}
void DrawText(string n,int x,int y,string t,color c,int sz,string f){if(ObjectFind(0,n)>=0){ObjectSetString(0,n,OBJPROP_TEXT,t);return;} ObjectCreate(0,n,OBJ_LABEL,0,0,0); ObjectSetInteger(0,n,OBJPROP_XDISTANCE,x); ObjectSetInteger(0,n,OBJPROP_YDISTANCE,y); ObjectSetInteger(0,n,OBJPROP_COLOR,c); ObjectSetInteger(0,n,OBJPROP_FONTSIZE,sz); ObjectSetString(0,n,OBJPROP_FONT,f); ObjectSetInteger(0,n,OBJPROP_CORNER,CORNER_LEFT_UPPER); ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false); ObjectSetInteger(0,n,OBJPROP_HIDDEN,true); ObjectSetString(0,n,OBJPROP_TEXT,t);}
void DrawLine(string n,int x1,int y1,int x2,int y2,color c){if(ObjectFind(0,n)>=0) return; ObjectCreate(0,n,OBJ_RECTANGLE_LABEL,0,0,0); ObjectSetInteger(0,n,OBJPROP_XDISTANCE,x1); ObjectSetInteger(0,n,OBJPROP_YDISTANCE,y1); ObjectSetInteger(0,n,OBJPROP_XSIZE,x2-x1); ObjectSetInteger(0,n,OBJPROP_YSIZE,1); ObjectSetInteger(0,n,OBJPROP_BGCOLOR,c); ObjectSetInteger(0,n,OBJPROP_BORDER_TYPE,BORDER_FLAT); ObjectSetInteger(0,n,OBJPROP_COLOR,c); ObjectSetInteger(0,n,OBJPROP_BACK,false); ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false); ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);}

void ManageBreakEvenPts()
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetInteger(POSITION_MAGIC)!=g_magic) continue;
      if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
      double openPrice=PositionGetDouble(POSITION_PRICE_OPEN),currSL=PositionGetDouble(POSITION_SL);
      ENUM_POSITION_TYPE type=(ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      if(type==POSITION_TYPE_BUY){double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID); if((bid-openPrice)/_Point>=InpBETriggerPts){double newSL=openPrice+PointsToPrice(InpBEOffsetPts); if(currSL==0||newSL>currSL) g_trade.PositionModify(ticket,newSL,PositionGetDouble(POSITION_TP));}}
      else{double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK); if((openPrice-ask)/_Point>=InpBETriggerPts){double newSL=openPrice-PointsToPrice(InpBEOffsetPts); if(currSL==0||newSL<currSL) g_trade.PositionModify(ticket,newSL,PositionGetDouble(POSITION_TP));}}
   }
}
void ManageTrailingPts()
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetInteger(POSITION_MAGIC)!=g_magic) continue;
      if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
      double openPrice=PositionGetDouble(POSITION_PRICE_OPEN),currSL=PositionGetDouble(POSITION_SL);
      ENUM_POSITION_TYPE type=(ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      if(type==POSITION_TYPE_BUY){double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID); if((bid-openPrice)/_Point>=InpTrailStartPts){double newSL=bid-PointsToPrice(InpTrailStepPts); if(currSL==0||newSL>currSL) g_trade.PositionModify(ticket,newSL,PositionGetDouble(POSITION_TP));}}
      else{double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK); if((openPrice-ask)/_Point>=InpTrailStartPts){double newSL=ask+PointsToPrice(InpTrailStepPts); if(currSL==0||newSL<currSL) g_trade.PositionModify(ticket,newSL,PositionGetDouble(POSITION_TP));}}
   }
}
void ManageBarsExit()
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetInteger(POSITION_MAGIC)!=g_magic) continue;
      if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
      int barsOpen = GetBarsSinceEntry(ticket);
      if(barsOpen < InpBarsExitDelay)
      {
         Log("BARS EXIT SKIP — Trade only "+IntegerToString(barsOpen)+" bars old (need "+IntegerToString(InpBarsExitDelay)+")");
         continue;
      }
      int barsShift=iBarShift(_Symbol,InpBarsTF,(datetime)PositionGetInteger(POSITION_TIME),false);
      int currBar=iBarShift(_Symbol,InpBarsTF,TimeCurrent(),false);
      if(barsShift>=0&&(currBar-barsShift)>=InpBarsToExit){g_trade.PositionClose(ticket); Log("BARS EXIT - #"+IntegerToString((long)ticket));}
   }
}
int GetBarsSinceEntry(ulong ticket)
{
   if(!PositionSelectByTicket(ticket)) return 0;
   datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
   int barIdx = iBarShift(_Symbol, PERIOD_M5, openTime, false);
   int currBar = iBarShift(_Symbol, PERIOD_M5, TimeCurrent(), false);
   if(barIdx < 0) return 0;
   return (currBar - barIdx);
}
double PointsToPrice(int pts){return pts*_Point;}
int PriceToPoints(double priceDiff){if(_Point==0)return 0; double pts=priceDiff/_Point; if(pts>=0)return(int)(pts+0.5); return(int)(pts-0.5);}

void CheckProfitLock()
{
   if(!InpUseProfitLock) return;
   double floating=GetFloatingProfit(); if(floating>g_highestProfit) g_highestProfit=floating;
   double stepsRaw=g_highestProfit/InpLockStep; int steps=(int)(stepsRaw>=0?stepsRaw+0.5:stepsRaw-0.5); if(steps<0) steps=0;
   double newLock=steps*InpLockAmount; if(newLock>g_lockedProfit){g_lockedProfit=newLock; Log("LOCK: $"+DoubleToString(g_lockedProfit,2)+" | Peak: $"+DoubleToString(g_highestProfit,2));}
   if(InpCloseIfDrop&&floating<=g_lockedProfit&&g_lockedProfit>0&&floating>0){CloseAllPositions(); g_highestProfit=0; g_lockedProfit=0; Log("LOCK DROP - All positions closed!");}
}
void CheckOverallTarget()
{
   if(!InpUseTarget||g_targetHit) return;
   double floating=GetFloatingProfit(); if(floating>=InpOverallTarget){g_targetHit=true; CloseAllPositions(); Alert("TARGET $"+DoubleToString(InpOverallTarget,0)+" HIT! All positions closed.");}
}
void CheckDayReset()
{
   if(!InpUseProfitLock&&!InpUseTarget) return; static int lastDay=0; MqlDateTime dt; TimeToStruct(TimeCurrent(),dt);
   if(dt.day!=lastDay){lastDay=dt.day; g_targetHit=false; g_highestProfit=0; g_lockedProfit=0; Log("DAY RESET - lock + target cleared");}
}
double GetFloatingProfit()
{
   double total=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL)==_Symbol)
         total+=PositionGetDouble(POSITION_PROFIT)+PositionGetDouble(POSITION_SWAP);
   }
   return total;
}
void CloseAllPositions()
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL)==_Symbol)
         g_trade.PositionClose(ticket);
   }
}

int CountTrades()
{
   int total=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetInteger(POSITION_MAGIC)==g_magic && PositionGetString(POSITION_SYMBOL)==_Symbol)
         total++;
   }
   return total;
}

bool CheckTrendFilter(string dir)
{
   if(!InpUseTrendFilter) return true;
   double fastBuf[], slowBuf[];
   double fastVal=0, slowVal=0;
   if(CopyBuffer(g_maFastHandle,0,0,1,fastBuf)>0) fastVal=fastBuf[0];
   if(CopyBuffer(g_maSlowHandle,0,0,1,slowBuf)>0) slowVal=slowBuf[0];
   if(fastVal==0 || slowVal==0) return true;
   if(dir=="BUY"  && fastVal>slowVal) return true;
   if(dir=="SELL" && fastVal<slowVal) return true;
   Log("TREND BLOCK "+dir+" | Fast="+DoubleToString(fastVal,5)+" Slow="+DoubleToString(slowVal,5));
   return false;
}

//+------------------------------------------------------------------+
//| PATTERN STRENGTH SCORE (0-100)                                      |
//+------------------------------------------------------------------+
double CalculatePatternStrength(bool isM, double neckline, double top, double bottom)
{
   double score = 0;
   double range = MathAbs(top - bottom);
   if(range > 0) score += 25;
   double lastClose = iClose(_Symbol, PERIOD_M5, 0);
   if(isM && lastClose < neckline) score += 20;
   if(!isM && lastClose > neckline) score += 20;
   if(isM && g_chochBear) score += 20;
   if(!isM && g_chochBull) score += 20;
   if(CheckTrendFilter(isM ? "SELL" : "BUY")) score += 20;
   if(g_sweepDetected && isM && g_sweepHigh) score += 15;
   if(g_sweepDetected && !isM && !g_sweepHigh) score += 15;
   return score;
}

//+------------------------------------------------------------------+
//| ELITE AUTO MODE — Market Profile Detection                           |
//+------------------------------------------------------------------+
void DetectMarketProfile()
{
   string sym = _Symbol;
   if(StringFind(sym, "XAU") >= 0 || StringFind(sym, "GOLD") >= 0)
   { g_marketMode = "GOLD"; Log("ELITE AUTO: GOLD profile loaded"); return; }
   if(StringFind(sym, "V10") >= 0 || StringFind(sym, "V25") >= 0 ||
      StringFind(sym, "V50") >= 0 || StringFind(sym, "V75") >= 0 ||
      StringFind(sym, "V100") >= 0 || StringFind(sym, "10S") >= 0 ||
      StringFind(sym, "30S") >= 0 || StringFind(sym, "100S") >= 0)
   { g_marketMode = "VOLATILITY"; Log("ELITE AUTO: VOLATILITY profile loaded"); return; }
   if(StringFind(sym, "EUR") >= 0 || StringFind(sym, "GBP") >= 0 ||
      StringFind(sym, "USDJPY") >= 0 || StringFind(sym, "AUD") >= 0 ||
      StringFind(sym, "NZD") >= 0 || StringFind(sym, "USDCHF") >= 0 ||
      StringFind(sym, "USD") >= 0 || StringFind(sym, "JPY") >= 0 ||
      StringFind(sym, "CHF") >= 0 || StringFind(sym, "CAD") >= 0)
   { g_marketMode = "FOREX"; Log("ELITE AUTO: FOREX profile loaded"); return; }
   g_marketMode = "UNKNOWN";
   Log("ELITE AUTO: UNKNOWN profile — using default settings");
}

//+------------------------------------------------------------------+
//| ELITE AUTO — Get Auto Tolerance                                      |
//+------------------------------------------------------------------+
double GetAutoTolerance()
{
   if(!InpUseEliteAutoMode) return InpPatternTolerance;
   if(g_marketMode == "FOREX")       return 1.25;
   if(g_marketMode == "GOLD")        return 2.15;
   if(g_marketMode == "VOLATILITY")  return 3.25;
   return InpPatternTolerance;
}

//+------------------------------------------------------------------+
//| ELITE AUTO — Get Auto Min Strength                                   |
//+------------------------------------------------------------------+
int GetAutoMinStrength()
{
   if(!InpUseEliteAutoMode) return InpMinStrength;
   if(g_marketMode == "FOREX")       return 65;
   if(g_marketMode == "GOLD")        return 55;
   if(g_marketMode == "VOLATILITY")  return 45;
   return InpMinStrength;
}

//+------------------------------------------------------------------+
//| ELITE AUTO — Get Auto Max Spread                                     |
//+------------------------------------------------------------------+
double GetAutoMaxSpread()
{
   if(!InpUseEliteAutoMode) return InpMaxSpread;
   if(g_marketMode == "FOREX")       return 50.0;
   if(g_marketMode == "GOLD")        return 300.0;
   if(g_marketMode == "VOLATILITY")  return 1000.0;
   return InpMaxSpread;
}

//+------------------------------------------------------------------+
//| ELITE AUTO — Is Strength Filter Active                               |
//+------------------------------------------------------------------+
bool IsStrengthFilterActive()
{
   if(!InpUseEliteAutoMode) return InpUseStrengthFilter;
   return true;
}
//+------------------------------------------------------------------+
