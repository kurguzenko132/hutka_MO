const baseUrl = (process.env.BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
  console.error('Set BASE_URL to the deployed app URL, for example: BASE_URL=https://hutka-mo.vercel.app pnpm smoke:url');
  process.exit(1);
}

const routes = [
  { path: '/', status: 307, locationIncludes: '/login' },
  { path: '/login', status: 200 },
  { path: '/dashboard', status: 307, locationIncludes: '/login?next=%2Fdashboard' },
  { path: '/settings', status: 307, locationIncludes: '/login?next=%2Fsettings' },
  { path: '/people/export', status: 307, locationIncludes: '/login?next=%2Fpeople%2Fexport' },
  { path: '/api/version', status: 200, bodyIncludes: '"name":"hutka"' },
  { path: '/api/telegram/digest', status: 401 }
];

async function readText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function checkRoute(route) {
  const response = await fetch(`${baseUrl}${route.path}`, { redirect: 'manual' });
  const body = route.bodyIncludes ? await readText(response) : '';
  const location = response.headers.get('location') ?? '';

  if (response.status !== route.status) {
    throw new Error(`${route.path}: expected ${route.status}, got ${response.status}`);
  }

  if (route.locationIncludes && !location.includes(route.locationIncludes)) {
    throw new Error(`${route.path}: expected location containing ${route.locationIncludes}, got ${location || '<empty>'}`);
  }

  if (route.bodyIncludes && !body.includes(route.bodyIncludes)) {
    throw new Error(`${route.path}: expected body containing ${route.bodyIncludes}`);
  }

  return { path: route.path, status: response.status, location: location || null };
}

async function checkHealth() {
  const response = await fetch(`${baseUrl}/api/health`, { redirect: 'manual' });
  if (response.status !== 200) {
    throw new Error(`/api/health: expected 200, got ${response.status}`);
  }

  const health = await response.json();
  const checks = new Map((health.checks ?? []).map((check) => [check.id, check.status]));
  const blockers = Array.isArray(health.blockers) ? health.blockers : [];
  const requiredOk = ['supabase-public-env', 'service-role', 'node-runtime'];
  const missingOrBad = requiredOk.filter((id) => checks.get(id) !== 'ok');

  if (health.ok !== true || health.status !== 'healthy' || blockers.length > 0 || missingOrBad.length > 0) {
    throw new Error(`/api/health is not production-ready: ${JSON.stringify({
      ok: health.ok,
      status: health.status,
      blockers,
      missingOrBad,
      checks: health.checks
    })}`);
  }

  return { path: '/api/health', status: response.status, checks: health.checks };
}

try {
  const results = [];

  for (const route of routes) {
    results.push(await checkRoute(route));
  }

  results.push(await checkHealth());
  console.log(JSON.stringify({ baseUrl, results }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
