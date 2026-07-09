import type { NextConfig } from "next";

function getConnectSrc(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return "'self'";
  }
  try {
    return `'self' ${new URL(apiUrl).origin}`;
  } catch {
    return "'self'";
  }
}

function addImageRemotePattern(
  patterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>,
  origin: string,
): void {
  try {
    const parsed = new URL(origin);
    const protocol = parsed.protocol.replace(":", "") as "http" | "https";
    const hostnames =
      parsed.hostname === "localhost"
        ? ["localhost", "127.0.0.1"]
        : parsed.hostname === "127.0.0.1"
          ? ["127.0.0.1", "localhost"]
          : [parsed.hostname];

    for (const hostname of hostnames) {
      patterns.push({
        protocol,
        hostname,
        ...(parsed.port ? { port: parsed.port } : {}),
        pathname: "/**",
      });
    }
  } catch {
    // ignore invalid origin
  }
}

function getImageRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const patterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [
    {
      protocol: "https",
      hostname: "images.unsplash.com",
      pathname: "/**",
    },
  ];

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    addImageRemotePattern(patterns, apiUrl);
  } else if (process.env.NODE_ENV !== "production") {
    addImageRemotePattern(patterns, "http://localhost:8002");
  }

  return patterns;
}

function getScriptSrc(): string {
  const parts = ["'self'", "'unsafe-inline'"];
  // React dev tooling (call stacks, Fast Refresh helpers) needs eval in development only.
  if (process.env.NODE_ENV !== "production") {
    parts.push("'unsafe-eval'");
  }
  return parts.join(" ");
}

function getSecurityHeaders() {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        `script-src ${getScriptSrc()}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: http:",
        "font-src 'self'",
        `connect-src ${getConnectSrc()}`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
  ];
}

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@coworkprysme/shared"],
  serverExternalPackages: ["mongoose"],
  images: {
    remotePatterns: getImageRemotePatterns(),
    // Next.js 16 blocks localhost/private IPs in the image optimizer (SSRF protection).
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: getSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
