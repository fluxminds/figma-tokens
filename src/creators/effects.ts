import type { ParsedToken, DTCGShadowValue, ConflictAction } from '../types/dtcg';
import { parseShadow, isShadowValue, isValidShadowValue } from '../parsers/shadow';

interface CreateEffectsResult {
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
}

export type ConflictResolver = (name: string, itemType: 'variable' | 'effect') => Promise<ConflictAction>;

async function findExistingEffectStyle(name: string): Promise<EffectStyle | null> {
  const effectStyles = await figma.getLocalEffectStylesAsync();
  return effectStyles.find(style => style.name === name) || null;
}

export async function createEffectStyles(
  shadowTokens: ParsedToken[],
  onProgress?: (current: number, total: number) => void,
  onConflict?: ConflictResolver
): Promise<CreateEffectsResult> {
  const warnings: string[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const processedNames = new Set<string>();
  let overrideAll = false;
  let ignoreAll = false;

  for (let i = 0; i < shadowTokens.length; i++) {
    const token = shadowTokens[i];
    onProgress?.(i + 1, shadowTokens.length);

    if (processedNames.has(token.name)) {
      warnings.push(`Duplicate shadow skipped: ${token.name}`);
      continue;
    }

    if (!isShadowValue(token.value)) {
      warnings.push(`Invalid shadow format for: ${token.name} (not a shadow object)`);
      continue;
    }

    const shadowValue = token.value as DTCGShadowValue;

    if (!isValidShadowValue(shadowValue)) {
      warnings.push(`Skipped invalid shadow: ${token.name} (invalid color or values)`);
      processedNames.add(token.name);
      continue;
    }

    try {
      const shadowEffect = parseShadow(shadowValue);

      if (!shadowEffect) {
        warnings.push(`Could not parse shadow: ${token.name}`);
        processedNames.add(token.name);
        continue;
      }

      const existingStyle = await findExistingEffectStyle(token.name);

      if (existingStyle) {
        let shouldOverride = overrideAll;

        if (!overrideAll && !ignoreAll && onConflict) {
          const action = await onConflict(token.name, 'effect');
          if (action === 'override-all') {
            overrideAll = true;
            shouldOverride = true;
          } else if (action === 'ignore-all') {
            ignoreAll = true;
          } else if (action === 'override') {
            shouldOverride = true;
          }
        }

        if (ignoreAll || (!shouldOverride && !overrideAll)) {
          skipped++;
          processedNames.add(token.name);
          continue;
        }

        existingStyle.effects = [shadowEffect as DropShadowEffect];
        processedNames.add(token.name);
        updated++;
      } else {
        const effectStyle = figma.createEffectStyle();
        effectStyle.name = token.name;
        effectStyle.effects = [shadowEffect as DropShadowEffect];
        processedNames.add(token.name);
        created++;
      }
    } catch (error) {
      warnings.push(`Failed to create shadow ${token.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { created, updated, skipped, warnings };
}
