import { streamAnswerGeneration } from '../src/lib/gemini';
import { SAMPLE_DOCUMENT_TEXT } from '../src/lib/sample-doc';
import fs from 'fs';

async function testFull() {
  process.env.GEMINI_GENERATION_MODEL = 'gemini-3.5-flash-lite';

  console.log("=== Testing Question 1 ===");
  const q1 = "what is the use of this doc in the first place?";
  let out1 = "";
  for await (const token of streamAnswerGeneration(q1, SAMPLE_DOCUMENT_TEXT)) {
    out1 += token;
    process.stdout.write(token);
  }
  console.log("\n\n--- Done Q1. Total length:", out1.length);

  console.log("\n=== Testing Question 2 ===");
  const q2 = "Explain the pipeline used here for the project.";
  const prdText = fs.readFileSync('docs/PRD.md', 'utf-8');
  let out2 = "";
  for await (const token of streamAnswerGeneration(q2, prdText)) {
    out2 += token;
    process.stdout.write(token);
  }
  console.log("\n\n--- Done Q2. Total length:", out2.length);
}

testFull();
