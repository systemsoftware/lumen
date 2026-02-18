const ollama = require('ollama').default
const { readFile, readdir } = require('fs/promises')
const cosineSimilarity  = require('./similarity.js')
const { app } = require('electron')
const path = require('path')

const dir = path.join(app.getPath('userData'), 'db')

async function semanticSearch(query, limit = 5) {
  const queryEmbedding = await ollama.embeddings({
    model: 'nomic-embed-text',
    prompt: query
  });

  const files = (await readdir(dir)).filter(f => f.endsWith('.json'));
  const records = await Promise.all(files.map(async f => {
    const data = JSON.parse(await readFile(path.join(dir, f), 'utf-8'));
    const score = cosineSimilarity(queryEmbedding.embedding, data.embedding || []);
    return { ...data, score };
  }));

  return records.sort((a,b) => b.score - a.score).slice(0, limit);
}

async function answerQuery(query) {
  const matches = await semanticSearch(query, 5)

  const context = matches.map((m, i) =>
    `${i + 1}. ${m.ocr}\nAI note: ${m.response}`
  ).join('\n\n')

  const prompt = `
You are answering questions using the user's past screenshots.

Relevant captures:
${context}

User question:
"${query}"

Answer using only the information above.
`

  const response = await ollama.chat({
    model: JSON.parse(await readFile(path.join(app.getPath('userData'), 'settings.json'), 'utf-8')).aiModel,
    messages: [{ role: 'user', content: prompt }]
  })

  return {
    response: response.message.content,
    matches
  }
}

module.exports = { semanticSearch, answerQuery }
