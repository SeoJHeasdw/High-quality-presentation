import { Config } from "@remotion/cli/config";

// 이 컨테이너에 깔린 Chromium headless shell을 쓴다. 다른 기계에서는 REMOTION_BROWSER로 바꾸거나 지우면 Remotion이 받아 온다.
const browser = process.env.REMOTION_BROWSER ?? "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
import fs from "node:fs";
if (fs.existsSync(browser)) Config.setBrowserExecutable(browser);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(94);
Config.setChromiumOpenGlRenderer("swiftshader");
Config.setEntryPoint("src/index.ts");
