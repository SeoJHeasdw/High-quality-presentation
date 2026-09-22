import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5180,
    open: mode !== 'capture',
    // 녹화 중 소스 변경이 감지돼도 페이지를 새로고침하지 않는다. 캡처는
    // 시작 시점의 한 버전을 끝까지 유지해야 타임라인과 화면 상태가 맞는다.
    hmr: mode !== 'capture',
  }
}));
