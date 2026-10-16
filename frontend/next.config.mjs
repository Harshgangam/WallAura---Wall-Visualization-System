import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/api/py/api/:path*",
        destination: "https://wallaura-wall-visualization-system.onrender.com/api/:path*",
      },
      {
        source: "/api/py/:path*",
        destination: "https://wallaura-wall-visualization-system.onrender.com/api/:path*",
      },
      {
        source: "/api/:path*",
        destination: "https://wallaura-wall-visualization-system.onrender.com/api/:path*",
      },
    ];
  },
};

export default nextConfig;
