/**
 * Server-side keyCRM HTTP client (https://openapi.keycrm.app/v1).
 * GET endpoints are used for configuration/catalog reads; order create is
 * called from checkout only when KEYCRM_SYNC_ENABLED is on.
 *
 * Security: the API key never appears in logs or error messages.
 */

import { readKeyCrmConfig } from './config';
import type { KeyCrmOrderPayload } from './types';

const DEFAULT_BASE_URL = 'https://openapi.keycrm.app/v1';
const DEFAULT_TIMEOUT_MS = 10_000;

export class KeyCrmApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'KeyCrmApiError';
    this.status = status;
    this.code = code;
  }
}

export type KeyCrmFetch = typeof fetch;

export interface KeyCrmClientOptions {
  apiKey?: string | null;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: KeyCrmFetch;
}

function resolveApiKey(explicit?: string | null): string {
  const key = explicit ?? readKeyCrmConfig().apiKey;
  if (!key) throw new KeyCrmApiError('KeyCRM API key is not configured', 0, 'CONFIG');
  return key;
}

async function keyCrmRequest<T>(
  path: string,
  options: KeyCrmClientOptions & { method?: string; body?: unknown } = {},
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${resolveApiKey(options.apiKey)}`,
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      throw new KeyCrmApiError(
        `keyCRM request failed: ${response.status}`,
        response.status,
        classifyStatus(response.status),
      );
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof KeyCrmApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new KeyCrmApiError('keyCRM request timed out', 408, 'TIMEOUT');
    }
    throw new KeyCrmApiError('keyCRM request failed', 0, 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

function classifyStatus(status: number): string {
  if (status === 401 || status === 403) return 'UNAUTHORIZED';
  if (status === 422 || status === 400) return 'VALIDATION';
  if (status === 429) return 'RATE_LIMIT';
  if (status >= 500) return 'SERVER';
  return 'HTTP';
}

export function createKeyCrmOrder(
  payload: KeyCrmOrderPayload,
  options: KeyCrmClientOptions = {},
): Promise<unknown> {
  return keyCrmRequest('/order', { ...options, method: 'POST', body: payload });
}

export function getKeyCrmOrder(
  orderId: number | string,
  include?: string,
  options: KeyCrmClientOptions = {},
): Promise<Record<string, unknown>> {
  const query = include ? `?include=${encodeURIComponent(include)}` : '';
  return keyCrmRequest(`/order/${encodeURIComponent(String(orderId))}${query}`, options);
}

export function listKeyCrmSources(options: KeyCrmClientOptions = {}) {
  return keyCrmRequest<unknown>('/order/source?limit=50', options);
}

export function listKeyCrmStatuses(options: KeyCrmClientOptions = {}) {
  return keyCrmRequest<unknown>('/order/status?limit=50', options);
}

export function listKeyCrmCustomFields(options: KeyCrmClientOptions = {}) {
  return keyCrmRequest<unknown>('/custom-fields?include=options', options);
}

export function listKeyCrmDeliveryServices(options: KeyCrmClientOptions = {}) {
  return keyCrmRequest<unknown>('/order/delivery-service?limit=50', options);
}

export function listKeyCrmOffersBySku(
  skus: string[],
  options: KeyCrmClientOptions = {},
) {
  const query = skus.map((sku) => encodeURIComponent(sku)).join(',');
  return keyCrmRequest<unknown>(`/offers?filter[sku]=${query}&include=product&limit=50`, options);
}
