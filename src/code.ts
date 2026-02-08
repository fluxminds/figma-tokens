import type { DTCGRoot, ImportMessage, ExportMessage, ProgressMessage, CompleteMessage, ExportCompleteMessage, ErrorMessage, ImportSummary, ConflictAction, ConflictMessage, ConflictResponseMessage } from './types/dtcg';
import { traverseTokens, separateShadowTokens } from './utils/token-traversal';
import { createCollections, getUsedCategories, createVariables, createEffectStyles, type ConflictResolver } from './creators';
import { exportToJSON } from './exporters';

let pendingConflictResolve: ((action: ConflictAction) => void) | null = null;

figma.showUI(__html__, {
  width: 480,
  height: 560,
  themeColors: true,
  title: 'DTCG Design Token Manager',
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

function sendExportComplete(json: string, variables: number, effectStyles: number): void {
  figma.ui.postMessage({
    type: 'export-complete',
    json,
    summary: { variables, effectStyles },
  } as ExportCompleteMessage);
}

function sendConflict(name: string, itemType: 'variable' | 'effect'): void {
  figma.ui.postMessage({ type: 'conflict', name, itemType } as ConflictMessage);
}

const conflictResolver: ConflictResolver = (name, itemType) => {
  return new Promise((resolve) => {
    pendingConflictResolve = resolve;
    sendConflict(name, itemType);
  });
};

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
    (current, total) => sendProgress(`Creating variables... (${current}/${total})`, current, total),
    conflictResolver
  );
  warnings.push(...variableResult.warnings);

  let effectsCreated = 0;
  let effectsUpdated = 0;
  let effectsSkipped = 0;
  if (shadowTokens.length > 0) {
    const effectResult = await createEffectStyles(
      shadowTokens,
      (current, total) => sendProgress(`Creating effect styles... (${current}/${total})`, current, total),
      conflictResolver
    );
    effectsCreated = effectResult.created;
    effectsUpdated = effectResult.updated;
    effectsSkipped = effectResult.skipped;
    warnings.push(...effectResult.warnings);
  }

  sendComplete({
    collections: collections.size,
    variables: variableResult.created,
    variablesUpdated: variableResult.updated,
    variablesSkipped: variableResult.skipped,
    effectStyles: effectsCreated,
    effectStylesUpdated: effectsUpdated,
    effectStylesSkipped: effectsSkipped,
    warnings,
  });
}

async function exportTokens(): Promise<void> {
  sendProgress('Exporting tokens...', 0, 1);

  const result = await exportToJSON((stage) => sendProgress(stage, 0, 1));
  const jsonString = JSON.stringify(result.json, null, 2);

  sendExportComplete(jsonString, result.variableCount, result.effectCount);
}

figma.ui.onmessage = async (msg: ImportMessage | ExportMessage | ConflictResponseMessage) => {
  if (msg.type === 'import') {
    try {
      await importTokens(msg.json);
    } catch (e) {
      sendError(`Import failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  } else if (msg.type === 'export') {
    try {
      await exportTokens();
    } catch (e) {
      sendError(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  } else if (msg.type === 'conflict-response') {
    if (pendingConflictResolve) {
      pendingConflictResolve(msg.action);
      pendingConflictResolve = null;
    }
  }
};
