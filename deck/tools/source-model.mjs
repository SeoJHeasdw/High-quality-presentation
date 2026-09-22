/** 읽기 전용 제작 모델. TS 문법으로 화면 객체를 읽고, 정본의 순수 함수만 재사용한다. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import { chapterEntries } from "./chapters.mjs";

export const DECK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const cache = new Map();

export function sourceFile(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function literal(node, constants, visiting = new Set()) {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) {
    return literal(node.expression, constants, visiting);
  }
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    return -literal(node.operand, constants, visiting);
  }
  if (ts.isIdentifier(node) && constants.has(node.text) && !visiting.has(node.text)) {
    return literal(constants.get(node.text), constants, new Set([...visiting, node.text]));
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((n) => literal(n, constants, visiting));
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map((p) => [
      p.name.text, literal(p.initializer, constants, visiting),
    ]));
  }
  return undefined;
}

export function readSlideFile(file) {
  const ast = sourceFile(file);
  const constants = new Map();
  for (const stmt of ast.statements) {
    if (ts.isVariableStatement(stmt)) for (const d of stmt.declarationList.declarations) {
      if (ts.isIdentifier(d.name)) constants.set(d.name.text, d.initializer);
    }
  }
  const slides = [];
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const props = new Map(node.properties.filter(ts.isPropertyAssignment).map((p) => [p.name.text, p.initializer]));
      if (props.has("id") && props.has("layout")) {
        const spec = literal(node, constants);
        if (typeof spec.id !== "string" || typeof spec.layout !== "string") {
          throw new Error(`${file}: id/layout은 정적으로 읽을 수 있어야 합니다.`);
        }
        const pos = node.getStart(ast);
        const before = ast.text.slice(0, pos);
        const markers = [...before.matchAll(/^\s*\/\/ ── (L[\d.]+\s*·\s*.+?)\s*──+\s*$/gm)];
        slides.push({ ...spec, file, line: ast.getLineAndCharacterOfPosition(pos).line + 1,
          lesson: markers.at(-1)?.[1] ?? null });
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return slides;
}

export function readCourse(root = DECK_ROOT) {
  let n = 0;
  return chapterEntries(root).flatMap((entry) => (entry.parts.length ? entry.parts : [entry.index])
    .flatMap(readSlideFile).map((s) => ({ ...s, chapter: entry.key, n: ++n })));
}

/** 프로젝트의 함수 정본을 읽는다. 허용한 선언만 로드하고 React/브라우저는 실행하지 않는다. */
export function declarations(file, names) {
  const ast = sourceFile(file);
  const pieces = [];
  for (const stmt of ast.statements) {
    if (ts.isFunctionDeclaration(stmt) && names.includes(stmt.name?.text)) pieces.push(stmt.getText(ast));
    if (ts.isVariableStatement(stmt)) for (const d of stmt.declarationList.declarations) {
      if (names.includes(d.name.getText(ast))) pieces.push(`const ${d.getText(ast)};`);
    }
  }
  const js = ts.transpileModule(pieces.join("\n"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  return vm.runInNewContext(`${js}\n;({${names.join(",")}})`, { exports: {} }, { timeout: 1000 });
}

export function runtimeRules(root = DECK_ROOT) {
  const files = [path.join(root, "src/production/CourseDeck.tsx"), path.join(root, "src/production/course-types.ts")];
  const stamp = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  if (cache.get(root)?.stamp === stamp) return cache.get(root).rules;
  const group = declarations(files[0], ["SOLO_SCENES", "SOLO_FAMILIES", "sceneGroup"]);
  const { slideSteps } = declarations(files[1], ["slideSteps"]);
  const rules = { sceneGroup: group.sceneGroup, slideSteps };
  cache.set(root, { stamp, rules });
  return rules;
}

/** 순수 vendor World만 JSX 객체로 평가한다. DOM·CSS·카메라의 시각 판정은 별도다. */
export function vendorModule(file) {
  const source = fs.readFileSync(file, "utf8");
  if (cache.get(file)?.source === source) return cache.get(file).exports;
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: (id) => {
    if (id.startsWith(".") && id.endsWith(".css")) return {};
    // World inspection creates React elements without mounting them. This shared
    // helper is safe to load; its browser measurements run only when mounted.
    if (["./CourseFlow", "./VendorEvidence", "./FilmNarrative"].includes(id)) return vendorModule(path.join(path.dirname(file), `${id.slice(2)}.tsx`));
    if (!["react", "react/jsx-runtime"].includes(id)) throw new Error(`분석할 수 없는 렌더러 의존성: ${id}`);
    return require(id);
  } }, { timeout: 1000, filename: file });
  cache.set(file, { source, exports });
  return exports;
}
