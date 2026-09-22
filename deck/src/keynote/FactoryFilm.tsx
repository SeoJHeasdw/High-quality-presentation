import { useLayoutEffect, useRef, useState } from "react";
import "./factory-film.css";

const SHOTS = [
  { file: "01-enter", label: "JAVIS Factory로 들어가는 장면" },
  { file: "02-voice", label: "대본이 목소리로 만들어지는 장면" },
  { file: "03-image", label: "이미지가 만들어지는 장면" },
  { file: "04-music", label: "음악이 만들어지는 장면" },
  { file: "05-reveal", label: "세 제작 도구를 함께 보는 장면" },
] as const;

export type FactoryFilmState = {
  phase: number;
  status: "loading" | "playing" | "held" | "paused" | "error";
  source: string;
  transition: "entry" | "forward" | "reverse" | "jump" | "still";
  settled: boolean;
  motion: "on" | "off";
};

type Props = {
  phase: number;
  className?: string;
  onStateChange?: (state: FactoryFilmState) => void;
};

const source = (phase: number) => `/factory-film/${SHOTS[phase].file}.mp4`;
const poster = (phase: number) => `/factory-film/${SHOTS[phase].file}.jpg`;

function release(video: HTMLVideoElement | null) {
  if (!video) return;
  video.pause();
  if (video.hasAttribute("src")) {
    video.removeAttribute("src");
    video.load();
  }
}

/** Each presenter cue owns one shot. Replaying the cue requires a remount (R). */
export default function FactoryFilm({ phase, className = "", onStateChange }: Props) {
  const selected = Math.max(0, Math.min(4, Math.trunc(phase) || 0));
  const root = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([null, null]);
  const posters = useRef<(HTMLImageElement | null)[]>([]);
  const visibleVideo = useRef<number | null>(null);
  const previousPhase = useRef<number | null>(null);
  const arrivedPhase = useRef<number | null>(null);
  const callback = useRef(onStateChange);
  callback.current = onStateChange;
  const [motionOff, setMotionOff] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [posterFailed, setPosterFailed] = useState(false);
  const [state, setState] = useState<FactoryFilmState>({
    phase: selected, source: source(selected), status: "loading", transition: "entry", settled: false,
    motion: motionOff ? "off" : "on",
  });

  useLayoutEffect(() => {
    const deck = root.current?.closest(".deck-keynote") ?? root.current?.closest("[data-motion]");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionOff(reduced.matches || deck?.getAttribute("data-motion") === "off");
    const observer = new MutationObserver(update);
    if (deck) observer.observe(deck, { attributes: true, attributeFilter: ["data-motion"] });
    reduced.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", update);
    };
  }, []);

  useLayoutEffect(() => {
    const from = previousPhase.current;
    const changed = from !== selected;
    previousPhase.current = selected;
    if (changed) arrivedPhase.current = null;
    const transition: FactoryFilmState["transition"] = from === null ? "entry" : !changed ? "still"
      : selected === from + 1 ? "forward" : selected === from - 1 ? "reverse" : "jump";
    const base = { phase: selected, source: source(selected), transition, motion: motionOff ? "off" as const : "on" as const };
    let cancelled = false, finished = false, accepted = false, decoded = false;
    let published: FactoryFilmState | undefined;
    let frameRequest = 0, animationFrame = 0, watchdog = 0;
    let posterCleanup = () => {};
    const slot = visibleVideo.current === 0 ? 1 : 0;
    const video = videos.current[slot]!;
    const finalPoster = posters.current[selected]!;
    const publish = (status: FactoryFilmState["status"], settled = false) => {
      if (cancelled) return;
      const next = { ...base, status, settled };
      if (published?.status === status && published.settled === settled) return;
      published = next;
      setState(next);
      callback.current?.(next);
    };
    const clearWatchdog = () => window.clearTimeout(watchdog);
    const hideMedia = () => {
      for (const media of [...videos.current, ...posters.current]) media?.removeAttribute("data-visible");
    };
    const stop = () => {
      clearWatchdog();
      if (frameRequest) video.cancelVideoFrameCallback?.(frameRequest);
      cancelAnimationFrame(animationFrame);
      for (const media of videos.current) media?.pause();
    };
    const showPoster = (status: FactoryFilmState["status"]) => {
      if (cancelled || finished) return;
      finished = true;
      arrivedPhase.current = selected;
      stop();
      const reveal = () => {
        if (cancelled) return;
        hideMedia();
        finalPoster.setAttribute("data-visible", "true");
        visibleVideo.current = null;
        videos.current.forEach(release);
        publish(status, true);
      };
      const failed = () => {
        if (cancelled) return;
        setPosterFailed(true);
        // Keep any previously decoded frame beneath the readable fallback.
        publish("error", true);
      };
      if (finalPoster.complete && finalPoster.naturalWidth > 0) reveal();
      else if (finalPoster.complete) failed();
      else {
        publish(status);
        finalPoster.addEventListener("load", reveal, { once: true });
        finalPoster.addEventListener("error", failed, { once: true });
        posterCleanup = () => {
          finalPoster.removeEventListener("load", reveal);
          finalPoster.removeEventListener("error", failed);
        };
      }
    };
    const commitFrame = () => {
      if (cancelled || finished || !accepted || !decoded) return;
      clearWatchdog();
      if (visibleVideo.current !== slot) {
        // Switch only after decoding; releasing the outgoing slot can never expose black.
        hideMedia();
        video.setAttribute("data-visible", "true");
        visibleVideo.current = slot;
        release(videos.current[1 - slot]);
      }
      publish("playing");
    };
    const awaitFrame = () => {
      if (cancelled || finished || frameRequest || animationFrame) return;
      if (video.requestVideoFrameCallback) {
        frameRequest = video.requestVideoFrameCallback(() => {
          frameRequest = 0;
          decoded = true;
          commitFrame();
        });
      } else {
        animationFrame = requestAnimationFrame(() => {
          animationFrame = requestAnimationFrame(() => {
            animationFrame = 0;
            decoded = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
            commitFrame();
          });
        });
      }
    };
    const armWatchdog = () => {
      clearWatchdog();
      watchdog = window.setTimeout(() => showPoster("error"), 10000);
    };
    const onWaiting = () => {
      if (cancelled || finished) return;
      publish("loading");
      armWatchdog();
    };
    const onProgress = () => {
      // timeupdate also covers browsers that defer frame callbacks for hidden buffers.
      if (video.currentTime > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) decoded = true;
      commitFrame();
    };
    const onEnded = () => {
      if (cancelled || finished) return;
      if (visibleVideo.current !== slot) { showPoster("held"); return; }
      finished = true;
      arrivedPhase.current = selected;
      stop();
      // Keep the video and its final decoded frame attached until the next cue is ready.
      publish("held", true);
    };
    const onError = () => showPoster("error");
    const events = { loadeddata: awaitFrame, playing: awaitFrame, timeupdate: onProgress, waiting: onWaiting, ended: onEnded, error: onError };
    setPosterFailed(false);
    for (const media of videos.current) media?.pause();
    if (from === null) finalPoster.setAttribute("data-visible", "true");

    if (motionOff || transition === "reverse" || (!changed && arrivedPhase.current === selected)) {
      showPoster(motionOff ? "paused" : "held");
    } else {
      release(video);
      for (const [event, handler] of Object.entries(events)) video.addEventListener(event, handler);
      video.muted = true;
      video.defaultMuted = true;
      video.poster = poster(selected);
      video.src = source(selected);
      video.load();
      publish("loading");
      armWatchdog();
      void video.play().then(() => {
        if (cancelled || finished) return;
        accepted = true;
        if (decoded) commitFrame(); else awaitFrame();
      }).catch(error => {
        if (!cancelled && !finished) showPoster(error?.name === "NotAllowedError" ? "paused" : "error");
      });
    }

    return () => {
      cancelled = true;
      stop();
      posterCleanup();
      for (const [event, handler] of Object.entries(events)) video.removeEventListener(event, handler);
      // An outgoing visible frame stays frozen while the other slot prepares the next shot.
      if (visibleVideo.current !== slot) release(video);
    };
  }, [selected, motionOff]);

  useLayoutEffect(() => {
    const media = [...videos.current];
    return () => {
      media.forEach(release);
      visibleVideo.current = null;
      previousPhase.current = null;
      arrivedPhase.current = null;
    };
  }, []);

  return <div ref={root} className={`factory-film ${className}`} role="img" aria-label={SHOTS[selected].label}
    data-phase={state.phase} data-status={state.status} data-source={state.source}
    data-transition={state.transition} data-settled={state.settled} data-motion={state.motion}
    data-poster-error={posterFailed || undefined}>
    {SHOTS.map((shot, index) => <img key={shot.file} ref={node => { posters.current[index] = node; }}
      className="factory-film__poster" src={poster(index)} alt="" aria-hidden="true" decoding="async" loading="eager" draggable={false}/>) }
    {[0, 1].map(slot => <video key={slot} ref={node => { videos.current[slot] = node; }}
      className="factory-film__video" data-slot={slot} aria-hidden="true" muted playsInline preload="auto"
      disablePictureInPicture disableRemotePlayback tabIndex={-1}/>) }
    {posterFailed && <span className="factory-film__fallback">제작 장면을 불러오지 못했습니다.</span>}
  </div>;
}
