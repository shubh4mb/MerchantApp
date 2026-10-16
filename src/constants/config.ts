/**
 * Single source of truth for Application Configuration and Backend URL.
 *
 * To switch backend environments (e.g. Local vs Production):
 * 1. Set `EXPO_PUBLIC_BACKEND_URL` in `.env` (recommended):
 *    - Production: https://api.theflashfits.com
 *    - Local LAN:   http://192.168.29.230:5000
 * OR
 * 2. Update `DEFAULT_BACKEND_URL` below if running without an environment variable.
 */

// Fallback URL if EXPO_PUBLIC_BACKEND_URL is not set
export const DEFAULT_BACKEND_URL = 'https://api.theflashfits.com';

// Cleaned backend base URL (without trailing slashes)
export const BACKEND_URL = (
  process.env.EXPO_PUBLIC_BACKEND_URL?.trim() || DEFAULT_BACKEND_URL
).replace(/\/+$/, '');

console.log('🌐 [Config] ACTIVE BACKEND_URL:', BACKEND_URL);

// Base URL for API endpoints
export const API_BASE_URL = `${BACKEND_URL}/api`;

/**
 * Resolves full URL for images/media returned from backend or local storage.
 * Handles:
 * - Full remote URLs (http:// or https://)
 * - Local file URIs (file:// or data:)
 * - Relative backend paths (e.g. /uploads/image.jpg -> https://api.theflashfits.com/uploads/image.jpg)
 */
export const resolveImageUrl = (uri?: string | null): string | null => {
  if (!uri) return null;
  const trimmed = uri.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${BACKEND_URL}${cleanPath}`;
};
