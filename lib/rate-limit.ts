// Simple in-memory fixed-window rate limiter for login brute-force protection.
// Note: state is per server instance. On multi-instance/serverless deployments
// this still raises the cost of brute force but is not a global guarantee — a
// shared store (e.g. Redis) would be needed for that.

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Records an attempt for the key. Returns true if still under the limit,
// false once the limit is exceeded within the current window.
export function registerLoginAttempt(key: string): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

// Clears the counter after a successful login.
export function resetLoginAttempts(key: string): void {
  store.delete(key);
}

// Opportunistically drop expired entries so the map doesn't grow unbounded.
function sweep() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}
setInterval(sweep, WINDOW_MS).unref?.();
