import type { DTCGRoot, DTCGToken, DTCGShadowValue, TokenCategory } from '../types/dtcg';

export interface ExportResult {
  json: DTCGRoot;
  variableCount: number;
  effectCount: number;
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return a < 1 ? hex + toHex(a) : hex;
}

function getTypeFromCategory(category: TokenCategory): string {
  switch (category) {
    case 'Colors': return 'color';
    case 'Typography': return 'dimension';
    case 'Spacing': return 'dimension';
    case 'Border': return 'dimension';
    case 'Effects': return 'number';
    case 'Layout': return 'dimension';
    default: return 'number';
  }
}

function getCategoryFromCollectionName(name: string): TokenCategory {
  const normalized = name.toLowerCase();
  if (normalized.includes('color')) return 'Colors';
  if (normalized.includes('typography') || normalized.includes('font')) return 'Typography';
  if (normalized.includes('spacing')) return 'Spacing';
  if (normalized.includes('border')) return 'Border';
  if (normalized.includes('effect') || normalized.includes('shadow')) return 'Effects';
  if (normalized.includes('layout') || normalized.includes('breakpoint')) return 'Layout';
  return 'Effects';
}

function setNestedValue(obj: Record<string, unknown>, path: string[], token: DTCGToken): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = token;
}

function variableValueToDTCG(
  value: VariableValue,
  resolvedType: VariableResolvedDataType
): string | number {
  if (typeof value === 'number') {
    if (resolvedType === 'FLOAT') {
      return value;
    }
    return `${value}px`;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
    const rgba = value as RGBA;
    return rgbaToHex(rgba.r, rgba.g, rgba.b, rgba.a ?? 1);
  }

  return String(value);
}

function effectToDTCGShadow(effect: DropShadowEffect): DTCGShadowValue {
  return {
    offsetX: `${effect.offset.x}px`,
    offsetY: `${effect.offset.y}px`,
    blur: `${effect.radius}px`,
    spread: `${effect.spread ?? 0}px`,
    color: rgbaToHex(effect.color.r, effect.color.g, effect.color.b, effect.color.a),
  };
}

export async function exportToJSON(
  onProgress?: (stage: string) => void
): Promise<ExportResult> {
  const root: DTCGRoot = {};
  let variableCount = 0;
  let effectCount = 0;

  onProgress?.('Reading variable collections...');
  const collections = await figma.variables.getLocalVariableCollectionsAsync();

  for (const collection of collections) {
    onProgress?.(`Processing collection: ${collection.name}`);
    const category = getCategoryFromCollectionName(collection.name);
    const defaultMode = collection.modes[0];

    for (const variableId of collection.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (!variable) continue;

      const value = variable.valuesByMode[defaultMode.modeId];
      if (value === undefined) continue;

      // Skip alias references for now (they reference other variables)
      if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
        continue;
      }

      const path = variable.name.split('/');
      const dtcgValue = variableValueToDTCG(value, variable.resolvedType);
      const dtcgType = variable.resolvedType === 'COLOR' ? 'color' : getTypeFromCategory(category);

      const token: DTCGToken = {
        $value: dtcgValue,
        $type: dtcgType,
      };

      if (variable.description) {
        token.$description = variable.description;
      }

      setNestedValue(root as Record<string, unknown>, path, token);
      variableCount++;
    }
  }

  onProgress?.('Reading effect styles...');
  const effectStyles = await figma.getLocalEffectStylesAsync();

  for (const style of effectStyles) {
    const dropShadows = style.effects.filter(
      (e): e is DropShadowEffect => e.type === 'DROP_SHADOW' && e.visible
    );

    if (dropShadows.length === 0) continue;

    const path = style.name.split('/');

    // Use first shadow or create array for multiple shadows
    const shadowValue = dropShadows.length === 1
      ? effectToDTCGShadow(dropShadows[0])
      : dropShadows.map(effectToDTCGShadow);

    const token: DTCGToken = {
      $value: shadowValue as DTCGShadowValue,
      $type: 'shadow',
    };

    if (style.description) {
      token.$description = style.description;
    }

    setNestedValue(root as Record<string, unknown>, path, token);
    effectCount++;
  }

  return { json: root, variableCount, effectCount };
}
