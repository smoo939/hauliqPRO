export async function postJson(url: string, body: unknown) {
  let session = null;
  try {
    const raw = localStorage.getItem('hauliq_replit_session');
    session = raw ? JSON.parse(raw) : null;
  } catch {
    session = null;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { data: null, error: payload.error || { message: 'Request failed' }, count: null };
  }
  return payload;
}

export async function queryServer(payload: Record<string, unknown>) {
  return postJson('/api/db/query', payload);
}
