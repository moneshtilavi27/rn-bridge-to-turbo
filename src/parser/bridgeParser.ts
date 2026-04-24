import fs from "fs-extra";
import path from "path";

// ─── Java AST types (java-parser CST) ────────────────────────────────────────

type JToken = {
  tokenType: { name: string };
  image: string;
  startOffset: number;
};

type JNode = {
  name: string;
  children: Record<string, (JNode | JToken)[]>;
};

// ─── Public types ─────────────────────────────────────────────────────────────

export type ParsedMethod = {
  name: string;
  params: { name: string; type: string }[];
  hasPromiseParam: boolean;
  promiseResolvedType: string | null;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseBridgeFile(filePath: string): ParsedMethod[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".java") {
    const astResult = parseJavaWithAst(content);
    if (astResult !== null) {
      return unifyPromiseReturnTypes(dedupeMethods(astResult));
    }
    return unifyPromiseReturnTypes(dedupeMethods(parseJavaWithRegex(content)));
  }

  return unifyPromiseReturnTypes(dedupeMethods(parseKotlinWithRegex(content)));
}

export function parseModuleName(filePath: string): string | null {
  const content = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".java") {
    return parseModuleNameFromAst(content) ?? parseModuleNameWithRegex(content);
  }

  return parseModuleNameWithRegex(content);
}

// ─── AST helpers ──────────────────────────────────────────────────────────────

function isToken(el: JNode | JToken): el is JToken {
  return "image" in el;
}

function isCstNode(el: JNode | JToken): el is JNode {
  return "children" in el;
}

function collectTokens(el: JNode | JToken): JToken[] {
  if (isToken(el)) return [el];
  return Object.values(el.children)
    .flat()
    .flatMap(collectTokens)
    .sort((a, b) => a.startOffset - b.startOffset);
}

function findAllNodes(el: JNode | JToken, targetName: string): JNode[] {
  if (isToken(el)) return [];
  const found: JNode[] = [];
  if (el.name === targetName) found.push(el);
  for (const children of Object.values(el.children)) {
    for (const child of children) {
      found.push(...findAllNodes(child, targetName));
    }
  }
  return found;
}

function childNodes(node: JNode, key: string): JNode[] {
  return (node.children[key] ?? []).filter(isCstNode);
}

function childTokens(node: JNode, key: string): JToken[] {
  return (node.children[key] ?? []).filter(isToken);
}

function typeNodeToString(node: JNode): string {
  return collectTokens(node).map(t => t.image).join("");
}

// ─── AST parsing (Java) ───────────────────────────────────────────────────────

function parseJavaWithAst(content: string): ParsedMethod[] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parse } = require("java-parser") as { parse: (code: string) => JNode };
    const cst = parse(content);
    const methodNodes = findAllNodes(cst, "methodDeclaration");
    const results: ParsedMethod[] = [];

    for (const methodNode of methodNodes) {
      if (!astHasReactMethodAnnotation(methodNode)) continue;

      const name = astExtractMethodName(methodNode);
      if (!name) continue;

      const { params, hasPromiseParam, promiseParamName } = astExtractParams(methodNode);
      const methodStartIndex = collectTokens(methodNode)[0]?.startOffset ?? 0;

      const promiseResolvedType = hasPromiseParam
        ? inferPromiseResolvedType(content, methodStartIndex, promiseParamName, name)
        : null;

      results.push({ name, params, hasPromiseParam, promiseResolvedType });
    }

    return results;
  } catch {
    return null;
  }
}

function astHasReactMethodAnnotation(methodNode: JNode): boolean {
  const modifiers = childNodes(methodNode, "methodModifier");
  return modifiers.some(mod => {
    return findAllNodes(mod, "annotation").some(ann => {
      return childNodes(ann, "typeName").some(tn =>
        childTokens(tn, "Identifier").some(t => t.image === "ReactMethod")
      );
    });
  });
}

function astExtractMethodName(methodNode: JNode): string | null {
  const headers = childNodes(methodNode, "methodHeader");
  if (!headers.length) return null;
  const declarators = childNodes(headers[0], "methodDeclarator");
  if (!declarators.length) return null;
  return childTokens(declarators[0], "Identifier")[0]?.image ?? null;
}

function astExtractParams(methodNode: JNode): {
  params: { name: string; type: string }[];
  hasPromiseParam: boolean;
  promiseParamName: string | null;
} {
  const params: { name: string; type: string }[] = [];
  let hasPromiseParam = false;
  let promiseParamName: string | null = null;

  const headers = childNodes(methodNode, "methodHeader");
  if (!headers.length) return { params, hasPromiseParam, promiseParamName };

  const declarators = childNodes(headers[0], "methodDeclarator");
  if (!declarators.length) return { params, hasPromiseParam, promiseParamName };

  const formalParamLists = childNodes(declarators[0], "formalParameterList");
  if (!formalParamLists.length) return { params, hasPromiseParam, promiseParamName };

  for (const paramNode of findAllNodes(formalParamLists[0], "formalParameter")) {
    const result = astExtractSingleParam(paramNode, false);
    if (!result) continue;

    if (result.rawType === "Promise") {
      hasPromiseParam = true;
      promiseParamName = result.name;
      continue;
    }

    params.push({ name: result.name, type: mapJavaTypeToTs(result.rawType) });
  }

  for (const paramNode of findAllNodes(formalParamLists[0], "variableArityParameter")) {
    const result = astExtractSingleParam(paramNode, true);
    if (!result) continue;
    params.push({ name: result.name, type: mapJavaTypeToTs(result.rawType) });
  }

  return { params, hasPromiseParam, promiseParamName };
}

function astExtractSingleParam(
  paramNode: JNode,
  isVarArity: boolean
): { rawType: string; name: string } | null {
  // formalParameter wraps content under variableParaRegularParameter
  const regular = childNodes(paramNode, "variableParaRegularParameter");
  const innerNode = regular.length > 0 ? regular[0] : paramNode;

  const unannTypes = childNodes(innerNode, "unannType");
  if (!unannTypes.length) return null;

  let rawType = typeNodeToString(unannTypes[0]);
  if (isVarArity) rawType += "[]";

  let nameToken: JToken | undefined;
  if (isVarArity) {
    // variableArityParameter has Identifier directly at its own level
    nameToken = childTokens(paramNode, "Identifier")[0];
  } else {
    const varDeclIds = childNodes(innerNode, "variableDeclaratorId");
    if (!varDeclIds.length) return null;
    nameToken = childTokens(varDeclIds[0], "Identifier")[0];
  }

  if (!nameToken) return null;
  return { rawType, name: nameToken.image };
}

function parseModuleNameFromAst(content: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parse } = require("java-parser") as { parse: (code: string) => JNode };
    const cst = parse(content);

    for (const methodNode of findAllNodes(cst, "methodDeclaration")) {
      if (astExtractMethodName(methodNode) !== "getName") continue;

      for (const ret of findAllNodes(methodNode, "returnStatement")) {
        const strToken = collectTokens(ret).find(
          t => t.tokenType.name === "StringLiteral" && t.image.startsWith('"')
        );
        if (strToken) return strToken.image.slice(1, -1);
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Regex parsing (Java fallback) ───────────────────────────────────────────

function parseJavaWithRegex(content: string): ParsedMethod[] {
  const results: ParsedMethod[] = [];
  const regex =
    /@ReactMethod(?:\s*@\w+(?:\([^)]*\))?\s*)*\s*public\s+(?:final\s+)?void\s+(\w+)\s*\(([\s\S]*?)\)\s*(?:\{|throws\b)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    results.push(...buildMethodFromRegexMatch(content, match));
  }

  return results;
}

// ─── Regex parsing (Kotlin) ───────────────────────────────────────────────────

function parseKotlinWithRegex(content: string): ParsedMethod[] {
  const results: ParsedMethod[] = [];
  const regexes = [
    /@ReactMethod(?:\s*@\w+(?:\([^)]*\))?\s*)*\s*(?:public\s+)?(?:override\s+)?fun\s+(\w+)\s*\(([\s\S]*?)\)\s*(?::\s*[\w.<>?]+)?\s*\{/g,
    /@ReactMethod(?:\s*@\w+(?:\([^)]*\))?\s*)*\s*(?:public\s+)?(?:override\s+)?fun\s+(\w+)\s*\(([\s\S]*?)\)\s*(?::\s*[\w.<>?]+)?\s*=/g
  ];

  for (const regex of regexes) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      results.push(...buildMethodFromRegexMatch(content, match));
    }
  }

  return results;
}

function buildMethodFromRegexMatch(content: string, match: RegExpExecArray): ParsedMethod[] {
  const methodName = match[1];
  const rawParams = match[2].trim();
  const hasPromiseParam = /\bPromise\b/.test(rawParams);
  const promiseParamName = hasPromiseParam ? extractPromiseParamName(rawParams) : null;
  const promiseResolvedType = hasPromiseParam
    ? inferPromiseResolvedType(content, match.index, promiseParamName, methodName)
    : null;

  const params = rawParams
    ? splitParameters(rawParams)
        .map(p => p.trim())
        .map(parseParameter)
        .filter((p): p is { name: string; type: string } => p !== null)
    : [];

  return [{ name: methodName, params, hasPromiseParam, promiseResolvedType }];
}

// ─── Regex module name ────────────────────────────────────────────────────────

function parseModuleNameWithRegex(content: string): string | null {
  const regexes = [
    /public\s+String\s+getName\s*\(\s*\)\s*\{[\s\S]*?return\s+["']([^"']+)["']\s*;/m,
    /override\s+fun\s+getName\s*\(\s*\)\s*:\s*String\s*=\s*["']([^"']+)["']/m,
    /override\s+fun\s+getName\s*\(\s*\)\s*:\s*String\s*\{[\s\S]*?return\s+["']([^"']+)["']\s*$/m
  ];

  for (const regex of regexes) {
    const match = content.match(regex);
    if (match?.[1]) return match[1];
  }

  return null;
}

// ─── Parameter helpers ────────────────────────────────────────────────────────

function parseParameter(rawParam: string): { name: string; type: string } | null {
  const cleaned = rawParam.replace(/@\w+\s+/g, "").replace(/\s+/g, " ").trim();
  const kotlinMatch = cleaned.match(/^(\w+)\s*:\s*(.+)$/);
  const javaMatch = cleaned.match(/^(.*)\s+(\w+)$/);

  const rawType = kotlinMatch?.[2].trim() ?? javaMatch?.[1].trim() ?? null;
  const name = kotlinMatch?.[1] ?? javaMatch?.[2] ?? null;

  const javaType = rawType?.replace(/\.\.\.$/, "[]") ?? null;

  if (!javaType || !name) return null;
  if (javaType === "Promise") return null;

  return { name, type: mapJavaTypeToTs(javaType) };
}

// ─── Type mapping ─────────────────────────────────────────────────────────────

export function mapJavaTypeToTs(javaType: string): string {
  const normalized = javaType
    .replace(/\bfinal\b/g, "")
    .replace(/\s+/g, "")
    .replace(/\?$/, "")
    .replace(/^java\.lang\./, "")
    .replace(/^java\.util\./, "")
    .replace(/^com\.facebook\.react\.bridge\./, "");

  const kotlinArrayMatch = normalized.match(/^Array<(.+)>$/);
  if (kotlinArrayMatch) {
    return `ReadonlyArray<${mapJavaTypeToTs(kotlinArrayMatch[1])}>`;
  }

  if (normalized.endsWith("[]")) {
    const inner = normalized.slice(0, -2);
    return `ReadonlyArray<${mapJavaTypeToTs(inner)}>`;
  }

  const listMatch = normalized.match(/^(List|MutableList|ArrayList|ReadableArray|WritableArray)<(.+)>$/);
  if (listMatch) {
    return `ReadonlyArray<${mapJavaTypeToTs(listMatch[2])}>`;
  }

  const mapMatch = normalized.match(/^(Map|MutableMap|HashMap|ReadableMap|WritableMap)<(.+)>$/);
  if (mapMatch) {
    return "UnsafeObject";
  }

  switch (normalized) {
    case "String":
    case "CharSequence":
      return "string";
    case "Boolean":
    case "boolean":
    case "Boolean?":
    case "Boolean.Companion":
    case "Bool":
      return "boolean";
    case "Int":
    case "int":
    case "Integer":
      return "Int32";
    case "Long":
    case "long":
      return "unknown";
    case "Double":
    case "double":
      return "Double";
    case "Float":
    case "float":
      return "Float";
    case "ReadableMap":
    case "WritableMap":
    case "Map":
    case "MutableMap":
    case "HashMap":
    case "JSONObject":
    case "ReadableNativeMap":
      return "UnsafeObject";
    case "Array":
    case "List":
    case "MutableList":
    case "ReadableArray":
    case "WritableArray":
    case "ReadableNativeArray":
      return "ReadonlyArray<unknown>";
    case "Callback":
      return "(...args: ReadonlyArray<unknown>) => void";
    case "Dynamic":
    case "Object":
      return "UnsafeObject";
    default:
      return "unknown";
  }
}

// ─── Split parameters ─────────────────────────────────────────────────────────

function splitParameters(rawParams: string): string[] {
  const params: string[] = [];
  let current = "";
  let genericDepth = 0;

  for (const char of rawParams) {
    if (char === "<") {
      genericDepth++;
    } else if (char === ">" && genericDepth > 0) {
      genericDepth--;
    }

    if (char === "," && genericDepth === 0) {
      params.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    params.push(current);
  }

  return params;
}

// ─── Deduplication ───────────────────────────────────────────────────────────

function dedupeMethods(methods: ParsedMethod[]): ParsedMethod[] {
  const bySignature = new Map<string, ParsedMethod>();

  for (const method of methods) {
    const signature = `${method.name}(${method.params.map((param) => `${param.name}:${param.type}`).join(",")})|${method.hasPromiseParam}`;
    const existing = bySignature.get(signature);

    if (!existing) {
      bySignature.set(signature, method);
      continue;
    }

    if (existing.promiseResolvedType === "unknown" && method.promiseResolvedType && method.promiseResolvedType !== "unknown") {
      bySignature.set(signature, method);
    }
  }

  return [...bySignature.values()];
}

function unifyPromiseReturnTypes(methods: ParsedMethod[]): ParsedMethod[] {
  // Group methods by name to unify Promise return types across overloads
  const byName = new Map<string, ParsedMethod[]>();

  for (const method of methods) {
    if (!byName.has(method.name)) {
      byName.set(method.name, []);
    }
    byName.get(method.name)!.push(method);
  }

  // For each group, find the most specific Promise type (non-"unknown") and apply to all
  const results: ParsedMethod[] = [];

  for (const methodGroup of byName.values()) {
    // Find the most specific type (first non-"unknown" type)
    const mostSpecificType = methodGroup
      .filter(m => m.hasPromiseParam && m.promiseResolvedType && m.promiseResolvedType !== "unknown")
      .map(m => m.promiseResolvedType)
      .shift() ?? null;

    // Apply to all methods in this group that have Promise params
    for (const method of methodGroup) {
      if (method.hasPromiseParam && mostSpecificType) {
        results.push({
          ...method,
          promiseResolvedType: mostSpecificType,
        });
      } else {
        results.push(method);
      }
    }
  }

  return results;
}

// ─── Promise inference ────────────────────────────────────────────────────────

function extractPromiseParamName(rawParams: string): string | null {
  const params = splitParameters(rawParams);

  for (const param of params) {
    const cleaned = param.replace(/@\w+(?:\([^)]*\))?\s*/g, "").trim();
    const kotlinMatch = cleaned.match(/^(\w+)\s*:\s*Promise\b/);
    if (kotlinMatch?.[1]) {
      return kotlinMatch[1];
    }

    const javaMatch = cleaned.match(/\bPromise\s+(\w+)$/);
    if (javaMatch?.[1]) {
      return javaMatch[1];
    }
  }

  return null;
}

function inferPromiseResolvedType(
  content: string,
  methodStartIndex: number,
  promiseParamName: string | null,
  methodName: string
): string {
  const scanWindow = content.slice(methodStartIndex, Math.min(content.length, methodStartIndex + 2500));

  if (promiseParamName) {
    const escapedName = escapeRegExp(promiseParamName);
    const resolveRegex = new RegExp(`${escapedName}\\s*\\.\\s*resolve\\s*\\(([^)]*)\\)`, "m");
    const resolveMatch = scanWindow.match(resolveRegex);
    const resolvedFromUsage = resolveMatch ? inferTypeFromResolveArg(resolveMatch[1].trim()) : null;

    if (resolvedFromUsage) {
      return resolvedFromUsage;
    }
  }

  const resolvedFromPattern = inferTypeFromMethodName(methodName);
  if (resolvedFromPattern) {
    return resolvedFromPattern;
  }

  return "unknown";
}

function inferTypeFromResolveArg(arg: string): string | null {
  if (!arg) {
    return null;
  }

  if (/^["'`].*["'`]$/.test(arg)) {
    return "string";
  }

  if (/^(true|false)$/.test(arg)) {
    return "boolean";
  }

  if (/^-?\d+$/.test(arg)) {
    return "Int32";
  }

  if (/^-?\d+\.\d+([fFdD])?$/.test(arg)) {
    return /[fF]$/.test(arg) ? "Float" : "Double";
  }

  if (/(createMap\(|WritableMap|ReadableMap|HashMap|JSONObject|Map<|mutableMapOf\()/i.test(arg)) {
    return "UnsafeObject";
  }

  if (/(createArray\(|WritableArray|ReadableArray|ArrayList|List<|listOf\()/i.test(arg)) {
    return "ReadonlyArray<unknown>";
  }

  if (/^null$/.test(arg)) {
    return "unknown";
  }

  return null;
}

function inferTypeFromMethodName(methodName: string): string | null {
  if (/^(is|has|can)[A-Z_]/.test(methodName)) {
    return "boolean";
  }

  if (/^(get|fetch|load|find).*(Count|Size|Length|Total|Index|Id)$/i.test(methodName)) {
    return "Int32";
  }

  if (/^(get|fetch|load).*(Name|Title|Label|Text|Message)$/i.test(methodName)) {
    return "string";
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}