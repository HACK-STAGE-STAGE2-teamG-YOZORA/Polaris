import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16はデフォルトで AGENTS.md / CLAUDE.md を自動生成するため、
  // このリポジトリの規約と衝突しないよう無効化する
  agentRules: false,
  serverExternalPackages: [
    '@napi-rs/canvas',
    '@tesseract.js-data/eng',
    '@tesseract.js-data/jpn',
    'pdfjs-dist',
    'tesseract.js',
  ],
};

export default nextConfig;
