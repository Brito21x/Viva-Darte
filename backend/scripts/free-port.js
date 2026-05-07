const { execSync } = require('child_process');

const portArg = process.argv[2];
const port = Number.isFinite(Number(portArg)) ? Number(portArg) : 3000;

if (process.platform !== 'win32') {
  process.exit(0);
}

function getPidsListeningOnPort(targetPort) {
  try {
    const output = execSync(`netstat -ano -p tcp | findstr :${targetPort}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const pids = new Set();
    for (const line of lines) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.split(/\s+/);
      const localAddress = parts[1] || '';
      const pid = Number(parts[parts.length - 1]);
      if (!localAddress.endsWith(`:${targetPort}`)) continue;
      if (!Number.isFinite(pid) || pid <= 0) continue;
      pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

const pids = getPidsListeningOnPort(port).filter((pid) => pid !== process.pid);
if (!pids.length) process.exit(0);

for (const pid of pids) {
  killPid(pid);
}

