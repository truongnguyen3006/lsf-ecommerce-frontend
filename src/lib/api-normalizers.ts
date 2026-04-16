export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))
      ? Number(value)
      : fallback;
}

export function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'enabled' || normalized === 'active') return true;
    if (normalized === 'false' || normalized === 'disabled' || normalized === 'inactive') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function unwrapCollection<T>(payload: unknown, preferredKeys?: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!isRecord(payload)) return [];

  const keys = preferredKeys ?? ['content', 'items', 'data', 'results', 'orders', 'products', 'users'];
  for (const key of keys) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) return candidate as T[];
  }

  for (const candidate of Object.values(payload)) {
    if (Array.isArray(candidate)) return candidate as T[];
  }

  return [];
}
