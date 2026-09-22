import { streamAnswerGeneration } from '../src/lib/gemini';
import { SAMPLE_DOCUMENT_TEXT } from '../src/lib/sample-doc';
import { extractTextFromPdf } from '../src/lib/pdf';
import fs from 'fs';

async function testQuestions() {
  process.env.GEMINI_GENERATION_MODEL = 'gemini-3.5-flash-lite';
  
  console.log("=== Question 1 with gemini-3.5-flash-lite ===");
  const q1 = "what is the use of this doc in the first place?";
  let out1 = "";
  for await (const token of streamAnswerGeneration(q1, SAMPLE_DOCUMENT_TEXT)) {
    out1 += token;
  }
  console.log("Output 1:\n", out1);

  console.log("\n=== Question 2 with gemini-3.5-flash-lite on PRD PDF ===");
  const q2 = "Explain the pipeline used here for the project.";
  // Check if Tripwire_PRD_v1.1.pdf exists
  let prdText = "";
  try {
    const pdfBuf = fs.readFileSync('Tripwire_PRD_v1.1.pdf');
    const pages = await extractTextFromPdf(pdfBuf);
    prdText = pages.map(p => p.text).join('\n\n');
    console.log(`Read PRD PDF: ${prdText.length} chars, ${pages.length} pages`);
  } catch {
    prdText = fs.readFileSync('docs/PRD.md', 'utf-8');
    console.log(`Read docs/PRD.md: ${prdText.length} chars`);
  }

  let out2 = "";
  for await (const token of streamAnswerGeneration(q2, prdText)) {
    out2 += token;
  }
  console.log("Output 2:\n", out2);
}

testQuestions();
