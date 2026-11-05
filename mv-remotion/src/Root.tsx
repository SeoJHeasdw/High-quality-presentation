import React from "react";
import { Composition } from "remotion";
import { MV } from "./MV";
import { FPS, DURATION } from "./lib/song";
import type { Shot } from "./shots/types";

// 컷은 함수라서 props로 넘기면 직렬화 때 사라진다. 컴포넌트에 묶어 둔다.
export const makeRoot = (shots: Shot[]) => {
  const Film: React.FC<{ audio: boolean; grain: boolean }> = (p) => <MV shots={shots} {...p} />;
  return () => (
    <Composition id="MV" component={Film} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{ audio: true, grain: true }} />
  );
};
