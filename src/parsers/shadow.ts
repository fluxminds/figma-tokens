import type { DTCGShadowValue } from '../types/dtcg';
import { parseColor, isValidHexColor } from './color';
import { parseDimension } from './dimension';

export interface FigmaDropShadow {
  type: 'DROP_SHADOW';
  color: { r: number; g: number; b: number; a: number };
  offset: { x: number; y: number };
  radius: number;
  spread: number;
  visible: boolean;
  blendMode: 'NORMAL';
}

export function parseShadow(value: DTCGShadowValue): FigmaDropShadow | null {
  // Validate color before parsing
  if (!value.color || !isValidHexColor(value.color)) {
    return null;
  }

  const color = parseColor(value.color);

  // Validate parsed color values
  if (isNaN(color.r) || isNaN(color.g) || isNaN(color.b) || isNaN(color.a)) {
    return null;
  }

  const offsetX = parseDimension(value.offsetX);
  const offsetY = parseDimension(value.offsetY);
  const blur = parseDimension(value.blur);
  const spread = parseDimension(value.spread);

  // Validate dimensions
  if (isNaN(offsetX) || isNaN(offsetY) || isNaN(blur) || isNaN(spread)) {
    return null;
  }

  return {
    type: 'DROP_SHADOW',
    color: { r: color.r, g: color.g, b: color.b, a: color.a },
    offset: { x: offsetX, y: offsetY },
    radius: blur,
    spread: spread,
    visible: true,
    blendMode: 'NORMAL',
  };
}

export function isShadowValue(value: unknown): value is DTCGShadowValue {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return 'offsetX' in obj && 'offsetY' in obj && 'blur' in obj && 'color' in obj;
}

export function isValidShadowValue(value: DTCGShadowValue): boolean {
  // Check that color is a valid hex color
  if (!value.color || !isValidHexColor(value.color)) {
    return false;
  }
  return true;
}
