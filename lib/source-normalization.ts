const sourceAliases = new Map([
  ['instagram', 'Instagram'],
  ['insta', 'Instagram'],
  ['ig', 'Instagram'],
  ['инстаграм', 'Instagram'],
  ['инста', 'Instagram'],
  ['telegram', 'Telegram'],
  ['tg', 'Telegram'],
  ['телеграм', 'Telegram'],
  ['телега', 'Telegram'],
  ['tiktok', 'TikTok'],
  ['тик ток', 'TikTok'],
  ['тикток', 'TikTok']
]);

export function sourceKey(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, ' ');
}

export function normalizeSourceName(value: string) {
  const key = sourceKey(value);
  if (!key) return '';
  return sourceAliases.get(key) ?? value.trim().replace(/\s+/g, ' ');
}
