import type { ParsedToken, DTCGShadowValue } from '../types/dtcg';
import { parseShadow, isShadowValue } from '../parsers/shadow';

interface CreateEffectsResult {
  created: number;
  warnings: string[];
}

export async function createEffectStyles(
  shadowTokens: ParsedToken[],
  onProgress?: (current: number, total: number) => void
): Promise<CreateEffectsResult> {
  const warnings: string[] = [];
  let created = 0;
  const createdNames = new Set<string>();

  for (let i = 0; i < shadowTokens.length; i++) {
    const token = shadowTokens[i];
    onProgress?.(i + 1, shadowTokens.length);

    if (createdNames.has(token.name)) {
      warnings.push(`Duplicate shadow skipped: ${token.name}`);
      continue;
    }

    if (!isShadowValue(token.value)) {
      warnings.push(`Invalid shadow value for: ${token.name}`);
      continue;
    }

    try {
      const shadowEffect = parseShadow(token.value as DTCGShadowValue);
      const effectStyle = figma.createEffectStyle();
      effectStyle.name = token.name;
      effectStyle.effects = [shadowEffect as DropShadowEffect];
      createdNames.add(token.name);
      created++;
    } catch (error) {
      warnings.push(`Failed to create shadow ${token.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { created, warnings };
}
