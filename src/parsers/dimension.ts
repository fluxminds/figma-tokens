export function parseDimension(value: string | number): number {
  if (typeof value === 'number') return value;

  const trimmed = value.trim().toLowerCase();

  if (trimmed.endsWith('px')) return parseFloat(trimmed);
  if (trimmed.endsWith('rem')) return parseFloat(trimmed) * 16;
  if (trimmed.endsWith('em')) return parseFloat(trimmed) * 16;
  if (trimmed.endsWith('ms')) return parseFloat(trimmed);
  if (trimmed.endsWith('s') && !trimmed.endsWith('ms')) return parseFloat(trimmed) * 1000;

  const parsed = parseFloat(trimmed);
  return isNaN(parsed) ? 0 : parsed;
}

export function parseDuration(value: string | number): number {
  if (typeof value === 'number') return value;

  const trimmed = value.trim().toLowerCase();

  if (trimmed.endsWith('ms')) return parseFloat(trimmed);
  if (trimmed.endsWith('s')) return parseFloat(trimmed) * 1000;

  return parseFloat(trimmed) || 0;
}
