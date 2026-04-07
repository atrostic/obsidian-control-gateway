export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // -----------------------------
  // GLOBAL PAUSE SETTINGS
  // -----------------------------
  const MANUAL_PAUSE = env.HUNT_PAUSED === "true";

  // Optional timed pause window in UTC
  // Example:
  // env.HUNT_PAUSE_START = "2026-04-12T02:00:00Z"
  // env.HUNT_PAUSE_END   = "2026-04-13T12:00:00Z"
  const now = Date.now();
  const pauseStart = env.HUNT_PAUSE_START ? Date.parse(env.HUNT_PAUSE_START) : null;
  const pauseEnd = env.HUNT_PAUSE_END ? Date.parse(env.HUNT_PAUSE_END) : null;

  const withinPauseWindow =
    pauseStart &&
    pauseEnd &&
    !Number.isNaN(pauseStart) &&
    !Number.isNaN(pauseEnd) &&
    now >= pauseStart &&
    now <= pauseEnd;

  const isPaused = MANUAL_PAUSE || withinPauseWindow;

  // Let the locked page itself load
  if (isPaused && path !== "/locked.html" && !path.startsWith("/api/")) {
    return Response.redirect(`${url.origin}/locked.html`, 302);
  }

  // -----------------------------
  // ROUTE PROTECTION MAP
  // -----------------------------
  // Each page can require one or more signed unlock cookies
  const protectedRoutes = {
    "/location.html": ["unlock_location"],
    "/sequence.html": ["unlock_sequence"],
    "/alpha.html": ["unlock_alpha"],
    "/omega.html": ["unlock_omega"],
    "/final_step.html": ["unlock_alpha", "unlock_omega"]
  };

  const requiredCookies = protectedRoutes[path];
  if (!requiredCookies) {
    return next();
  }

  const cookies = parseCookies(request.headers.get("Cookie") || "");

  for (const requiredCookie of requiredCookies) {
    const value = cookies[requiredCookie];

    if (!value) {
      return Response.redirect(`${url.origin}/locked.html`, 302);
    }

    const valid = await verifySignedValue(value, env.HUNT_SIGNING_SECRET, requiredCookie);
    if (!valid) {
      return Response.redirect(`${url.origin}/locked.html`, 302);
    }
  }

  return next();
}

function parseCookies(cookieHeader) {
  const out = {};
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawVal] = part.trim().split("=");
    if (!rawKey) continue;
    out[rawKey] = rawVal.join("=");
  }
  return out;
}

async function verifySignedValue(signedValue, secret, expectedName) {
  if (!secret || !signedValue) return false;

  const parts = signedValue.split(".");
  if (parts.length !== 2) return false;

  const payloadB64 = parts[0];
  const sigB64 = parts[1];

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return false;
  }

  if (!payload || payload.name !== expectedName || !payload.ts) return false;

  const expectedSig = await hmacSign(payloadB64, secret);
  return timingSafeEqual(sigB64, expectedSig);
}

async function hmacSign(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return arrayBufferToBase64Url(sig);
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input) {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  while (input.length % 4) input += "=";
  return atob(input);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
