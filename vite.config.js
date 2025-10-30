import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // `index.html`이 루트에 있으므로 기본 경로를 설정해줍니다.
  root: '.',
  publicDir: 'public', // public 폴더를 사용한다면
  build: {
    // Firebase Hosting 배포 시 기본 빌드 디렉토리인 'dist'를 사용합니다.
    outDir: 'dist', 
  }
});