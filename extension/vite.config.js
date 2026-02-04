import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import svgr from 'vite-plugin-svgr';

export default defineConfig({
    plugins: [react(), svgr()], 
    publicDir: "public",
    build: {
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                background: resolve(__dirname, "src/background/background.js"),
                content: resolve(__dirname, "src/main.jsx"), // ★ React 앱을 진입점으로 설정
            },
            output: {
                entryFileNames: (chunk) => `${chunk.name}.js`,
                assetFileNames: (assetInfo) => {
                    // CSS 파일명을 style.css로 고정
                    if (assetInfo.name.endsWith(".css")) {
                        return "style.css";
                    }
                    return assetInfo.name;
                },
            },
        },
    },
});