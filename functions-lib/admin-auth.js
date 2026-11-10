import { json } from './api-shared.js';

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function safeEqual(left, right) {
  const a = await digest(left);
  const b = await digest(right);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function isAdmin(request, env) {
  const match = /^Basic\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  if (!match || !env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) return false;
  try {
    const decoded = atob(match[1]);
    const separator = decoded.indexOf(':');
    if (separator < 0) return false;
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return await safeEqual(username, env.ADMIN_USERNAME) && await safeEqual(password, env.ADMIN_PASSWORD);
  } catch {
    return false;
  }
}

export function unauthorized() {
  return json({ error: 'Admin sign-in required.' }, 401);
}
