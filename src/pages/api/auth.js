const ALLOWED_DOMAINS = ['internetbrands.com'];
const ALLOWED_EMAILS = [
  'cbrugger@growth.legal',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'No credential provided' });
  }
  try {
    const parts = credential.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    );
    const email = (payload.email || '').toLowerCase().trim();
    const name = payload.name || '';
    const picture = payload.picture || '';
    if (!email) {
      return res.status(400).json({ error: 'No email in token' });
    }
    const domain = email.split('@')[1];
    const isAllowed = ALLOWED_DOMAINS.includes(domain) ||
      ALLOWED_EMAILS.map(function(e) { return e.toLowerCase(); }).includes(email);
    if (!isAllowed) {
      return res.status(403).json({
        error: 'Access denied',
        message: email + ' is not authorized to access this dashboard.'
      });
    }
    res.status(200).json({
      authorized: true,
      user: { email: email, name: name, picture: picture }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify token', details: err.message });
  }
}
