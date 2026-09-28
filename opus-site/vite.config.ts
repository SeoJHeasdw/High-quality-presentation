import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // three.js(트윈)는 따로 나뉘어 필요할 때만 불러온다. 영상 라벨 좌표(track.json)가 본 번들에 들어 있다.
  build: { chunkSizeWarningLimit: 700 },
  server: { port: 5200, strictPort: true, open: false },
  preview: { port: 5201, strictPort: true },
});
