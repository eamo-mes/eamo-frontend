import axios from 'axios';

const CLIENT_ID = import.meta.env.VITE_AUTH_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.VITE_AUTH_REDIRECT_URI ?? 'http://localhost:5173/auth/callback';
const AUTH_URL = import.meta.env.VITE_AUTH_AUTHORIZE_URL ?? 'http://localhost:8000/oauth/authorize';
const TOKEN_URL = import.meta.env.VITE_AUTH_TOKEN_URL ?? 'http://localhost:8000/oauth/token';

if (!CLIENT_ID) {
  console.error('[pkce] VITE_AUTH_CLIENT_ID is not defined. Please set it in your .env file.');
}

function dec2hex(dec: number): string {
  return dec.toString(16).padStart(2, '0');
}

function generateIdOfLength(length: number): string {
  const arr = new Uint8Array(length / 2);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join('');
}

function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a: ArrayBuffer): string {
  let str = '';
  const bytes = new Uint8Array(a);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    const val = bytes[i];
    if (val !== undefined) {
      str += String.fromCharCode(val);
    }
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function redirectToLogin(redirectAfterLogin?: string) {
  const verifier = generateIdOfLength(80);
  localStorage.setItem('code_verifier', verifier);

  const hashed = await sha256(verifier);
  const challenge = base64urlencode(hashed);

  // Encode the intended redirect path in the state parameter so callback.vue can restore it
  const state = redirectAfterLogin ? encodeURIComponent(redirectAfterLogin) : '';

  let url = `${AUTH_URL}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=&code_challenge=${challenge}&code_challenge_method=S256`;
  if (state) {
    url += `&state=${state}`;
  }
  window.location.href = url;
}

export async function handleCallback(code: string): Promise<string> {
  const verifier = localStorage.getItem('code_verifier');
  if (!verifier) {
    throw new Error('No code_verifier found in storage.');
  }

  const response = await axios.post(TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
    code: code,
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  });

  const { access_token } = response.data;
  return access_token;
}

export async function revokeTokenBackend(token: string) {
  try {
    await axios.post('http://localhost:8000/api/logout', {}, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      }
    });
  } catch (err) {
    console.error('Error revoking token on backend:', err);
  }
}
