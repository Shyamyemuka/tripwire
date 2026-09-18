async function runHttpE2ETest() {
  console.log('--- Testing Live HTTP API Endpoints on http://localhost:3000 ---');

  // 1. Session creation
  const sessRes = await fetch('http://localhost:3000/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Acme Corporation net revenue reached $45 million in Q3 2026. Gross profit margin held stable at 68.4%. Operating costs rose 8% to $31.2 million.',
      filename: 'financial.txt'
    })
  });
  const session = await sessRes.json();
  console.log(`1. Session created: ${session.sessionId}, chunks: ${session.chunks.length}`);

  // 2. Accurate claim
  const v1 = await (await fetch('http://localhost:3000/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: session.sessionId,
      sentence: 'Acme Corporation net revenue reached $45 million in Q3 2026.',
      mode: 'moss',
      chunks: session.chunks
    })
  })).json();
  console.log(`2. Accurate Claim: [${v1.status}] (Moss latency: ${v1.retrievalLatencyMs}ms) - ${v1.reasoning}`);

  // 3. Contradicted claim (Numerical contradiction: $90 million)
  const v2 = await (await fetch('http://localhost:3000/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: session.sessionId,
      sentence: 'Acme Corporation net revenue was $90 million in Q3 2026.',
      mode: 'moss',
      chunks: session.chunks
    })
  })).json();
  console.log(`3. Contradicted Claim: [${v2.status}] (Moss latency: ${v2.retrievalLatencyMs}ms) - ${v2.reasoning}`);

  // 4. Direction-flip contradiction (costs decreased vs rose)
  const v3 = await (await fetch('http://localhost:3000/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: session.sessionId,
      sentence: 'Operating costs decreased significantly during the quarter.',
      mode: 'moss',
      chunks: session.chunks
    })
  })).json();
  console.log(`4. Direction-Flip Claim: [${v3.status}] - ${v3.reasoning}`);

  // 5. Baseline retrieval comparison (FR-12)
  const v4 = await (await fetch('http://localhost:3000/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: session.sessionId,
      sentence: 'Acme Corporation net revenue reached $45 million in Q3 2026.',
      mode: 'baseline',
      chunks: session.chunks
    })
  })).json();
  console.log(`5. Baseline Comparison: [${v4.status}] (Baseline latency: ${v4.retrievalLatencyMs}ms)`);

  console.log('--- HTTP E2E Verification Complete ---');
}

runHttpE2ETest().catch(console.error);
