// using node --env-file=.env

async function testHiDevs() {
  const url = `${process.env.HIDEVS_BASE_URL}/chat/completions`;
  const key = process.env.HIDEVS_API_KEY;

  console.log('Testing non-streaming call to HiDevs...');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      messages: [
        { role: 'user', content: 'What is the capital of France and explain why in 3 paragraphs.' }
      ],
      max_tokens: 2048,
      stream: false
    })
  });

  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));

  console.log('\nTesting streaming call to HiDevs...');
  const streamRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      messages: [
        { role: 'user', content: 'What is the capital of France and explain why in 3 paragraphs.' }
      ],
      max_tokens: 500,
      stream: true
    })
  });

  const reader = streamRes.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let chunkIndex = 0;
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    const text = decoder.decode(value);
    console.log(`CHUNK ${chunkIndex++}:`, text);
    fullText += text;
  }
}

testHiDevs();
