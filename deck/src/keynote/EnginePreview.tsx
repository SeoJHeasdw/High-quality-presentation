import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TiltedCard from "../reactbits/TiltedCard";
import { usePerformanceMotion } from "./usePerformanceMotion";
import "./EnginePreview.css";

interface EnginePreviewProps {
  engine: string;
  title: string;
  image: string;
  alt: string;
  description: string;
}

export default function EnginePreview({ engine, title, image, alt, description }: EnginePreviewProps) {
  const motionEnabled = usePerformanceMotion();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(true);
  const heading = useId();
  const close = (returnFocus = true) => { restoreFocus.current = returnFocus; setOpen(false); };

  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      if (restoreFocus.current && trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
    };
  }, [open]);

  return <>
    <div className="personal-preview-title"><span>{engine}</span><h2>{title}</h2></div>
    <figure className="engine-preview-surface">
      <TiltedCard imageSrc={image} altText={alt} captionText={title} enabled={motionEnabled} expanded={open} triggerRef={trigger} onActivate={() => { restoreFocus.current = true; setOpen(true); }}/>
    </figure>
    <p className="engine-preview-description">{description}</p>
    {open && createPortal(<dialog
      ref={dialog}
      className="engine-preview-dialog"
      aria-modal="true"
      aria-labelledby={heading}
      data-animated={motionEnabled || undefined}
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => { if (event.target === event.currentTarget) close(); }}
      onKeyDown={event => {
        if (event.key === "Escape") close();
        else if (["ArrowRight", "ArrowLeft", "PageDown", "PageUp", "Home", "End"].includes(event.key)) close(false);
      }}
    >
      <div className="engine-preview-dialog__heading"><span>{engine} / 실제 결과물</span><h2 id={heading}>{title}</h2></div>
      <button ref={closeButton} type="button" className="engine-preview-dialog__close" onClick={() => close()} aria-label="확대 보기 닫기"><span>닫기</span><kbd>Esc</kbd><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      <figure className="engine-preview-dialog__image"><img src={image} alt={alt}/><figcaption>{description}</figcaption></figure>
      <p className="engine-preview-dialog__navigation">→ 다음 장표로 계속</p>
    </dialog>, document.body)}
  </>;
}
