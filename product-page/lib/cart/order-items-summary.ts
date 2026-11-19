export interface NotificationOrderItem {
  title: string;
  quantity: number;
  lineTotal: number;
  fixationLabel: string;
  /** "Без логотипа" or the chosen car logo brand; shown as its own line. */
  brandName?: string;
  configuration?: string[];
}

/** Pure formatter for `{{items_summary}}` — includes human-readable fixation. */
export function formatOrderItemsSummary(items: NotificationOrderItem[]): string {
  return items
    .map((item) => {
      const head = `• ${item.title} × ${item.quantity} — ${item.lineTotal} ₴`;
      const fixation = item.fixationLabel?.trim();
      return [head, ...(item.configuration ?? []).map(value => `  ${value}`), ...(fixation ? [`  Фіксація: ${fixation}`] : [])].join('\n');
    })
    .join('\n');
}
