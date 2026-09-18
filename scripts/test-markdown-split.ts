import { SentenceDetector } from '../src/lib/sentence-boundary';

const detector = new SentenceDetector();
const text = `Based on the provided document:

* **Operating Costs:** Operating costs rose 8% year-over-year to **$31.2 million**. Within operating expenses, research and development (R&D) expenses were **$12.4 million** (27.5% of total revenue).
* **Headcount Changes:** The rise in operating costs was driven by **planned headcount additions in artificial intelligence research and international sales expansion**. By the end of the quarter, the total global workforce reached **820 full-time employees**.`;

const s1 = detector.addToken(text);
const s2 = detector.flush();
const all = [...s1, ...s2];
all.forEach((s, i) => console.log(i + 1, JSON.stringify(s)));
