/** 구도 근사 모델. DOM 유지·카메라·초점과 주된 판 교체를 별도로 센다. */
import path from "node:path";
import { DECK_ROOT, declarations, runtimeRules, vendorModule } from "./source-model.mjs";

const VENDORS = { anthropic: ["Anthropic", "AnthropicWorld"], ibm: ["Ibm", "IbmWorld"], meta: ["Meta", "MetaWorld"] };

export function filmFor(spec, root = DECK_ROOT) {
  if (spec.layout !== "vendor-film") return null;
  const vendor = spec.id.split("-")[0];
  if (vendor === "openai") {
    const file = path.join(root, "src/production/VendorArchitectureFilm.tsx");
    const m = declarations(file, ["OPENAI_BEATS", "OPENAI_SLIDES"]);
    return { file, beats: m.OPENAI_BEATS[spec.id], slides: m.OPENAI_SLIDES };
  }
  if (!VENDORS[vendor]) throw new Error(`${spec.id}: 알 수 없는 vendor-film`);
  const [name, world] = VENDORS[vendor];
  const file = path.join(root, `src/production/Vendor${name}Film.tsx`);
  const m = vendorModule(file);
  return { file, beats: m.BEATS[spec.id], slides: m.SLIDES, world: m[world] };
}

export function compositionAt(spec, step, root = DECK_ROOT) {
  const film = filmFor(spec, root);
  if (film) {
    const beat = film.beats?.[step];
    if (!beat) throw new Error(`${spec.id}:${step}: 필름 BEATS에 없는 스텝`);
    if (film.world) {
      const tree = film.world({ beat });
      const mode = tree.props["data-mode"];
      if (!mode) throw new Error(`${spec.id}: 필름의 구도 분기를 찾지 못했습니다.`);
      // World 바로 아래의 독립 판만 센다. 하위 카드의 data-current/초점은 제외.
      const surfaces = [tree.props.children].flat(Infinity).filter((child) =>
        child?.props?.["data-on"] === true && typeof child.props.className === "string"
        && child.props.className !== "anthropic-film__rule")
        .map((child) => child.props.className).sort();
      return { key: `film:${spec.id.split("-")[0]}:${mode}:${surfaces.join("+")}`,
        basis: "renderer", beat, evidence: film.file };
    }
    // OpenAI의 공간은 대부분 같은 월드다. 평가판의 교체만 별도 구도로 취급한다.
    // 카메라 이동이나 소유권 강조만으로 새 구도를 발명하지 않는다.
    return { key: `film:openai:${beat.startsWith("eval-") ? "evaluation" : "world"}`,
      basis: "inferred", beat, evidence: film.file };
  }
  const image = spec.left?.image ?? spec.right?.image
    ?? (spec.metric?.startsWith("/") ? spec.metric : null)
    ?? (spec.subtitle?.startsWith("/") ? spec.subtitle : null);
  if (spec.video) return { key: `video:${spec.video}`, basis: "inferred" };
  if (image) {
    // shotFrames는 실제 크롭의 교체다. 띠/카메라는 동일 원본에서 초점만 이동한다.
    const frame = spec.shotFrames?.[step];
    return { key: `image:${image}${spec.shotFrames ? `:${JSON.stringify(frame ?? null)}` : ""}`, basis: "inferred" };
  }
  const group = runtimeRules(root).sceneGroup(spec);
  return { key: group ?? `slide:${spec.id}`, basis: "inferred" };
}
