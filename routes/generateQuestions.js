const express = require('express');
const router = express.Router();
const { genQuestionsWithCohere, enabled } = require('../utils/cohere');

router.post('/', async (req, res) => {
  try {
    const { field, count } = req.body || {};
    if (!field || typeof field !== 'string') return res.status(400).json({ error: 'Missing field' });
    const n = Math.max(1, Math.min(20, Number(count) || 7));
    let questions = [];
    try {
      questions = await genQuestionsWithCohere(field, n);
    } catch {
      questions = [
        `Tell me about a challenging project in ${field}.`,
        `How do you keep up with best practices in ${field}?`,
        `Describe a time you resolved a conflict within your team.`
      ].slice(0, n);
    }
    res.json({ ok: true, questions, ai: enabled });
  } catch (err) {
    res.status(500).json({ error: 'GEN_QUESTIONS_FAILED' });
  }
});

module.exports = router;
