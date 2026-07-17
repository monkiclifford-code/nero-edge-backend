import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_USER_SETTINGS, DEFAULT_SUBSCRIPTION, type UserSettings, type SubscriptionState } from '@/lib/types';

const SETTINGS_KEY = 'nero_settings';
const SUBSCRIPTION_KEY = 'nero_subscription';

export function usePersistedSettings() {
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_USER_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_USER_SETTINGS);
  }, []);

  return { settings, updateSetting, resetSettings };
}

export function useSubscription() {
  const [sub, setSub] = useState<SubscriptionState>(() => {
    try {
      const saved = localStorage.getItem(SUBSCRIPTION_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SUBSCRIPTION;
  });

  useEffect(() => {
    localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(sub));
  }, [sub]);

  const incrementSignal = useCallback(() => {
    setSub((prev) => ({
      ...prev,
      signalCount: prev.signalCount + 1,
      trialUsed: prev.signalCount + 1 >= prev.maxFreeSignals,
    }));
  }, []);

  const subscribe = useCallback(() => {
    setSub((prev) => ({
      ...prev,
      isSubscribed: true,
      trialUsed: true,
    }));
  }, []);

  const resetSubscription = useCallback(() => {
    setSub(DEFAULT_SUBSCRIPTION);
  }, []);

  const canReceiveSignal = sub.isSubscribed || sub.signalCount < sub.maxFreeSignals;
  const signalsRemaining = Math.max(0, sub.maxFreeSignals - sub.signalCount);
  const isTrialExpired = sub.trialUsed && !sub.isSubscribed;

  return { sub, incrementSignal, subscribe, resetSubscription, canReceiveSignal, signalsRemaining, isTrialExpired };
}
