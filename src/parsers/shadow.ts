import type { DTCGShadowValue } from '../types/dtcg';
import { parseColor } from './color';
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

export function parseShadow(value: DTCGShadowValue): FigmaDropShadow {
  const color = parseColor(value.color);
  return {
    type: 'DROP_SHADOW',
    color: { r: color.r, g: color.g, b: color.b, a: color.a },
    offset: { x: parseDimension(value.offsetX), y: parseDimension(value.offsetY) },
    radius: parseDimension(value.blur),
    spread: parseDimension(value.spread),
    visible: true,
    blendMode: 'NORMAL',
  };
}

export function isShadowValue(value: unknown): value is DTCGShadowValue {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return 'offsetX' in obj && 'offsetY' in obj && 'blur' in obj && 'color' in obj;
}
