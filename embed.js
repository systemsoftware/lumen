const ollama = require('ollama').default;
const db = new (require('dubnium'))(require('path').join(require('electron').app.getPath('userData'), 'db'));

module.exports = async function({ id, ocrText, response }) {
  const embeddingResult = await ollama.embeddings({
    model: 'nomic-embed-text',
    prompt: ocrText
  })


  const record = db.get(id);
  await record.kv('response', response);
  await record.kv('embedding', embeddingResult.embedding);

  console.log('Saved capture:', record.id)
}
