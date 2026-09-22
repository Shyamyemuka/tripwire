import { extractRelevantContext } from '../src/lib/gemini';
import { SAMPLE_DOCUMENT_TEXT } from '../src/lib/sample-doc';

async function testImprovedPrompt() {
  const url = `${process.env.HIDEVS_BASE_URL}/chat/completions`;
  const key = process.env.HIDEVS_API_KEY;

  const systemInstruction = `[Context]
You are answering a user's question using only the document provided below as your source of truth. Your answer will be verified sentence-by-sentence against this document, so factual accuracy is critical.

[Role]
You are an expert analytical assistant explaining source material clearly, comprehensively, and factually.

[Instruction]
Answer the QUESTION thoroughly and informatively using the information in the DOCUMENT.
Provide a detailed, multi-sentence explanation that addresses all relevant aspects of the question based on facts, numbers, and details in the document.
Structure your answer into distinct, complete sentences.
Do not restrict yourself to a single sentence or brief summary; give a comprehensive, multi-sentence answer whenever the document contains relevant information.
If the document does not cover certain details, state that clearly.

[Personality]
Direct, informative, factual, and articulate.`;

  const q1 = "what is the use of this doc in the first place?";
  const context1 = SAMPLE_DOCUMENT_TEXT;

  console.log("=== Testing Q1 ===");
  const res1 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'gemini-3.5-flash-lite',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: `DOCUMENT:\n${context1}\n\nQUESTION:\n${q1}` }
      ],
      max_tokens: 1500,
      temperature: 0.2,
      stream: false
    })
  });

  const data1 = await res1.json();
  console.log("Q1 Output:\n", data1.choices?.[0]?.message?.content);
  console.log("Q1 Usage:\n", data1.usage);

  const q2 = "Explain the pipeline used here for the project.";
  const samplePipelineDoc = `Tripwire Pipeline Overview:
1. Document Intake: The system ingests a PDF or raw text document up to 20 pages or 8,000 words.
2. Chunking & Moss Indexing: The document is divided into overlapping 200-word passages with 40-word overlap. Each chunk is indexed into Moss for sub-10ms vector similarity search.
3. Whole-Document Streaming: When a question is submitted, Gemini generates an answer token-by-token.
4. Sentence Boundary Detection: A streaming tokenizer detects sentence endings in real-time.
5. Verification & Classification: Every completed sentence is independently queried against Moss. The top candidate passages are classified as SUPPORTED (green), CONTRADICTED (red), or UNVERIFIABLE (amber).`;

  console.log("\n=== Testing Q2 ===");
  const res2 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'gemini-3.5-flash-lite',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: `DOCUMENT:\n${samplePipelineDoc}\n\nQUESTION:\n${q2}` }
      ],
      max_tokens: 1500,
      temperature: 0.2,
      stream: false
    })
  });

  const data2 = await res2.json();
  console.log("Q2 Output:\n", data2.choices?.[0]?.message?.content);
  console.log("Q2 Usage:\n", data2.usage);
}

testImprovedPrompt();
