// Vercel serverless function: forwards site forms to balamchi@divangroup.ca via Resend.
// Env vars (Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY  — required for sending
//   CONTACT_TO      — optional, default balamchi@divangroup.ca
//   CONTACT_FROM    — optional, default "Cinematic Clinic <cinematic@divangroup.ca>" (divangroup.ca is verified in Resend)
// Without RESEND_API_KEY the function answers 503 {fallback:true} and the page opens a pre-filled email instead.

const LIMITS = { name: 120, email: 200, clinic: 200, location: 200, interest: 80, message: 4000 };
const clean = (v, max) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  if (body.company) return res.status(200).json({ ok: true }); // honeypot: pretend success

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const clinic = clean(body.clinic, LIMITS.clinic);
  const location = clean(body.location, LIMITS.location);
  const interest = clean(body.interest, LIMITS.interest);
  const message = String(body.message || '').trim().slice(0, LIMITS.message);
  const kind = body.kind === 'academy' ? 'academy' : 'contact';
  const lang = body.lang === 'fa' ? 'fa' : 'en';
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Name and a valid email are required' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(503).json({ fallback: true, error: 'Email not configured' });

  const to = process.env.CONTACT_TO || 'balamchi@divangroup.ca';
  const from = process.env.CONTACT_FROM || 'Cinematic Clinic <cinematic@divangroup.ca>';
  const subject = (kind === 'academy' ? 'Academy waitlist' : 'Work with me') + ` — ${name}` + (clinic ? ` (${clinic})` : '') + ` [${lang}]`;
  const rows = [
    ['Name', name], ['Email', email],
    [kind === 'academy' ? 'City' : 'Clinic', clinic],
    [kind === 'academy' ? 'Experience' : 'City / country', location],
    ['Interest', interest], ['Language', lang], ['Form', kind],
  ].filter((r) => r[1]);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6"><h2 style="margin:0 0 12px">${esc(subject)}</h2><table style="border-collapse:collapse">${rows.map((r) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(r[0])}</td><td style="padding:4px 0">${esc(r[1])}</td></tr>`).join('')}</table>${message ? `<p style="white-space:pre-wrap;margin-top:16px;border-top:1px solid #ddd;padding-top:12px">${esc(message)}</p>` : ''}<p style="color:#888;font-size:12px;margin-top:20px">Sent from cinematicclinic.com</p></div>`;
  const text = rows.map((r) => `${r[0]}: ${r[1]}`).join('\n') + (message ? `\n\n${message}` : '');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: email, subject, html, text }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('Resend error', r.status, err);
      return res.status(502).json({ error: 'Send failed' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'Send failed' });
  }
};
