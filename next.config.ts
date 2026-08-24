import type { NextConfig } from "next";

const buildId = Date.now().toString();

const nextConfig: NextConfig = {
  output: "standalone",
  // `X-Powered-By: Next.js` is sent on every single response: a few wasted bytes
  // per response and a free framework-version fingerprint for anyone scanning
  // for known framework CVEs.
  poweredByHeader: false,
  // Gzip is done by Caddy (`encode zstd gzip`), not by Node. Next's built-in
  // compression runs on the same single-threaded event loop that serves every
  // request, so every JSON response was paying deflate CPU in front of the
  // handler queue. Caddy compresses in Go on its own threads and can serve zstd,
  // which is both faster and smaller than gzip for mobile clients.
  //
  // Caddy must be reloaded together with this change: with `compress: false` and
  // no `encode` directive, responses would go out uncompressed.
  compress: false,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  async headers() {
    return [
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
