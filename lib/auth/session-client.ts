/** Whether the visitor is signed in to Prismconnex, asked of the existing session endpoint (the cookie is httpOnly). */
export async function isSignedIn() {
  try {
    return (await fetch('/api/auth/me', { cache: 'no-store' })).ok;
  } catch {
    return false;
  }
}
