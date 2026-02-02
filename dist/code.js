"use strict";
(() => {
  // src/utils/token-traversal.ts
  function isToken(obj) {
    return typeof obj === "object" && obj !== null && "$value" in obj;
  }
  function isGroup(obj) {
    return typeof obj === "object" && obj !== null && !("$value" in obj);
  }
  function getCategory(path, type) {
    const root = path[0];
    if (root === "color")
      return "Colors";
    if (["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"].includes(root))
      return "Typography";
    if (root === "spacing")
      return "Spacing";
    if (["borderRadius", "borderWidth"].includes(root))
      return "Border";
    if (["opacity", "duration", "shadow"].includes(root))
      return "Effects";
    if (root === "breakpoint")
      return "Layout";
    if (type === "color")
      return "Colors";
    if (type === "shadow")
      return "Effects";
    return "Effects";
  }
  function traverseTokens(root) {
    const tokens = [];
    function traverse(obj, path, inheritedType) {
      const currentType = obj.$type || inheritedType;
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith("$"))
          continue;
        if (isToken(value)) {
          const tokenType = value.$type || currentType;
          if (!tokenType)
            continue;
          const tokenPath = [...path, key];
          tokens.push({
            path: tokenPath,
            name: tokenPath.join("/"),
            type: tokenType,
            value: value.$value,
            category: getCategory(tokenPath, tokenType)
          });
        } else if (isGroup(value)) {
          traverse(value, [...path, key], currentType);
        }
      }
    }
    traverse(root, []);
    return tokens;
  }
  function separateShadowTokens(tokens) {
    const variables = [];
    const shadows = [];
    for (const token of tokens) {
      (token.type === "shadow" ? shadows : variables).push(token);
    }
    return { variables, shadows };
  }

  // src/creators/collections.ts
  var COLLECTION_ORDER = ["Colors", "Typography", "Spacing", "Border", "Effects", "Layout"];
  async function findExistingCollection(name) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    return collections.find((c) => c.name === name) || null;
  }
  async function createCollections(categories, onProgress) {
    const collections = /* @__PURE__ */ new Map();
    for (const category of COLLECTION_ORDER) {
      if (!categories.has(category))
        continue;
      const existingCollection = await findExistingCollection(category);
      if (existingCollection) {
        onProgress == null ? void 0 : onProgress(`Using existing collection: ${category}`);
        const modeId = existingCollection.modes[0].modeId;
        collections.set(category, { collection: existingCollection, modeId });
      } else {
        onProgress == null ? void 0 : onProgress(`Creating collection: ${category}`);
        const collection = figma.variables.createVariableCollection(category);
        const modeId = collection.modes[0].modeId;
        collection.renameMode(modeId, "Default");
        collections.set(category, { collection, modeId });
      }
    }
    return collections;
  }
  function getUsedCategories(tokens) {
    const categories = /* @__PURE__ */ new Set();
    for (const token of tokens) {
      categories.add(token.category);
    }
    return categories;
  }

  // src/parsers/color.ts
  function parseColor(hex) {
    let color = hex.replace("#", "");
    if (color.length === 3 || color.length === 4) {
      color = color.split("").map((c) => c + c).join("");
    }
    const r = parseInt(color.slice(0, 2), 16) / 255;
    const g = parseInt(color.slice(2, 4), 16) / 255;
    const b = parseInt(color.slice(4, 6), 16) / 255;
    const a = color.length === 8 ? parseInt(color.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  function isValidHexColor(value) {
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value);
  }

  // src/parsers/dimension.ts
  function parseDimension(value) {
    if (typeof value === "number")
      return value;
    const trimmed = value.trim().toLowerCase();
    if (trimmed.endsWith("px"))
      return parseFloat(trimmed);
    if (trimmed.endsWith("rem"))
      return parseFloat(trimmed) * 16;
    if (trimmed.endsWith("em"))
      return parseFloat(trimmed) * 16;
    if (trimmed.endsWith("ms"))
      return parseFloat(trimmed);
    if (trimmed.endsWith("s") && !trimmed.endsWith("ms"))
      return parseFloat(trimmed) * 1e3;
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? 0 : parsed;
  }
  function parseDuration(value) {
    if (typeof value === "number")
      return value;
    const trimmed = value.trim().toLowerCase();
    if (trimmed.endsWith("ms"))
      return parseFloat(trimmed);
    if (trimmed.endsWith("s"))
      return parseFloat(trimmed) * 1e3;
    return parseFloat(trimmed) || 0;
  }

  // src/creators/variables.ts
  async function findExistingVariable(name, collection) {
    for (const varId of collection.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (variable && variable.name === name) {
        return variable;
      }
    }
    return null;
  }
  function getVariableType(tokenType) {
    switch (tokenType) {
      case "color":
        return "COLOR";
      case "fontFamily":
        return "STRING";
      default:
        return "FLOAT";
    }
  }
  function convertValue(token) {
    const { type, value } = token;
    switch (type) {
      case "color":
        if (typeof value === "string") {
          const { r, g, b, a } = parseColor(value);
          return { r, g, b, a };
        }
        return null;
      case "fontFamily":
        if (Array.isArray(value))
          return value[0];
        if (typeof value === "string")
          return value;
        return null;
      case "fontWeight":
      case "number":
        if (typeof value === "number")
          return value;
        if (typeof value === "string")
          return parseFloat(value) || 0;
        return null;
      case "dimension":
        if (typeof value === "string" || typeof value === "number")
          return parseDimension(value);
        return null;
      case "duration":
        if (typeof value === "string" || typeof value === "number")
          return parseDuration(value);
        return null;
      default:
        if (typeof value === "number")
          return value;
        if (typeof value === "string") {
          const num = parseFloat(value);
          return isNaN(num) ? value : num;
        }
        return null;
    }
  }
  async function createVariables(tokens, collections, onProgress, onConflict) {
    const warnings = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const processedNames = /* @__PURE__ */ new Set();
    let overrideAll = false;
    let ignoreAll = false;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      onProgress == null ? void 0 : onProgress(i + 1, tokens.length);
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
            const action = await onConflict(token.name, "variable");
            if (action === "override-all") {
              overrideAll = true;
              shouldOverride = true;
            } else if (action === "ignore-all") {
              ignoreAll = true;
            } else if (action === "override") {
              shouldOverride = true;
            }
          }
          if (ignoreAll || !shouldOverride && !overrideAll) {
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

  // src/parsers/shadow.ts
  function parseShadow(value) {
    if (!value.color || !isValidHexColor(value.color)) {
      return null;
    }
    const color = parseColor(value.color);
    if (isNaN(color.r) || isNaN(color.g) || isNaN(color.b) || isNaN(color.a)) {
      return null;
    }
    const offsetX = parseDimension(value.offsetX);
    const offsetY = parseDimension(value.offsetY);
    const blur = parseDimension(value.blur);
    const spread = parseDimension(value.spread);
    if (isNaN(offsetX) || isNaN(offsetY) || isNaN(blur) || isNaN(spread)) {
      return null;
    }
    return {
      type: "DROP_SHADOW",
      color: { r: color.r, g: color.g, b: color.b, a: color.a },
      offset: { x: offsetX, y: offsetY },
      radius: blur,
      spread,
      visible: true,
      blendMode: "NORMAL"
    };
  }
  function isShadowValue(value) {
    if (typeof value !== "object" || value === null)
      return false;
    const obj = value;
    return "offsetX" in obj && "offsetY" in obj && "blur" in obj && "color" in obj;
  }
  function isValidShadowValue(value) {
    if (!value.color || !isValidHexColor(value.color)) {
      return false;
    }
    return true;
  }

  // src/creators/effects.ts
  async function findExistingEffectStyle(name) {
    const effectStyles = await figma.getLocalEffectStylesAsync();
    return effectStyles.find((style) => style.name === name) || null;
  }
  async function createEffectStyles(shadowTokens, onProgress, onConflict) {
    const warnings = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const processedNames = /* @__PURE__ */ new Set();
    let overrideAll = false;
    let ignoreAll = false;
    for (let i = 0; i < shadowTokens.length; i++) {
      const token = shadowTokens[i];
      onProgress == null ? void 0 : onProgress(i + 1, shadowTokens.length);
      if (processedNames.has(token.name)) {
        warnings.push(`Duplicate shadow skipped: ${token.name}`);
        continue;
      }
      if (!isShadowValue(token.value)) {
        warnings.push(`Invalid shadow format for: ${token.name} (not a shadow object)`);
        continue;
      }
      const shadowValue = token.value;
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
            const action = await onConflict(token.name, "effect");
            if (action === "override-all") {
              overrideAll = true;
              shouldOverride = true;
            } else if (action === "ignore-all") {
              ignoreAll = true;
            } else if (action === "override") {
              shouldOverride = true;
            }
          }
          if (ignoreAll || !shouldOverride && !overrideAll) {
            skipped++;
            processedNames.add(token.name);
            continue;
          }
          existingStyle.effects = [shadowEffect];
          processedNames.add(token.name);
          updated++;
        } else {
          const effectStyle = figma.createEffectStyle();
          effectStyle.name = token.name;
          effectStyle.effects = [shadowEffect];
          processedNames.add(token.name);
          created++;
        }
      } catch (error) {
        warnings.push(`Failed to create shadow ${token.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { created, updated, skipped, warnings };
  }

  // src/exporters/json.ts
  function rgbaToHex(r, g, b, a) {
    const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, "0");
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    return a < 1 ? hex + toHex(a) : hex;
  }
  function getTypeFromCategory(category) {
    switch (category) {
      case "Colors":
        return "color";
      case "Typography":
        return "dimension";
      case "Spacing":
        return "dimension";
      case "Border":
        return "dimension";
      case "Effects":
        return "number";
      case "Layout":
        return "dimension";
      default:
        return "number";
    }
  }
  function getCategoryFromCollectionName(name) {
    const normalized = name.toLowerCase();
    if (normalized.includes("color"))
      return "Colors";
    if (normalized.includes("typography") || normalized.includes("font"))
      return "Typography";
    if (normalized.includes("spacing"))
      return "Spacing";
    if (normalized.includes("border"))
      return "Border";
    if (normalized.includes("effect") || normalized.includes("shadow"))
      return "Effects";
    if (normalized.includes("layout") || normalized.includes("breakpoint"))
      return "Layout";
    return "Effects";
  }
  function setNestedValue(obj, path, token) {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    current[path[path.length - 1]] = token;
  }
  function variableValueToDTCG(value, resolvedType) {
    var _a;
    if (typeof value === "number") {
      if (resolvedType === "FLOAT") {
        return value;
      }
      return `${value}px`;
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }
    if (typeof value === "object" && "r" in value && "g" in value && "b" in value) {
      const rgba = value;
      return rgbaToHex(rgba.r, rgba.g, rgba.b, (_a = rgba.a) != null ? _a : 1);
    }
    return String(value);
  }
  function effectToDTCGShadow(effect) {
    var _a;
    return {
      offsetX: `${effect.offset.x}px`,
      offsetY: `${effect.offset.y}px`,
      blur: `${effect.radius}px`,
      spread: `${(_a = effect.spread) != null ? _a : 0}px`,
      color: rgbaToHex(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
    };
  }
  async function exportToJSON(onProgress) {
    const root = {};
    let variableCount = 0;
    let effectCount = 0;
    onProgress == null ? void 0 : onProgress("Reading variable collections...");
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    for (const collection of collections) {
      onProgress == null ? void 0 : onProgress(`Processing collection: ${collection.name}`);
      const category = getCategoryFromCollectionName(collection.name);
      const defaultMode = collection.modes[0];
      for (const variableId of collection.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable)
          continue;
        const value = variable.valuesByMode[defaultMode.modeId];
        if (value === void 0)
          continue;
        if (typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
          continue;
        }
        const path = variable.name.split("/");
        const dtcgValue = variableValueToDTCG(value, variable.resolvedType);
        const dtcgType = variable.resolvedType === "COLOR" ? "color" : getTypeFromCategory(category);
        const token = {
          $value: dtcgValue,
          $type: dtcgType
        };
        if (variable.description) {
          token.$description = variable.description;
        }
        setNestedValue(root, path, token);
        variableCount++;
      }
    }
    onProgress == null ? void 0 : onProgress("Reading effect styles...");
    const effectStyles = await figma.getLocalEffectStylesAsync();
    for (const style of effectStyles) {
      const dropShadows = style.effects.filter(
        (e) => e.type === "DROP_SHADOW" && e.visible
      );
      if (dropShadows.length === 0)
        continue;
      const path = style.name.split("/");
      const shadowValue = dropShadows.length === 1 ? effectToDTCGShadow(dropShadows[0]) : dropShadows.map(effectToDTCGShadow);
      const token = {
        $value: shadowValue,
        $type: "shadow"
      };
      if (style.description) {
        token.$description = style.description;
      }
      setNestedValue(root, path, token);
      effectCount++;
    }
    return { json: root, variableCount, effectCount };
  }

  // src/code.ts
  var pendingConflictResolve = null;
  figma.showUI(__html__, {
    width: 480,
    height: 560,
    themeColors: true,
    title: "DTCG Token Manager"
  });
  function sendProgress(stage, current, total) {
    figma.ui.postMessage({ type: "progress", stage, current, total });
  }
  function sendComplete(summary) {
    figma.ui.postMessage({ type: "complete", summary });
  }
  function sendError(message) {
    figma.ui.postMessage({ type: "error", message });
  }
  function sendExportComplete(json, variables, effectStyles) {
    figma.ui.postMessage({
      type: "export-complete",
      json,
      summary: { variables, effectStyles }
    });
  }
  function sendConflict(name, itemType) {
    figma.ui.postMessage({ type: "conflict", name, itemType });
  }
  var conflictResolver = (name, itemType) => {
    return new Promise((resolve) => {
      pendingConflictResolve = resolve;
      sendConflict(name, itemType);
    });
  };
  async function importTokens(jsonString) {
    const warnings = [];
    sendProgress("Parsing JSON...", 0, 1);
    let root;
    try {
      root = JSON.parse(jsonString);
    } catch (e) {
      sendError(`Invalid JSON: ${e instanceof Error ? e.message : "Parse error"}`);
      return;
    }
    sendProgress("Analyzing tokens...", 0, 1);
    const allTokens = traverseTokens(root);
    if (allTokens.length === 0) {
      sendError("No valid tokens found");
      return;
    }
    const { variables: variableTokens, shadows: shadowTokens } = separateShadowTokens(allTokens);
    sendProgress("Creating collections...", 0, 1);
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
      warnings
    });
  }
  async function exportTokens() {
    sendProgress("Exporting tokens...", 0, 1);
    const result = await exportToJSON((stage) => sendProgress(stage, 0, 1));
    const jsonString = JSON.stringify(result.json, null, 2);
    sendExportComplete(jsonString, result.variableCount, result.effectCount);
  }
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "import") {
      try {
        await importTokens(msg.json);
      } catch (e) {
        sendError(`Import failed: ${e instanceof Error ? e.message : "Unknown error"}`);
      }
    } else if (msg.type === "export") {
      try {
        await exportTokens();
      } catch (e) {
        sendError(`Export failed: ${e instanceof Error ? e.message : "Unknown error"}`);
      }
    } else if (msg.type === "conflict-response") {
      if (pendingConflictResolve) {
        pendingConflictResolve(msg.action);
        pendingConflictResolve = null;
      }
    }
  };
})();
