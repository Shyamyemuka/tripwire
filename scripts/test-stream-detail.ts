import { streamAnswerGeneration } from '../src/lib/gemini';
import { SAMPLE_DOCUMENT_TEXT } from '../src/lib/sample-doc';

async function test() {
  const q1 = "what is the use of this doc in the first place?";
  console.log("=== Question 1 ===");
  try {
    for await (const token of streamAnswerGeneration(q1, SAMPLE_DOCUMENT_TEXT)) {
      process.stdout.write(`[CHUNK: ${JSON.stringify(token)}]\n`);
    }
  } catch (err) {
    console.error("Q1 error:", err);
  }

  const q2 = "Explain the pipeline used here for the project.";
  console.log("\n=== Question 2 ===");
  try {
    for await (const token of streamAnswerGeneration(q2, SAMPLE_DOCUMENT_TEXT)) {
      process.stdout.write(`[CHUNK: ${JSON.stringify(token)}]\n`);
    }
  } catch (err) {
    console.error("Q2 error:", err);
  }
}

test();
