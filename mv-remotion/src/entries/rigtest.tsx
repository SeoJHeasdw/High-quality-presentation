import React from "react";
import { Composition, registerRoot, AbsoluteFill } from "remotion";
import { Kid } from "../kid/rig";
import { P, pose, gait } from "../kid/pose";

const poses = [P.stand, P.phone, P.crouch, P.leap, P.apex, P.flail, P.plop, P.sitEdge, P.point, P.cheer, P.fly, P.hang, P.dive, P.sleep, gait(.25, 1), gait(.3, 2)];
const T: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(#3b4b8a,#c9a3c8)" }}>
    <svg width={1920} height={1080}>
      {poses.map((p, i) => {
        const x = 140 + (i % 8) * 230, y = i < 8 ? 470 : 1000;
        return <Kid key={i} variant={i % 2 ? "friend" : "kid"} accent="#ff9ec4" pose={pose({ ...p, x, y, s: 300, face: i === 1 ? 1 : 0, faceColor: "#cfe6ff", anchor: (p as {anchor?: "feet"|"seat"|"center"}).anchor === "center" ? "center" : "feet", ...((p as {anchor?: string}).anchor === "center" ? { y: y - 150 } : {}) })} rim={{ dx: .7, dy: -.7, color: "#ffe2a8" }} />;
      })}
    </svg>
  </AbsoluteFill>
);
registerRoot(() => <Composition id="Rig" component={T} durationInFrames={1} fps={30} width={1920} height={1080} />);
