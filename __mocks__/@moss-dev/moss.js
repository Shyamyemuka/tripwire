const sharedIndexes = new Map();

class MossClient {
  constructor(projectId, projectKey) {
    this.projectId = projectId;
    this.projectKey = projectKey;
    this.indexes = sharedIndexes;
  }

  async createIndex(sessionId, docs) {
    this.indexes.set(sessionId, docs);
    return { status: 'created', id: sessionId };
  }

  async loadIndex(sessionId) {
    return { status: 'loaded', id: sessionId };
  }

  async query(sessionId, queryText, options = {}) {
    const docs = this.indexes.get(sessionId) || [];
    const topK = options.topK || 3;
    const words = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    const scored = docs.map((doc) => {
      const docLower = (doc.text || '').toLowerCase();
      const matches = words.filter((w) => docLower.includes(w)).length;
      const score = words.length > 0 ? matches / words.length : 0.5;
      return {
        id: doc.id,
        text: doc.text,
        score: Math.min(1.0, score + 0.2)
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return {
      docs: scored.slice(0, topK)
    };
  }

  async listIndexes() {
    return Array.from(this.indexes.keys()).map((name) => ({
      name,
      createdAt: new Date().toISOString()
    }));
  }

  async deleteIndex(name) {
    this.indexes.delete(name);
    return { status: 'deleted' };
  }
}

module.exports = {
  MossClient,
  _sharedIndexes: sharedIndexes
};
