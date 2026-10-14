import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 단일 HTML 빌드용 설정. tools/make-single-html.mjs가 이 설정으로 빌드한 뒤 하나의 파일로 묶는다.
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: "dist-single",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000, // 번들 안에서 참조하는 글꼴 등은 data URI로
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
