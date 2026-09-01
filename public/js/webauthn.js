/**
 * webauthn.js — WebAuthn browser-side flows
 * Uses navigator.credentials (platform authenticator = fingerprint/Face ID/Windows Hello)
 * NOTE: Requires HTTPS or localhost for the browser to allow WebAuthn
 */

// ── Utilities ────────────────────────────────────────────────

function b64urlToBuffer(b64url) {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin    = atob(padded);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function bufferToB64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let   str   = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function prepareCredentialCreationOptions(options) {
  return {
    ...options,
    challenge: b64urlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: b64urlToBuffer(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials || []).map(c => ({
      ...c,
      id: b64urlToBuffer(c.id),
    })),
  };
}

function prepareCredentialRequestOptions(options) {
  return {
    ...options,
    challenge: b64urlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map(c => ({
      ...c,
      id: b64urlToBuffer(c.id),
    })),
  };
}

function serializeCredential(credential) {
  return {
    id:    credential.id,
    rawId: bufferToB64url(credential.rawId),
    type:  credential.type,
    response: {
      clientDataJSON:    bufferToB64url(credential.response.clientDataJSON),
      attestationObject: credential.response.attestationObject
        ? bufferToB64url(credential.response.attestationObject) : undefined,
      authenticatorData: credential.response.authenticatorData
        ? bufferToB64url(credential.response.authenticatorData) : undefined,
      signature: credential.response.signature
        ? bufferToB64url(credential.response.signature) : undefined,
      userHandle: credential.response.userHandle
        ? bufferToB64url(credential.response.userHandle) : undefined,
    },
  };
}

// ── Registration ─────────────────────────────────────────────

async function registerBiometric() {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn is not supported in this browser.');
  }
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if (!available) {
    throw new Error('No platform authenticator found (fingerprint/face reader required).');
  }

  // 1. Get challenge from server
  const beginRes = await fetch('/api/webauthn/register/begin', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({}),
  });
  if (!beginRes.ok) throw new Error('Failed to start registration.');
  const options = await beginRes.json();

  // 2. Create credential on device
  const credential = await navigator.credentials.create({
    publicKey: prepareCredentialCreationOptions(options),
  });
  if (!credential) throw new Error('Registration cancelled by user.');

  // 3. Send credential to server
  const finishRes = await fetch('/api/webauthn/register/finish', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(serializeCredential(credential)),
  });
  if (!finishRes.ok) throw new Error('Failed to complete registration on server.');
  return await finishRes.json();
}

// ── Authentication ────────────────────────────────────────────

async function authenticateBiometric() {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn is not supported in this browser.');
  }

  // 1. Get challenge and credential list from server
  const beginRes = await fetch('/api/webauthn/authenticate/begin', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({}),
  });
  if (!beginRes.ok) throw new Error('Failed to start biometric authentication.');
  const { options, hasCredentials } = await beginRes.json();

  if (!hasCredentials) {
    throw new Error('No biometric credential registered. Please register your device first.');
  }

  // 2. Authenticate on device
  const assertion = await navigator.credentials.get({
    publicKey: prepareCredentialRequestOptions(options),
  });
  if (!assertion) throw new Error('Biometric authentication cancelled.');

  // 3. Verify on server
  const finishRes = await fetch('/api/webauthn/authenticate/finish', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(serializeCredential(assertion)),
  });
  const result = await finishRes.json();
  if (!finishRes.ok || !result.verified) {
    throw new Error(result.error || 'Biometric verification failed.');
  }
  return result;
}
