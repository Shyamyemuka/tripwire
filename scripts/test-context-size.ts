async function testContextSize() {
  const url = `${process.env.HIDEVS_BASE_URL}/chat/completions`;
  const key = process.env.HIDEVS_API_KEY;

  for (const chars of [4000, 8000, 16000, 24000]) {
    const fakeDoc = "Acme Corp reported $45 million in revenue. ".repeat(chars / 43);
    console.log(`Testing document of ${fakeDoc.length} characters (~${Math.round(fakeDoc.length / 4)} tokens)...`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gemini-3.6-flash',
        messages: [
          { role: 'user', content: `DOCUMENT:\n${fakeDoc}\n\nQUESTION: What was the revenue?` }
        ],
        max_tokens: 1024,
        stream: false
      })
    });
    console.log(`Chars: ${chars}, Status: ${res.status}`);
    if (!res.ok) {
      const err = await res.text();
      console.log('Error:', err);
      break;
    } else {
      const data = await res.json();
      console.log('Usage:', data.usage);
    }
  }
}

testContextSize();
