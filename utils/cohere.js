/**
 * Cohere initialization with graceful fallback.
 */
const Cohere = require('cohere-ai');
let cohere = null;
let enabled = false;

function initCohere() {
  const key = process.env.COHERE_API_KEY;
  if (!key) {
    console.warn('COHERE_API_KEY not found; AI features disabled.');
    return { cohere: null, enabled: false };
  }
  Cohere.init(key);
  cohere = Cohere;
  enabled = true;
  console.log('Cohere initialized');
  return { cohere, enabled };
}

async function genQuestionsWithCohere(field, count=7) {
  if (!enabled) throw new Error('COHERE_DISABLED');
  const prompt = [
    { role: 'system', content: 'You are an expert interview coach. Reply ONLY with a JSON array of strings.' },
    { role: 'user', content: `Generate ${count} concise, role-specific interview questions for the field: "${field}".`}
  ];
  const resp = await Cohere.chat({
    model: process.env.COHERE_MODEL || 'command-r',
    messages: prompt,
    temperature: 0.4,
  });
  const text = resp?.text || '';
  let jsonText = text.trim();
  const start = jsonText.indexOf('[');
  const end = jsonText.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    jsonText = jsonText.slice(start, end+1);
  }
  let arr = [];
  try { arr = JSON.parse(jsonText); } catch {
    arr = jsonText.split(/\n+/).map(s => s.replace(/^\d+\.|^-\s*/, '').trim()).filter(Boolean);
  }
  arr = arr.filter(x => typeof x === 'string' && x.length > 0).slice(0, count);
  return arr;
}

module.exports = { initCohere, genQuestionsWithCohere, get cohere() { return cohere; }, get enabled(){ return enabled; } };
