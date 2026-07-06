import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:19006",
  "http://localhost:8081",
  "http://127.0.0.1:19006",
  "http://127.0.0.1:8081",
];

function getAllowedOrigins() {
  const configured = process.env.API_ALLOWED_ORIGINS || process.env.MOBILE_APP_ORIGINS;
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;
  return configured.split(",").map((origin) => origin.trim()).filter(Boolean);
}

export function applyCorsHeaders(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();
  const allowsAny = allowedOrigins.includes("*");

  if (origin && (allowsAny || allowedOrigins.includes(origin))) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Vary", "Origin");
  } else if (!origin) {
    res.headers.set("Access-Control-Allow-Origin", "*");
  }

  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Type");
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}

export function corsPreflight(req: NextRequest) {
  return applyCorsHeaders(req, new NextResponse(null, { status: 204 }));
}
