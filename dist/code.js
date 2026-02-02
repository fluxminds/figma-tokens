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
  async function createCollections(categories, onProgress) {
    const collections = /* @__PURE__ */ new Map();
    for (const category of COLLECTION_ORDER) {
      if (!categories.has(category))
        continue;
      onProgress == null ? void 0 : onProgress(`Creating collection: ${category}`);
      const collection = figma.variables.createVariableCollection(category);
      const modeId = collection.modes[0].modeId;
      collection.renameMode(modeId, "Default");
      collections.set(category, { collection, modeId });
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
  async function createVariables(tokens, collections, onProgress) {
    const warnings = [];
    let created = 0;
    const createdNames = /* @__PURE__ */ new Set();
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      onProgress == null ? void 0 : onProgress(i + 1, tokens.length);
      const collectionInfo = collections.get(token.category);
      if (!collectionInfo) {
        warnings.push(`No collection for category: ${token.category}`);
        continue;
      }
      const fullName = `${token.category}/${token.name}`;
      if (createdNames.has(fullName)) {
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
        const variable = figma.variables.createVariable(token.name, collectionInfo.collection, variableType);
        variable.setValueForMode(collectionInfo.modeId, value);
        createdNames.add(fullName);
        created++;
      } catch (error) {
        warnings.push(`Failed to create ${token.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { created, warnings };
  }

  // src/parsers/shadow.ts
  function parseShadow(value) {
    const color = parseColor(value.color);
    return {
      type: "DROP_SHADOW",
      color: { r: color.r, g: color.g, b: color.b, a: color.a },
      offset: { x: parseDimension(value.offsetX), y: parseDimension(value.offsetY) },
      radius: parseDimension(value.blur),
      spread: parseDimension(value.spread),
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

  // src/creators/effects.ts
  async function createEffectStyles(shadowTokens, onProgress) {
    const warnings = [];
    let created = 0;
    const createdNames = /* @__PURE__ */ new Set();
    for (let i = 0; i < shadowTokens.length; i++) {
      const token = shadowTokens[i];
      onProgress == null ? void 0 : onProgress(i + 1, shadowTokens.length);
      if (createdNames.has(token.name)) {
        warnings.push(`Duplicate shadow skipped: ${token.name}`);
        continue;
      }
      if (!isShadowValue(token.value)) {
        warnings.push(`Invalid shadow value for: ${token.name}`);
        continue;
      }
      try {
        const shadowEffect = parseShadow(token.value);
        const effectStyle = figma.createEffectStyle();
        effectStyle.name = token.name;
        effectStyle.effects = [shadowEffect];
        createdNames.add(token.name);
        created++;
      } catch (error) {
        warnings.push(`Failed to create shadow ${token.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { created, warnings };
  }

  // src/code.ts
  figma.showUI(__html__, {
    width: 480,
    height: 560,
    themeColors: true,
    title: "DTCG Token Importer"
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
      warnings
    });
  }
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "import") {
      try {
        await importTokens(msg.json);
      } catch (e) {
        sendError(`Import failed: ${e instanceof Error ? e.message : "Unknown error"}`);
      }
    }
  };
})();
