export async function onRequestPost(context) {
  const { request } = context;
  const body = await request.json();

  const { nodeId, answer } = body;

  const normalize = (v) => v.trim().toLowerCase();

  const normalizeNumber = (v) => {
    const map = {
      zero: "0", one: "1", two: "2", three: "3",
      four: "4", five: "5", six: "6",
      seven: "7", eight: "8", nine: "9"
    };
    return map[v] || v;
  };

  // Room below is 123 - update with real room number
  const ANSWERS = {  
    "node-a": "touchy",
    "node-b": "3",
    "node-c": "galaxies",
    "node-d": "1",
    "node-e": "toolkit",
    "node-f": "2",
    "node-g": "function-origin-scale",
    "node-h": "infrastructure-access-stability"
  };

  let input = normalize(answer);
  input = normalizeNumber(input);

  let correct = normalize(ANSWERS[nodeId] || "");
  correct = normalizeNumber(correct);

  return new Response(JSON.stringify({
    correct: input === correct
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
