export interface FigmaRGB {
  r: number;
  g: number;
  b: number;
}

export interface FigmaRGBA extends FigmaRGB {
  a: number;
}

export function parseColor(hex: string): FigmaRGBA {
  let color = hex.replace('#', '');

  if (color.length === 3 || color.length === 4) {
    color = color.split('').map(c => c + c).join('');
  }

  const r = parseInt(color.slice(0, 2), 16) / 255;
  const g = parseInt(color.slice(2, 4), 16) / 255;
  const b = parseInt(color.slice(4, 6), 16) / 255;
  const a = color.length === 8 ? parseInt(color.slice(6, 8), 16) / 255 : 1;

  return { r, g, b, a };
}

export function isValidHexColor(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value);
}
