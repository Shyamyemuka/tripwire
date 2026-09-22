import { classifySentenceVerdict, generateExplanation } from '../src/lib/gemini';

async function testVerdict() {
  const sentence = "The gross margin was 68.4%.";
  const candidates = [
    {
      chunkId: "c1",
      text: "Gross profit margin was 68.4% for the quarter.",
      pageNumber: 1,
      charOffsetStart: 0,
      charOffsetEnd: 50,
      similarityScore: 0.95
    }
  ];

  console.log("Testing classifySentenceVerdict...");
  const v = await classifySentenceVerdict(sentence, candidates);
  console.log("Verdict:", v);

  console.log("Testing generateExplanation...");
  const expl = await generateExplanation("Gross margin was 10%.", candidates[0].text);
  console.log("Explanation:", expl);
}

testVerdict();
