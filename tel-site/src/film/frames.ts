/*
 * 스크롤로 훑는 영상의 프레임 저장소.
 * 프레임은 불러오는 순서(16칸마다 → 8 → 4 → 2 → 1)대로 묶음 다섯 개(pass0~4.bin)에 이어 붙여 두었다
 * (tools/pack-film.py). 묶음을 차례로 스트리밍하면서 한 장 분량이 도착할 때마다 바로 꺼내 쓴다.
 * 첫 묶음(44장)만 오면 페이지를 열 수 있다.
 * 압축된 프레임(Blob)은 모두 들고 있고, 화면에 그릴 프레임만 ImageBitmap으로 풀어 몇 장만 캐시한다.
 * 풀린 1920 프레임 한 장이 8 MB라 전부 풀어 두면 브라우저가 버티지 못한다.
 */
export type Progress = { loaded: number; total: number; firstPass: boolean };

type Pack = { file: string; bytes: number; frames: [number, number, number][] };
type Index = { frames: number; type: string; packs: Pack[] };

const CACHE = 26;
const AHEAD = 8;          // 진행 방향으로 미리 풀어 두는 프레임 수
const DECODING_MAX = 4;   // 동시에 푸는 수(너무 많으면 디코더가 밀린다)

export class FrameStore {
  readonly total: number;
  private blobs: (Blob | null)[];
  private cache = new Map<number, ImageBitmap>();
  private decoding = new Set<number>();
  private loaded = 0;
  private firstPassSize = Infinity;
  private disposed = false;
  private ctrl = new AbortController();
  onDecoded: (() => void) | null = null;

  /** base: 묶음과 index.json이 있는 폴더(예: /film/1920/). */
  constructor(total: number, private base: string) {
    this.total = total;
    this.blobs = new Array(total).fill(null);
  }

  /** 예전 낱장 방식의 우선순위 조정. 묶음은 정해진 순서로 받으므로 할 일이 없다. */
  prioritize(_center: number) {}

  async load(onProgress: (p: Progress) => void) {
    const res = await fetch(this.base + "index.json", { signal: this.ctrl.signal });
    // 없는 파일에 index.html을 돌려주는 서버가 있다: JSON이 아니면 영상 대신 정지 이미지로.
    if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) throw new Error("film index " + res.status);
    const index = (await res.json()) as Index;
    this.firstPassSize = index.packs[0].frames.length;
    for (const pack of index.packs) {
      if (this.disposed) return;
      await this.loadPack(pack, index.type, onProgress);
    }
  }

  private async loadPack(pack: Pack, type: string, onProgress: (p: Progress) => void) {
    const res = await fetch(this.base + pack.file, { signal: this.ctrl.signal });
    if (!res.ok || (res.headers.get("content-type") || "").includes("html")) throw new Error("film pack " + res.status);
    const buf = new Uint8Array(pack.bytes);
    let got = 0, next = 0;
    const emit = () => {
      while (next < pack.frames.length) {
        const [i, off, len] = pack.frames[next];
        if (off + len > got) break;
        this.blobs[i] = new Blob([buf.subarray(off, off + len)], { type });
        next++; this.loaded++;
        onProgress({ loaded: this.loaded, total: this.total, firstPass: this.loaded >= this.firstPassSize });
      }
    };
    const reader = res.body?.getReader();
    if (!reader) { buf.set(new Uint8Array(await res.arrayBuffer())); got = pack.bytes; emit(); return; }
    for (;;) {
      const { done, value } = await reader.read();
      if (done || this.disposed) break;
      buf.set(value, got); got += value.length;
      emit();
    }
    got = pack.bytes; emit();
  }

  get firstPassTotal() { return this.firstPassSize; }

  private nearestBlob(i: number) {
    for (let d = 0; d < this.total; d++) {
      if (i - d >= 0 && this.blobs[i - d]) return i - d;
      if (i + d < this.total && this.blobs[i + d]) return i + d;
    }
    return -1;
  }

  private decode(i: number, urgent = false) {
    const blob = this.blobs[i];
    if (!blob || this.cache.has(i) || this.decoding.has(i)) return;
    if (!urgent && this.decoding.size >= DECODING_MAX) return;
    this.decoding.add(i);
    createImageBitmap(blob).then((bmp) => {
      this.decoding.delete(i);
      if (this.disposed) { bmp.close(); return; }
      this.cache.set(i, bmp);
      while (this.cache.size > CACHE) {
        const oldest = this.cache.keys().next().value as number;
        this.cache.get(oldest)?.close();
        this.cache.delete(oldest);
      }
      this.onDecoded?.();
    }).catch(() => this.decoding.delete(i));
  }

  /**
   * 프레임 i를 그릴 비트맵. 아직 풀리지 않았으면 가장 가까운 풀린 프레임을 대신 돌려주고,
   * 진행 방향(dir)으로 몇 장을 미리 풀어 둔다.
   */
  get(i: number, dir: number): { bmp: ImageBitmap; index: number } | null {
    i = Math.max(0, Math.min(this.total - 1, Math.round(i)));
    const exact = this.cache.get(i);
    if (exact) {
      this.cache.delete(i); this.cache.set(i, exact);   // 최근 사용
    } else {
      const src = this.blobs[i] ? i : this.nearestBlob(i);
      if (src >= 0) this.decode(src, true);
    }
    const ahead = dir >= 0 ? 1 : -1;
    for (let k = 1; k <= AHEAD; k++) {
      const j = i + ahead * k;
      if (j >= 0 && j < this.total && this.blobs[j]) this.decode(j);
    }
    for (let k = 1; k <= 2; k++) {
      const j = i - ahead * k;
      if (j >= 0 && j < this.total && this.blobs[j]) this.decode(j);
    }
    if (exact) return { bmp: exact, index: i };
    let best: { bmp: ImageBitmap; index: number } | null = null;
    for (const [k, bmp] of this.cache) if (!best || Math.abs(k - i) < Math.abs(best.index - i)) best = { bmp, index: k };
    return best;
  }

  dispose() {
    this.disposed = true;
    this.ctrl.abort();
    this.cache.forEach((b) => b.close());
    this.cache.clear();
  }
}
