const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://47.100.239.29/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${data?.message || text}`);
  }
  return data;
}

function createSmokePhone() {
  return `199${String(Date.now()).slice(-8)}`;
}

async function main() {
  console.log(`[smoke] baseUrl=${baseUrl}`);

  const health = await request('/health');
  if (!health.ok) throw new Error('health check returned ok=false');
  console.log(`[smoke] health ok: ${health.service}`);

  if (process.env.LIFTMARK_SMOKE_SMS === '1') {
    const smsPhone = createSmokePhone();
    const sms = await request('/auth/send-code', {
      body: { phone: smsPhone, purpose: 'login' },
    });
    console.log(`[smoke] send-code ok provider=${sms.provider || 'unknown'} debugCode=${sms.debugCode ? 'present' : 'hidden'}`);
  } else {
    console.log('[smoke] send-code skipped. Set LIFTMARK_SMOKE_SMS=1 only when SMS_PROVIDER=mock.');
  }

  const phone = createSmokePhone();
  const password = `Lm${Date.now()}!`;
  const nickname = `Smoke${phone.slice(-4)}`;

  const registered = await request('/auth/register', {
    body: { phone, password, nickname },
  });
  if (!registered.accessToken || !registered.refreshToken) throw new Error('register did not return tokens');
  console.log(`[smoke] register ok user=${registered.user.id}`);

  const loggedIn = await request('/auth/login', {
    body: { account: phone, password },
  });
  if (!loggedIn.accessToken || !loggedIn.refreshToken) throw new Error('login did not return tokens');
  console.log('[smoke] login ok');

  const me = await request('/auth/me', { token: loggedIn.accessToken });
  if (me.user?.phone !== phone) throw new Error('me returned unexpected user');
  console.log('[smoke] me ok');

  const refreshed = await request('/auth/refresh', {
    body: { refreshToken: loggedIn.refreshToken },
  });
  if (!refreshed.accessToken || !refreshed.refreshToken) throw new Error('refresh did not return tokens');
  console.log('[smoke] refresh ok');

  console.log('[smoke] all checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

