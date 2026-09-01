'use strict';
/**
 * WebAuthn API routes
 * 
 * This implements a lightweight server-side WebAuthn flow.
 * For full production use, consider the @simplewebauthn/server library.
 * These routes handle the challenge/credential exchange with the browser's
 * navigator.credentials API (platform authenticator = fingerprint/face/PIN).
 *
 * NOTE: WebAuthn requires HTTPS (or localhost) in the browser.
 */

const router    = require('express').Router();
const { query } = require('../../config/db');
const crypto    = require('crypto');

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

// ── Registration (Binding a device authenticator to the user account) ──

// POST /api/webauthn/register/begin
router.post('/register/begin', async (req, res, next) => {
  try {
    const user      = req.session.user;
    const challenge = crypto.randomBytes(32);
    req.session.webauthnChallenge = b64url(challenge);

    const options = {
      challenge:        b64url(challenge),
      rp:               { name: 'AttendUyo', id: req.hostname },
      user: {
        id:             b64url(Buffer.from(String(user.id))),
        name:           user.email,
        displayName:    user.name,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7  }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification:        'required',
        requireResidentKey:      false,
      },
      timeout:          60000,
      attestation:      'none',
    };

    res.json(options);
  } catch (err) { next(err); }
});

// POST /api/webauthn/register/finish
router.post('/register/finish', async (req, res, next) => {
  try {
    const { id, rawId, response, type } = req.body;
    if (type !== 'public-key') return res.status(400).json({ error: 'Invalid credential type' });

    // Store credential (simplified — production should verify attestation)
    const user = req.session.user;
    await query(
      `INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter)
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE public_key = VALUES(public_key)`,
      [user.id, id, JSON.stringify(response)]
    );

    req.session.webauthnChallenge = null;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Authentication (Proving biometric identity before marking attendance) ──

// POST /api/webauthn/authenticate/begin
router.post('/authenticate/begin', async (req, res, next) => {
  try {
    const user      = req.session.user;
    const challenge = crypto.randomBytes(32);
    req.session.webauthnChallenge = b64url(challenge);

    const [creds] = await query(
      'SELECT credential_id FROM webauthn_credentials WHERE user_id = ?',
      [user.id]
    );

    const options = {
      challenge:        b64url(challenge),
      rpId:             req.hostname,
      allowCredentials: creds.map(c => ({
        type: 'public-key',
        id:   c.credential_id,
        transports: ['internal'],
      })),
      userVerification: 'required',
      timeout:          60000,
    };

    res.json({ options, hasCredentials: creds.length > 0 });
  } catch (err) { next(err); }
});

// POST /api/webauthn/authenticate/finish
router.post('/authenticate/finish', async (req, res, next) => {
  try {
    const { id, response, type } = req.body;
    if (type !== 'public-key') return res.status(400).json({ error: 'Invalid credential type' });

    const [creds] = await query(
      'SELECT * FROM webauthn_credentials WHERE user_id = ? AND credential_id = ?',
      [req.session.user.id, id]
    );

    if (!creds.length) {
      return res.status(401).json({ error: 'Credential not found for this account' });
    }

    // Update counter (simplified verification — production should parse authenticatorData)
    await query(
      'UPDATE webauthn_credentials SET counter = counter + 1 WHERE id = ?',
      [creds[0].id]
    );

    // Mark this session as biometric-verified
    req.session.biometricVerified = true;
    req.session.webauthnChallenge = null;

    res.json({ success: true, verified: true });
  } catch (err) { next(err); }
});

// GET /api/webauthn/status
router.get('/status', async (req, res, next) => {
  try {
    const [creds] = await query(
      'SELECT id, created_at FROM webauthn_credentials WHERE user_id = ?',
      [req.session.user.id]
    );
    res.json({
      hasCredentials:    creds.length > 0,
      credentialCount:   creds.length,
      sessionVerified:   req.session.biometricVerified === true,
    });
  } catch (err) { next(err); }
});

module.exports = router;
