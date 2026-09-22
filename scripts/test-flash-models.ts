async function testFlashModels() {
  const url = `${process.env.HIDEVS_BASE_URL}/chat/completions`;
  const key = process.env.HIDEVS_API_KEY;

  for (const model of ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash']) {
    console.log(`\nTesting ${model}...`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'user', content: 'What is the capital of France? Give 2 sentences.' }
          ],
          max_tokens: 300,
          stream: false
        })
      });

      console.log(`Status: ${res.status}`);
      if (!res.ok) {
        console.log('Error:', await res.text());
      } else {
        const data = await res.json();
        console.log('Usage:', data.usage);
        console.log('Content:', data.choices?.[0]?.message?.content);
      }
    } catch (e: any) {
      console.log('Exception:', e.message);
    }
  }
}

testFlashModels();
