export interface NotificationOrderItem {
  title: string;
  quantity: number;
  lineTotal: number;
  fixationLabel: string;
}

/** Pure formatter for `{{items_summary}}` — includes human-readable fixation. */
export function formatOrderItemsSummary(items: NotificationOrderItem[]): string {
  return items
    .map((item) => {
      const head = `• ${item.title} × ${item.quantity} — ${item.lineTotal} ₴`;
      const fixation = item.fixationLabel?.trim();
      return fixation ? `${head}\n  Фіксація: ${fixation}` : head;
    })
    .join('\n');
}
