async function debugRawStream() {
  const url = `${process.env.HIDEVS_BASE_URL}/chat/completions`;
  const key = process.env.HIDEVS_API_KEY;

  console.log("Testing with gemini-3.6-flash and max_tokens: 500...");
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      messages: [
        {
          role: 'system',
          content: 'You are answering questions strictly based on the document. Write detailed, complete sentences.'
        },
        {
          role: 'user',
          content: 'DOCUMENT:\nAcme Corporation Q3 2026 Financial Results. Consolidated net revenue was $45 million, up 10% YoY. Gross margin was 68.4%. Operating costs rose 8% to $31.2 million. Cloud division generated $28.5 million. The company acquired CloudAI Systems for $12 million.\n\nQUESTION: what is the use of this doc in the first place?'
        }
      ],
      max_tokens: 500,
      stream: true
    })
  });

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  while (true) {
    const { done, value } = await reader!.read();
    if (done) {
      console.log("\n[READER DONE]");
      break;
    }
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const raw = line.replace(/^data:\s*/, '').trim();
        if (raw === '[DONE]') {
          console.log("\n[RECEIVED [DONE]]");
          continue;
        }
        try {
          const parsed = JSON.parse(raw);
          const finish = parsed.choices?.[0]?.finish_reason;
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            accumulated += delta;
            process.stdout.write(delta);
          }
          if (finish) {
            console.log(`\n[FINISH REASON: ${finish}]`);
          }
        } catch {}
      }
    }
  }

  console.log("\nTotal length:", accumulated.length);
}

debugRawStream();
