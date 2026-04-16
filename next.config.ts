import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },

  async rewrites() {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || API_URL;
    const PRODUCT_SERVICE_URL =
      process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL || "http://localhost:8083";
    const CART_SERVICE_URL =
      process.env.NEXT_PUBLIC_CART_SERVICE_URL || "http://localhost:8084";
    const ORDER_SERVICE_URL =
      process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || "http://localhost:8086";
    const INVENTORY_SERVICE_URL =
      process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL || "http://localhost:8082";

    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${API_URL}/auth/:path*`,
      },
      {
        source: "/ops/gateway/:path*",
        destination: `${GATEWAY_URL}/:path*`,
      },
      {
        source: "/ops/product/:path*",
        destination: `${PRODUCT_SERVICE_URL}/:path*`,
      },
      {
        source: "/ops/cart/:path*",
        destination: `${CART_SERVICE_URL}/:path*`,
      },
      {
        source: "/ops/order/:path*",
        destination: `${ORDER_SERVICE_URL}/:path*`,
      },
      {
        source: "/ops/inventory/:path*",
        destination: `${INVENTORY_SERVICE_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
