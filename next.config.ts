import type { NextConfig } from "next";

// GitHub Pages 프로젝트 사이트는 https://<사용자>.github.io/<저장소>/ 아래에서 열리므로 빌드할 때 그 경로를 받는다 (로컬에서는 빈 값)
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // 서버 없이 HTML·JS 파일만으로 돌아가는 사이트로 내보낸다 (out/ 폴더)
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // 빌드할 때 노래방 인기차트를 받아 오는데, 느린 날을 생각해 넉넉히 기다린다
  staticPageGenerationTimeout: 180,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
