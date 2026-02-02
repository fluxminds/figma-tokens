import type { TokenCategory, ParsedToken } from '../types/dtcg';

export interface CollectionInfo {
  collection: VariableCollection;
  modeId: string;
}

const COLLECTION_ORDER: TokenCategory[] = ['Colors', 'Typography', 'Spacing', 'Border', 'Effects', 'Layout'];

export async function createCollections(
  categories: Set<TokenCategory>,
  onProgress?: (message: string) => void
): Promise<Map<TokenCategory, CollectionInfo>> {
  const collections = new Map<TokenCategory, CollectionInfo>();

  for (const category of COLLECTION_ORDER) {
    if (!categories.has(category)) continue;
    onProgress?.(`Creating collection: ${category}`);

    const collection = figma.variables.createVariableCollection(category);
    const modeId = collection.modes[0].modeId;
    collection.renameMode(modeId, 'Default');
    collections.set(category, { collection, modeId });
  }

  return collections;
}

export function getUsedCategories(tokens: ParsedToken[]): Set<TokenCategory> {
  const categories = new Set<TokenCategory>();
  for (const token of tokens) {
    categories.add(token.category);
  }
  return categories;
}
