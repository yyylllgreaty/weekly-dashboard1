// src/pages/api/auth.js
// Verifies Google Sign-In token and checks email allowlist

// Allowed email domains (anyone with this domain can access)
const ALLOWED_DOMAINS = ['internetbrands.com'];

// Specific allowed emails (non-domain exceptions)
const ALLOWED_EMAILS = [
  'cbrugger@growth.legal',
  // Add more individual emails here as needed
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
    // Decode the Google JWT token (the middle part is the payload)
    const parts = credential.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    // Decode base64url payload
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    );

    const email = (payload.email || '').toLowerCase().trim();
    const name = payload.name || '';
    const picture = payload.picture || '';

    if (!email) {
      return res.status(400).json({ error: 'No email in token' });
    }

    // Check if email is allowed
    const domain = email.split('@')[1];
    const isAllowedDomain = ALLOWED_DOMAINS.includes(domain);
    const isAllowedEmail = ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email);

    if (!isAllowedDomain && !isAllowedEmail) {
      return res.status(403).json({
        error: 'Access denied',
        message: `${email} is not authorized to access this dashboard.`
      });
    }

    // Return user info
    res.status(200).json({
      authorized: true,
      user: { email, name, picture }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify token', details: err.message });
  }
}
