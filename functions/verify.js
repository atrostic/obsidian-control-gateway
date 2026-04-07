export async function onRequestPost(context) {
  const { request, env } = context;

  // Global pause support
  const MANUAL_PAUSE = env.HUNT_PAUSED === "true";

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

  if (MANUAL_PAUSE || withinPauseWindow) {
    return new Response(
      JSON.stringify({
        correct: false,
        paused: true
      }),
      {
        status: 423,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        correct: false,
        error: "Invalid JSON body"
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const { nodeId, answer } = body || {};

  const normalize = (v) => String(v || "").trim().toLowerCase();

  const normalizeNumber = (v) => {
    const map = {
      zero: "0",
      one: "1",
      two: "2",
      three: "3",
      four: "4",
      five: "5",
      six: "6",
      seven: "7",
      eight: "8",
      nine: "9"
    };
    return map[normalize(v)] || normalize(v);
  };

  // For master nodes, normalize word.word.word / word-word-word / mixed separators
  const normalizeMasterDirective = (v) => {
    return normalize(v)
      .replace(/[.\s]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  // answers blow. Room is set to 123 - update with real room once checked in
  const ANSWERS = {
    "node-a": "blankets",
    "node-b": "3",
    "node-c": "happy",
    "node-d": "1",
    "node-e": "factory",
    "node-f": "2",
    "node-g": "infrastructure-access-stability",
    "node-h": "function-origin-scale"
  };

  // Map solved nodes to unlock cookies
  // Adjust these based on which pages each solve should unlock
  const UNLOCK_COOKIES = {
    "node-a": "unlock_access",
    "node-b": "unlock_stability",
    "node-c": "unlock_function",
    "node-d": "unlock_location",
    "node-e": "unlock_scale",
    "node-f": "unlock_sequence",
    "node-g": "unlock_alpha",
    "node-h": "unlock_omega"
  };

  const safeNodeId = normalize(nodeId);

  let input = normalize(answer);
  let correct = normalize(ANSWERS[safeNodeId] || "");

  if (safeNodeId === "node-g" || safeNodeId === "node-h") {
    input = normalizeMasterDirective(input);
    correct = normalizeMasterDirective(correct);
  } else {
    input = normalizeNumber(input);
    correct = normalizeNumber(correct);
  }

  const isCorrect = Boolean(correct) && input === correct;

  const headers = new Headers({
    "Content-Type": "application/json"
  });

  if (isCorrect) {
    const cookieName = UNLOCK_COOKIES[safeNodeId];

    if (cookieName) {
      const signedValue = await createSignedValue(cookieName, env.HUNT_SIGNING_SECRET);

      headers.append(
        "Set-Cookie",
        `${cookieName}=${signedValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=172800`
      );
    }
  }

  return new Response(
    JSON.stringify({
      correct: isCorrect
    }),
    {
      headers
    }
  );
}

async function createSignedValue(name, secret) {
  if (!secret) {
    throw new Error("Missing HUNT_SIGNING_SECRET");
  }

  const payload = {
    name,
    ts: Date.now()
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = await hmacSign(payloadB64, secret);

  return `${payloadB64}.${sig}`;
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

function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
