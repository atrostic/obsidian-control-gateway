export async function onRequestPost(context) {
  const { request } = context;
  const body = await request.json();

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
    return map[v] || v;
  };

  // For master nodes, normalize word.word.word / word-word-word / mixed separators
  const normalizeMasterDirective = (v) => {
    return normalize(v)
      .replace(/[.\s]+/g, "-")   // periods or spaces become hyphens
      .replace(/-+/g, "-")       // collapse repeated hyphens
      .replace(/^-|-$/g, "");    // trim leading/trailing hyphens
  };

  // answers blow.  Room is set to 123 - update with real room once checked in
  const ANSWERS = {
    "node-a": "touchy",
    "node-b": "3",
    "node-c": "galaxies",
    "node-d": "1",
    "node-e": "toolkit",
    "node-f": "2",
    "node-g": "infrastructure-access-stability",
    "node-h": "function-origin-scale"
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

  return new Response(
    JSON.stringify({
      correct: Boolean(correct) && input === correct
    }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
}
