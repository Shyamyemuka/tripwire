// Words that are titles or honorifics, or mid-sentence abbreviations that should never end a sentence on their own
const COMMON_HONORIFICS_AND_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'approx',
  'eg', 'ie', 'fig', 'dept', 'no', 'al', 'inc', 'ltd', 'corp', 'co'
]);

export class SentenceDetector {
  private buffer: string = '';

  constructor() {}

  public addToken(token: string): string[] {
    this.buffer += token;
    return this.extractSentences(false);
  }

  public flush(): string[] {
    return this.extractSentences(true);
  }

  public reset(): void {
    this.buffer = '';
  }

  public getRemainingBuffer(): string {
    return this.buffer;
  }

  private extractSentences(isEnd: boolean): string[] {
    const completed: string[] = [];

    while (this.buffer.length > 0) {
      const match = this.findNextBoundary();
      if (!match) {
        break;
      }

      const sentence = this.buffer.slice(0, match.endIndex).trim();
      this.buffer = this.buffer.slice(match.endIndex).trimStart();
      if (sentence.length > 0) {
        completed.push(sentence);
      }
    }

    if (isEnd && this.buffer.trim().length > 0) {
      completed.push(this.buffer.trim());
      this.buffer = '';
    }

    return completed;
  }

  private findNextBoundary(): { endIndex: number } | null {
    for (let i = 0; i < this.buffer.length; i++) {
      const char = this.buffer[i];

      // Colon followed by newline is a header / intro boundary (e.g. "Based on the provided document:\n\n")
      if (char === ':') {
        const after = this.buffer.slice(i + 1);
        if (/^\s*\n/.test(after)) {
          return { endIndex: i + 1 };
        }
      }

      // Newline followed by list item or heading or double-newline paragraph break
      if (char === '\n') {
        const after = this.buffer.slice(i + 1);
        if (/^\s*([-*•#]|\d+\.)\s+/.test(after)) {
          return { endIndex: i + 1 };
        }
        if (i + 1 < this.buffer.length && this.buffer[i + 1] === '\n') {
          return { endIndex: i + 2 };
        }
      }

      if (char === '.' || char === '!' || char === '?') {
        if (this.isFalseBoundary(i)) {
          continue;
        }

        let endIdx = i + 1;

        // Consume any attached closing quotes or brackets, e.g. ." or !)
        while (
          endIdx < this.buffer.length &&
          (this.buffer[endIdx] === '"' ||
           this.buffer[endIdx] === "'" ||
           this.buffer[endIdx] === '-' ||
           this.buffer[endIdx] === ')' ||
           this.buffer[endIdx] === ']')
        ) {
          endIdx++;
        }

        if (endIdx < this.buffer.length) {
          const nextChar = this.buffer[endIdx];
          if (/\s/.test(nextChar)) {
            const remainder = this.buffer.slice(endIdx).trimStart();
            if (remainder.length > 0) {
              const firstChar = remainder[0];
              // Valid sentence start: Uppercase letter, quote, bracket, digit, or markdown symbol (*, -, #, `)
              if (/[A-Z"'\(\[\d\*\-\#_\`]/.test(firstChar)) {
                return { endIndex: endIdx };
              } else {
                continue;
              }
            }
          }
        }
      }
    }
    return null;
  }

  private isFalseBoundary(dotIdx: number): boolean {
    const char = this.buffer[dotIdx];
    if (char !== '.') {
      return false;
    }

    // 1. Check decimal number: e.g. "$3.5" or "10.4%"
    const prevChar = dotIdx > 0 ? this.buffer[dotIdx - 1] : '';
    const nextChar = dotIdx + 1 < this.buffer.length ? this.buffer[dotIdx + 1] : '';
    if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
      return true;
    }

    // 2. Multi-dot acronyms like "U.S." or "e.g."
    const preText = this.buffer.slice(0, dotIdx);
    if (dotIdx >= 2 && (preText.endsWith('.e') || preText.endsWith('.i') || preText.endsWith('.U') || preText.endsWith('.u'))) {
      return true;
    }

    // 3. Check preceding word for known honorifics / mid-sentence abbreviations
    const lastWordMatch = preText.match(/([a-zA-Z0-9]+)$/);
    if (lastWordMatch) {
      const lastWord = lastWordMatch[1].toLowerCase();
      if (COMMON_HONORIFICS_AND_ABBREVIATIONS.has(lastWord)) {
        return true;
      }
      // Single letter initial in name (e.g. "John F. Kennedy") when preceded by a word
      if (lastWord.length === 1 && /[a-zA-Z]/.test(lastWord) && !preText.endsWith(' ' + lastWord)) {
        // Only if followed by capital letter
        return true;
      }
    }

    return false;
  }
}

export function splitTextIntoSentences(text: string): string[] {
  const detector = new SentenceDetector();
  const sentences = detector.addToken(text);
  const flushed = detector.flush();
  return [...sentences, ...flushed];
}
