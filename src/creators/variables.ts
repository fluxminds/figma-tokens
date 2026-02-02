import type { ParsedToken, TokenCategory, ConflictAction } from '../types/dtcg';
import type { CollectionInfo } from './collections';
import { parseColor } from '../parsers/color';
import { parseDimension, parseDuration } from '../parsers/dimension';

interface CreateVariableResult {
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
}

export type ConflictResolver = (name: string, itemType: 'variable' | 'effect') => Promise<ConflictAction>;

async function findExistingVariable(
  name: string,
  collection: VariableCollection
): Promise<Variable | null> {
  for (const varId of collection.variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(varId);
    if (variable && variable.name === name) {
      return variable;
    }
  }
  return null;
}

function getVariableType(tokenType: string): VariableResolvedDataType {
  switch (tokenType) {
    case 'color': return 'COLOR';
    case 'fontFamily': return 'STRING';
    default: return 'FLOAT';
  }
}

function convertValue(token: ParsedToken): VariableValue | null {
  const { type, value } = token;

  switch (type) {
    case 'color':
      if (typeof value === 'string') {
        const { r, g, b, a } = parseColor(value);
        return { r, g, b, a };
      }
      return null;

    case 'fontFamily':
      if (Array.isArray(value)) return value[0];
      if (typeof value === 'string') return value;
      return null;

    case 'fontWeight':
    case 'number':
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseFloat(value) || 0;
      return null;

    case 'dimension':
      if (typeof value === 'string' || typeof value === 'number') return parseDimension(value);
      return null;

    case 'duration':
      if (typeof value === 'string' || typeof value === 'number') return parseDuration(value);
      return null;

    default:
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const num = parseFloat(value);
        return isNaN(num) ? value : num;
      }
      return null;
  }
}

export async function createVariables(
  tokens: ParsedToken[],
  collections: Map<TokenCategory, CollectionInfo>,
  onProgress?: (current: number, total: number) => void,
  onConflict?: ConflictResolver
): Promise<CreateVariableResult> {
  const warnings: string[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const processedNames = new Set<string>();
  let overrideAll = false;
  let ignoreAll = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    onProgress?.(i + 1, tokens.length);

    const collectionInfo = collections.get(token.category);
    if (!collectionInfo) {
      warnings.push(`No collection for category: ${token.category}`);
      continue;
    }

    const fullName = `${token.category}/${token.name}`;
    if (processedNames.has(fullName)) {
      warnings.push(`Duplicate token skipped: ${token.name}`);
      continue;
    }

    try {
      const variableType = getVariableType(token.type);
      const value = convertValue(token);

      if (value === null) {
        warnings.push(`Could not convert value for: ${token.name}`);
        continue;
      }

      const existingVariable = await findExistingVariable(token.name, collectionInfo.collection);

      if (existingVariable) {
        let shouldOverride = overrideAll;

        if (!overrideAll && !ignoreAll && onConflict) {
          const action = await onConflict(token.name, 'variable');
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
          processedNames.add(fullName);
          continue;
        }

        existingVariable.setValueForMode(collectionInfo.modeId, value);
        processedNames.add(fullName);
        updated++;
      } else {
        const variable = figma.variables.createVariable(token.name, collectionInfo.collection, variableType);
        variable.setValueForMode(collectionInfo.modeId, value);
        processedNames.add(fullName);
        created++;
      }
    } catch (error) {
      warnings.push(`Failed to create ${token.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { created, updated, skipped, warnings };
}
