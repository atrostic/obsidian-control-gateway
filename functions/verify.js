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

  const ANSWERS = {
    "node-a": "haggis",
    "node-b": "2",
    "node-c": "3",
    "node-d": "4",
    "node-e": "5",
    "node-f": "6",
    "node-g": "7",
    "node-h": "8"
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
