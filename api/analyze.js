import { requireOwner } from '../lib/require-owner.js';

export default async function handler(req, res) {
  
  if (req.method !== 'POST') return res.status(405).end();
  if (!await requireOwner(req, res)) return;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': (process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
