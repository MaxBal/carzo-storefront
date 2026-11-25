export type MetaEventName = 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase' | 'Lead';

export interface MetaCustomData {
  currency?: 'UAH';
  value?: number;
  content_type?: 'product';
  content_ids?: string[];
  contents?: { id: string; quantity: number; item_price: number }[];
  num_items?: number;
}

export interface MetaDestination {
  key: string;
  pixelId: string;
  productTypes: string[];
  pagePaths: string[];
  pathPrefixes: string[];
}

export interface MetaPublicConfig {
  allowedHosts: string[];
  destinations: MetaDestination[];
}

export interface MetaBrowserEvent {
  pixelId: string;
  eventId: string;
  name: MetaEventName;
  data: MetaCustomData;
}

export interface MetaTrackingContext {
  consentId: string;
  sourceUrl: string;
  userAgent: string;
  ip?: string;
  fbp?: string;
  fbc?: string;
}

export interface MetaEventDraft {
  destination: string;
  pixel_id: string;
  event_source_url: string;
  user_data: { ph?: string[]; client_user_agent: string; client_ip_address?: string; fbp?: string; fbc?: string };
  custom_data: MetaCustomData;
}

export interface MetaOutboxRow {
  id: string;
  lease_id: string;
  destination: string;
  pixel_id: string;
  event_id: string;
  attempts: number;
  payload: Record<string, unknown>;
}
