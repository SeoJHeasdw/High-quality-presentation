import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import "./annotation.css";

const WIDTH = 1920;
const HEIGHT = 1080;
const COLORS = [
  { name: "빨강", value: "#ff4057" },
  { name: "검정", value: "#111111" },
  { name: "파랑", value: "#3176ff" },
  { name: "초록", value: "#25c765" },
  { name: "노랑", value: "#ffe347" },
] as const;
const WIDTHS = [3, 6, 12, 22] as const;

type Tool = "pen" | "eraser" | "rectangle";
type Point = { x: number; y: number };
type Stroke = { pointerId: number; tool: Tool; start: Point; last: Point };

/** 장표 단위로만 살아 있는 비트맵. 스텝 전환과 W 토글에는 리마운트하지 않는다. */
export default function AnnotationLayer({ active, slideIndex }: { active: boolean; slideIndex: number }) {
  const inkRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const dirtyRef = useRef(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [width, setWidth] = useState<number>(WIDTHS[1]);

  useLayoutEffect(() => {
    // CSS가 스테이지 전체를 축소하므로 내부 좌표는 항상 1920×1080이다.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    for (const canvas of [inkRef.current, previewRef.current]) {
      if (!canvas) continue;
      canvas.width = WIDTH * ratio;
      canvas.height = HEIGHT * ratio;
      canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
  }, []);

  useLayoutEffect(() => {
    strokeRef.current = null;
    dirtyRef.current = false;
    inkRef.current?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT);
    previewRef.current?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT);
  }, [slideIndex]);

  useLayoutEffect(() => {
    if (!active) {
      strokeRef.current = null;
      previewRef.current?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT);
    }
  }, [active]);

  // 로컬 서버가 내려가도 열린 탭의 JS는 계속 실행된다. 그림을 서버 상태보다
  // 오래 남기지 않도록, 잉크가 있을 때만 같은 출처의 응답을 확인한다.
  useEffect(() => {
    if (!window.location.protocol.startsWith("http")) return;
    let disposed = false;
    const checkServer = async () => {
      if (!dirtyRef.current) return;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2000);
      try {
        const response = await fetch(window.location.pathname, {
          method: "HEAD",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok && !disposed) clear();
      } catch {
        if (!disposed) clear();
      } finally {
        window.clearTimeout(timeout);
      }
    };
    const interval = window.setInterval(checkServer, 3000);
    return () => { disposed = true; window.clearInterval(interval); };
  }, []);

  const point = (e: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(WIDTH, (e.clientX - rect.left) * WIDTH / rect.width)),
      y: Math.max(0, Math.min(HEIGHT, (e.clientY - rect.top) * HEIGHT / rect.height)),
    };
  };

  const drawLine = (from: Point, to: Point, selected: Tool) => {
    const ctx = inkRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = selected === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = selected === "eraser" ? width * 5 : width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (from.x === to.x && from.y === to.y) {
      ctx.beginPath();
      ctx.arc(to.x, to.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.restore();
    dirtyRef.current = true;
  };

  const drawRectangle = (ctx: CanvasRenderingContext2D, start: Point, end: Point) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    ctx.restore();
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!active || e.button !== 0 || strokeRef.current) return;
    e.preventDefault();
    const start = point(e);
    strokeRef.current = { pointerId: e.pointerId, tool, start, last: start };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool !== "rectangle") drawLine(start, start, tool);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const stroke = strokeRef.current;
    if (!active || !stroke || stroke.pointerId !== e.pointerId) return;
    const next = point(e);
    if (stroke.tool === "rectangle") {
      const ctx = previewRef.current?.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        drawRectangle(ctx, stroke.start, next);
      }
    } else {
      drawLine(stroke.last, next, stroke.tool);
    }
    stroke.last = next;
  };

  const finish = (e: ReactPointerEvent<HTMLCanvasElement>, cancel = false) => {
    const stroke = strokeRef.current;
    if (!stroke || stroke.pointerId !== e.pointerId) return;
    if (!cancel && active) {
      const end = point(e);
      if (stroke.tool === "rectangle") {
        const ctx = inkRef.current?.getContext("2d");
        if (ctx) {
          drawRectangle(ctx, stroke.start, end);
          dirtyRef.current = true;
        }
      } else {
        drawLine(stroke.last, end, stroke.tool);
      }
    }
    previewRef.current?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT);
    strokeRef.current = null;
  };

  const clear = () => {
    strokeRef.current = null;
    dirtyRef.current = false;
    inkRef.current?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT);
    previewRef.current?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT);
  };

  return (
    <div className="annotation" data-active={active}>
      <canvas
        ref={inkRef}
        className="annotation__canvas"
        aria-label="발표 화면에 그림 그리기"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e)}
        onPointerCancel={(e) => finish(e, true)}
        onContextMenu={(e) => active && e.preventDefault()}
      />
      <canvas ref={previewRef} className="annotation__preview" aria-hidden="true" />

      {active && (
        <div className="annotation__toolbar" role="toolbar" aria-label="발표 드로잉 도구">
          <span className="annotation__mode">드로잉 <kbd>W</kbd> 종료</span>
          <span className="annotation__divider" />
          <div className="annotation__group" aria-label="도구">
            <button type="button" className="annotation__tool" data-selected={tool === "pen"} aria-pressed={tool === "pen"} onClick={() => setTool("pen")}>펜</button>
            <button type="button" className="annotation__tool" data-selected={tool === "rectangle"} aria-pressed={tool === "rectangle"} onClick={() => setTool("rectangle")}>□ 네모</button>
            <button type="button" className="annotation__tool" data-selected={tool === "eraser"} aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}>지우개</button>
          </div>
          <span className="annotation__divider" />
          <div className="annotation__group" aria-label="펜 색상">
            {COLORS.map((item) => (
              <button
                key={item.value}
                type="button"
                className="annotation__color"
                data-selected={color === item.value && tool !== "eraser"}
                aria-label={`${item.name} 펜`}
                aria-pressed={color === item.value && tool !== "eraser"}
                title={item.name}
                style={{ "--annotation-color": item.value } as React.CSSProperties}
                onClick={() => { setColor(item.value); if (tool === "eraser") setTool("pen"); }}
              />
            ))}
          </div>
          <span className="annotation__divider" />
          <div className="annotation__group" aria-label="펜 두께">
            {WIDTHS.map((value) => (
              <button key={value} type="button" className="annotation__size" data-selected={width === value} aria-label={`두께 ${value}`} aria-pressed={width === value} onClick={() => setWidth(value)}>
                <i style={{ width: Math.min(value, 18), height: Math.min(value, 18) }} />
              </button>
            ))}
          </div>
          <span className="annotation__divider" />
          <button type="button" className="annotation__clear" onClick={clear}>전체 삭제</button>
        </div>
      )}
    </div>
  );
}
