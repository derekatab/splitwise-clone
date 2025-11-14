import crypto from 'crypto';

export function generateDeviceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function getDeviceIdFromCookie(cookies: { [key: string]: string }): string | null {
  return cookies.deviceId || null;
}

export function setDeviceIdCookie(deviceId: string): string {
  // Return the Set-Cookie header value
  return `deviceId=${deviceId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${365 * 24 * 60 * 60}`;
}
