import type { DTCGRoot, DTCGGroup, DTCGToken, ParsedToken, TokenCategory } from '../types/dtcg';

function isToken(obj: unknown): obj is DTCGToken {
  return typeof obj === 'object' && obj !== null && '$value' in obj;
}

function isGroup(obj: unknown): obj is DTCGGroup {
  return typeof obj === 'object' && obj !== null && !('$value' in obj);
}

function getCategory(path: string[], type: string): TokenCategory {
  const root = path[0];
  if (root === 'color') return 'Colors';
  if (['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'].includes(root)) return 'Typography';
  if (root === 'spacing') return 'Spacing';
  if (['borderRadius', 'borderWidth'].includes(root)) return 'Border';
  if (['opacity', 'duration', 'shadow'].includes(root)) return 'Effects';
  if (root === 'breakpoint') return 'Layout';
  if (type === 'color') return 'Colors';
  if (type === 'shadow') return 'Effects';
  return 'Effects';
}

export function traverseTokens(root: DTCGRoot): ParsedToken[] {
  const tokens: ParsedToken[] = [];

  function traverse(obj: DTCGGroup, path: string[], inheritedType?: string): void {
    const currentType = obj.$type || inheritedType;

    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('$')) continue;

      if (isToken(value)) {
        const tokenType = value.$type || currentType;
        if (!tokenType) continue;

        const tokenPath = [...path, key];
        tokens.push({
          path: tokenPath,
          name: tokenPath.join('/'),
          type: tokenType,
          value: value.$value,
          category: getCategory(tokenPath, tokenType),
        });
      } else if (isGroup(value)) {
        traverse(value, [...path, key], currentType);
      }
    }
  }

  traverse(root, []);
  return tokens;
}

export function groupTokensByCategory(tokens: ParsedToken[]): Map<TokenCategory, ParsedToken[]> {
  const grouped = new Map<TokenCategory, ParsedToken[]>();
  for (const token of tokens) {
    const existing = grouped.get(token.category) || [];
    existing.push(token);
    grouped.set(token.category, existing);
  }
  return grouped;
}

export function separateShadowTokens(tokens: ParsedToken[]): { variables: ParsedToken[]; shadows: ParsedToken[] } {
  const variables: ParsedToken[] = [];
  const shadows: ParsedToken[] = [];
  for (const token of tokens) {
    (token.type === 'shadow' ? shadows : variables).push(token);
  }
  return { variables, shadows };
}
