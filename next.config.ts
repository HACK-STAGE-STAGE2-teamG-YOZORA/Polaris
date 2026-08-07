import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16はデフォルトで AGENTS.md / CLAUDE.md を自動生成するため、
  // このリポジトリの規約と衝突しないよう無効化する
  agentRules: false,
};

export default nextConfig;
