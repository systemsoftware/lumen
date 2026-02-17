const ollama = require('ollama').default;
const db = new (require('dubnium'))(require('path').join(require('electron').app.getPath('userData'), 'db'));

module.exports = async function({ id, ocrText, response }) {
  const embeddingResult = await ollama.embeddings({
    model: 'nomic-embed-text',
    prompt: ocrText
  })

  console.log('Saving capture with ID:', id);


  const record = db.get(id);
  const existingResponses = (await record.read()).responses || [];
  existingResponses.push(response);
  await record.kv('responses', existingResponses);
  await record.kv('embedding', embeddingResult.embedding);

  console.log('Saved capture:', record.id)
}
