import { spawn } from 'node:child_process';

const port = Number.parseInt(process.env.PORT ?? '3100', 10);
const baseUrl = `http://127.0.0.1:${port}`;
const command = process.platform === 'win32' ? 'node_modules\\.bin\\next.cmd' : './node_modules/.bin/next';

const expectedRoutes = [
  { path: '/login', status: 200 },
  { path: '/dashboard', status: 307, locationIncludes: '/login?next=%2Fdashboard' },
  { path: '/settings', status: 307, locationIncludes: '/login?next=%2Fsettings' },
  { path: '/people/export', status: 307, locationIncludes: '/login?next=%2Fpeople%2Fexport' },
  { path: '/people/import/template', status: 307, locationIncludes: '/login?next=%2Fpeople%2Fimport%2Ftemplate' },
  { path: '/api/version', status: 200, bodyIncludes: '"name":"hutka"' },
  { path: '/api/telegram/digest', status: 401 },
  { path: '/s/demo', status: 200 },
  { path: '/q/demo-token', status: 404 }
];

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForServer(processRef) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (processRef.exitCode !== null) break;

    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.status === 200) return;
    } catch {
      // Retry until next start is accepting connections.
    }

    await wait(1000);
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function checkRoute(route) {
  const response = await fetch(`${baseUrl}${route.path}`, { redirect: 'manual' });
  const body = route.bodyIncludes ? await response.text() : '';
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

  return {
    path: route.path,
    status: response.status,
    location: location || null
  };
}

async function checkHealth() {
  const response = await fetch(`${baseUrl}/api/health`, { redirect: 'manual' });
  if (response.status !== 200) {
    throw new Error(`/api/health: expected 200, got ${response.status}`);
  }

  const health = await response.json();
  const blockers = Array.isArray(health.blockers) ? health.blockers : [];

  if (health.ok === true) {
    if (health.status !== 'healthy' || blockers.length > 0) {
      throw new Error(`/api/health is inconsistent: ${JSON.stringify({ ok: health.ok, status: health.status, blockers })}`);
    }
  } else if (health.status !== 'needs_attention' || blockers.length === 0) {
    throw new Error(`/api/health is inconsistent: ${JSON.stringify({ ok: health.ok, status: health.status, blockers })}`);
  }

  return {
    path: '/api/health',
    status: response.status,
    health: health.status,
    blockers: blockers.map((check) => check.id)
  };
}

const server = spawn(command, ['start', '-p', String(port)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env
});

let output = '';
server.stdout.on('data', (chunk) => {
  output += chunk;
});
server.stderr.on('data', (chunk) => {
  output += chunk;
});

try {
  await waitForServer(server);
  const results = [];

  for (const route of expectedRoutes) {
    results.push(await checkRoute(route));
  }

  results.push(await checkHealth());
  console.log(JSON.stringify({ baseUrl, results }, null, 2));
} catch (error) {
  console.error(output.trim());
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  server.kill();
}
