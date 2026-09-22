// Test thinking options with HiDevs
async function testThinking() {
  const url = `${process.env.HIDEVS_BASE_URL}/chat/completions`;
  const key = process.env.HIDEVS_API_KEY;

  console.log("--- 1. Testing max_tokens: 2048 with streaming ---");
  const res1 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      messages: [
        { role: 'user', content: 'Explain the 5 core stages of Tripwire verification pipeline in detail.' }
      ],
      max_tokens: 2048,
      stream: true
    })
  });

  const reader = res1.body?.getReader();
  const decoder = new TextDecoder();
  let tokens = '';
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const raw = line.replace(/^data:\s*/, '').trim();
        if (raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          const c = parsed.choices?.[0]?.delta?.content;
          if (c) tokens += c;
        } catch {}
      }
    }
  }
  console.log("Tokens received (length=" + tokens.length + "):\n", tokens);

  console.log("\n--- 2. Testing thinking_budget: 0 (or budget_tokens: 0) ---");
  const res2 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      messages: [
        { role: 'user', content: 'Explain the 5 core stages of Tripwire verification pipeline in detail.' }
      ],
      max_tokens: 1024,
      thinking: { budget_tokens: 0 },
      stream: false
    })
  });
  console.log("Res2 status:", res2.status);
  const data2 = await res2.json();
  console.log("Res2 usage:", data2.usage);
  console.log("Res2 content preview:", data2.choices?.[0]?.message?.content?.slice(0, 200));
}

testThinking();
