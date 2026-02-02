import type { DTCGRoot, ImportMessage, ProgressMessage, CompleteMessage, ErrorMessage, ImportSummary } from './types/dtcg';
import { traverseTokens, separateShadowTokens } from './utils/token-traversal';
import { createCollections, getUsedCategories, createVariables, createEffectStyles } from './creators';

figma.showUI(__html__, {
  width: 480,
  height: 560,
  themeColors: true,
  title: 'DTCG Token Importer',
});

function sendProgress(stage: string, current: number, total: number): void {
  figma.ui.postMessage({ type: 'progress', stage, current, total } as ProgressMessage);
}

function sendComplete(summary: ImportSummary): void {
  figma.ui.postMessage({ type: 'complete', summary } as CompleteMessage);
}

function sendError(message: string): void {
  figma.ui.postMessage({ type: 'error', message } as ErrorMessage);
}

async function importTokens(jsonString: string): Promise<void> {
  const warnings: string[] = [];

  sendProgress('Parsing JSON...', 0, 1);
  let root: DTCGRoot;
  try {
    root = JSON.parse(jsonString);
  } catch (e) {
    sendError(`Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`);
    return;
  }

  sendProgress('Analyzing tokens...', 0, 1);
  const allTokens = traverseTokens(root);

  if (allTokens.length === 0) {
    sendError('No valid tokens found');
    return;
  }

  const { variables: variableTokens, shadows: shadowTokens } = separateShadowTokens(allTokens);

  sendProgress('Creating collections...', 0, 1);
  const usedCategories = getUsedCategories(variableTokens);
  const collections = await createCollections(usedCategories, (msg) => sendProgress(msg, 0, 1));

  const variableResult = await createVariables(
    variableTokens,
    collections,
    (current, total) => sendProgress(`Creating variables... (${current}/${total})`, current, total)
  );
  warnings.push(...variableResult.warnings);

  let effectsCreated = 0;
  if (shadowTokens.length > 0) {
    const effectResult = await createEffectStyles(
      shadowTokens,
      (current, total) => sendProgress(`Creating effect styles... (${current}/${total})`, current, total)
    );
    effectsCreated = effectResult.created;
    warnings.push(...effectResult.warnings);
  }

  sendComplete({
    collections: collections.size,
    variables: variableResult.created,
    effectStyles: effectsCreated,
    warnings,
  });
}

figma.ui.onmessage = async (msg: ImportMessage) => {
  if (msg.type === 'import') {
    try {
      await importTokens(msg.json);
    } catch (e) {
      sendError(`Import failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }
};
