/**
 * Checkout → keyCRM sync entry point.
 * No-op unless KEYCRM_SYNC_ENABLED is on and the config is complete.
 * Failures bubble up to the post-order side-effect runner, which logs them
 * and never flips a successful checkout into a failure.
 */

import { isKeyCrmSyncEnabled, readKeyCrmConfig } from './config';
import { createKeyCrmOrder, type KeyCrmClientOptions } from './client';
import { buildKeyCrmOrder } from './order-payload';
import type { KeyCrmOrderInput } from './types';

export async function syncKeyCrmOrder(
  input: KeyCrmOrderInput,
  options: KeyCrmClientOptions & { env?: NodeJS.ProcessEnv } = {},
): Promise<'sent' | 'disabled'> {
  const env = options.env ?? process.env;
  if (!isKeyCrmSyncEnabled(env)) return 'disabled';

  const config = readKeyCrmConfig(env);
  if (!config.sourceId || !config.deliveryServiceId) return 'disabled';

  const payload = buildKeyCrmOrder(input, {
    sourceId: config.sourceId,
    deliveryServiceId: config.deliveryServiceId,
    contactMethodFieldUuid: config.contactMethodFieldUuid,
  });
  await createKeyCrmOrder(payload, options);
  return 'sent';
}
