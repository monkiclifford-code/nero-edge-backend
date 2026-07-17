/**
 * Session-based image transfer system for phone-to-tablet image sharing.
 * Uses localStorage as the communication bridge.
 */

export interface TransferSession {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  images: TransferImage[];
  deviceName?: string;
}

export interface TransferImage {
  id: string;
  dataUrl: string;
  name: string;
  size: number;
  timestamp: string;
}

const SESSION_PREFIX = "forgetraceiq_transfer_";
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function createTransferSession(): TransferSession {
  const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = Date.now();
  const session: TransferSession = {
    sessionId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    images: [],
  };
  saveSession(session);
  return session;
}

export function getSession(sessionId: string): TransferSession | null {
  try {
    const raw = localStorage.getItem(`${SESSION_PREFIX}${sessionId}`);
    if (!raw) return null;
    const session: TransferSession = JSON.parse(raw);
    if (Date.now() > new Date(session.expiresAt).getTime()) {
      localStorage.removeItem(`${SESSION_PREFIX}${sessionId}`);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: TransferSession): void {
  localStorage.setItem(`${SESSION_PREFIX}${session.sessionId}`, JSON.stringify(session));
}

export function addImageToSession(sessionId: string, image: TransferImage): boolean {
  const session = getSession(sessionId);
  if (!session) return false;
  session.images.push(image);
  saveSession(session);
  return true;
}

export function getNewImages(sessionId: string, lastCount: number): TransferImage[] {
  const session = getSession(sessionId);
  if (!session) return [];
  return session.images.slice(lastCount);
}

export function getUploadPortalUrl(sessionId: string): string {
  // Get the current origin (works for any deployment)
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/upload/${sessionId}`;
}

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(SESSION_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const session: TransferSession = JSON.parse(raw);
          if (now > new Date(session.expiresAt).getTime()) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  }
}
