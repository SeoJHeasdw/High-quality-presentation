/** 레이아웃의 실제 JSX 사용 위치에서 렌더러를 찾는다. 공유 파일은 영향 후보로 표시한다. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { DECK_ROOT, sourceFile, readCourse } from "./source-model.mjs";
import { filmFor } from "./visual-model.mjs";

function resolveImport(file, name) {
  for (const suffix of [".tsx", ".ts", ".mjs", ".js"]) {
    const candidate = path.resolve(path.dirname(file), name + suffix);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function rendererFiles(spec, root = DECK_ROOT) {
  const file = path.join(root, "src/production/CourseDeck.tsx"), ast = sourceFile(file);
  const imports = new Map();
  for (const stmt of ast.statements) if (ts.isImportDeclaration(stmt) && stmt.importClause?.name) {
    const target = resolveImport(file, stmt.moduleSpecifier.text);
    if (target) imports.set(stmt.importClause.name.text, target);
  }
  const files = new Set([file]);
  function jsx(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && imports.has(node.tagName.getText(ast))) files.add(imports.get(node.tagName.getText(ast)));
    ts.forEachChild(node, jsx);
  }
  function visit(node) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      && node.left.getText(ast).includes(`spec.layout === "${spec.layout}"`)) { jsx(node.right); return; }
    if (ts.isIfStatement(node) && node.expression.getText(ast) === `spec.layout === "${spec.layout}"`) jsx(node.thenStatement);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const film = filmFor(spec, root);
  if (film) files.add(film.file);
  return [...files];
}

// 스타일은 course.css 한 곳에 있지 않다. 챕터별로 쪼개져 있으므로 전부 읽는다.
// 한 번 읽어 두고 재사용한다 — where는 한 번에 여러 화면을 조회한다.
const sheetCache = new Map();
function styleSheets(root) {
  const hit = sheetCache.get(root);
  if (hit) return hit;
  const files = [];
  for (const dir of ["src/production", "src/styles"]) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full)) if (name.endsWith(".css")) files.push(path.join(full, name));
  }
  const sheets = files.sort().map((file) => ({ file, lines: fs.readFileSync(file, "utf8").split("\n") }));
  // 실제로 정의된 클래스 이름. 렌더러에서 긁어온 문자열 중 장면 이름 같은
  // 가짜를 걸러내는 데 쓴다. 가짜가 섞이면 진짜 클래스를 밀어낸다.
  const defined = new Set();
  for (const sheet of sheets) for (const line of sheet.lines) {
    if (!line.includes("{") || !line.includes(".")) continue;
    for (const m of line.split("{")[0].matchAll(/\.([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/g)) defined.add(m[1]);
  }
  const value = { sheets, defined };
  sheetCache.set(root, value);
  return value;
}

export function dependencyReport(spec, root = DECK_ROOT) {
  const files = rendererFiles(spec, root);
  const family = spec.scene?.split("-")[0];
  const { sheets, defined } = styleSheets(root);
  const classes = new Set();
  for (const file of files.filter((f) => f.endsWith(".tsx"))) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/[a-z][a-z0-9]*(?:-[a-z0-9]+)+/g)) {
      if (defined.has(m[0].split("__")[0])) classes.add(m[0]);
    }
  }
  // 장면 계열로 좁히고, 없으면 레이아웃으로 좁힌다. 둘 다 비면 그대로 둔다 —
  // 공용 클래스까지 끌어오면 모든 화면이 모든 파일을 가리켜 쓸모가 없어진다.
  const byFamily = [...classes].filter((name) => family && name.includes(family));
  const byLayout = [...classes].filter((name) => spec.layout && name.includes(spec.layout));
  const prefixes = [...new Set((byFamily.length ? byFamily : byLayout).map((name) => name.split("__")[0]))];
  const definitions = [];
  for (const sheet of sheets) {
    const relative = path.relative(root, sheet.file);
    for (const [i, line] of sheet.lines.entries()) {
      if (!line.includes("{") || !line.includes(".")) continue;
      if (prefixes.some((prefix) => line.includes(`.${prefix}`))) {
        definitions.push({ file: relative, line: i + 1, selector: line.split("{")[0].trim() });
      }
    }
  }
  const blocks = [];
  for (const d of definitions) {
    const last = blocks.at(-1);
    if (last && last.file === d.file && d.line - last.to < 40) { last.to = d.line; last.count++; }
    else blocks.push({ file: d.file, from: d.line, to: d.line, count: 1 });
  }
  const shared = readCourse(root).filter((s) => s.layout === spec.layout).map((s) => s.id);
  return { id: spec.id, files: files.map((f) => path.relative(root, f)),
    beatFile: filmFor(spec, root)?.file ? path.relative(root, filmFor(spec, root).file) : null,
    css: { files: sheets.map((sheet) => path.relative(root, sheet.file)), prefixes, blocks, definitions },
    sharedLayoutIds: shared, note: "레이아웃 공유 화면은 영향 후보입니다. CSS 광역 규칙·동적 클래스는 추가 확인합니다." };
}
