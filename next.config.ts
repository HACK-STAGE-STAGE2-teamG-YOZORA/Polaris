import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@napi-rs/canvas',
    '@tesseract.js-data/eng',
    '@tesseract.js-data/jpn',
    'pdfjs-dist',
    'tesseract.js',
  ],
};

export default nextConfig;
