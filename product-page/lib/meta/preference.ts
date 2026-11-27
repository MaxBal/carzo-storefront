export type MetaMarketingPreference = 'enabled' | 'granted' | 'denied';

/** Automatic enablement is distinct from an explicit user opt-in. */
export function isMetaTrackingEnabled(value: string | undefined | null): boolean {
  return value === 'enabled' || value === 'granted';
}
