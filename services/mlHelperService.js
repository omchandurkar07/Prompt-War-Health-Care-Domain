const axios = require('axios');
const { spawn, execFile } = require('child_process');
const path = require('path');

const ML_URL = process.env.ML_URL || 'http://localhost:5001';
const ML_SERVER_SCRIPT = path.join(__dirname, '..', 'ml_server.py');
const PYTHON_COMMANDS = process.env.ML_PYTHON_COMMAND
  ? [process.env.ML_PYTHON_COMMAND]
  : process.platform === 'win32'
    ? ['python', 'python3', 'py']
    : ['python3', 'python'];

let helperProcess = null;
let startingPromise = null;

const validatePythonCommand = async (pythonCmd) => {
  return new Promise((resolve) => {
    execFile(pythonCmd, ['-c', 'import flask'], { timeout: 3000 }, (err) => {
      if (err) {
        console.warn(`[ML Helper] Python command ${pythonCmd} skipped:`, err.message || err);
        return resolve(false);
      }
      resolve(true);
    });
  });
};

const isMlHelperAlive = async () => {
  try {
    const response = await axios.get(`${ML_URL}/api/ml-symptoms`, { timeout: 2500 });
    return response && response.status === 200;
  } catch {
    return false;
  }
};

const logProcessOutput = (stream, prefix) => {
  stream.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      console.log(`[ML Helper] ${prefix}: ${text}`);
    }
  });
};

const waitForHelperReady = () => {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 15000;

    const check = async () => {
      if (await isMlHelperAlive()) {
        return resolve();
      }

      if (Date.now() > deadline) {
        return reject(new Error('Timed out waiting for ML helper service to become available.'));
      }

      setTimeout(check, 500);
    };

    check();
  });
};

const spawnMlHelper = (pythonCmd) => {
  if (helperProcess) {
    return helperProcess;
  }

  const child = spawn(pythonCmd, [ML_SERVER_SCRIPT], {
    cwd: path.resolve(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  helperProcess = child;
  logProcessOutput(child.stdout, 'stdout');
  logProcessOutput(child.stderr, 'stderr');

  child.on('exit', (code, signal) => {
    console.warn(`[ML Helper] Process exited with code=${code} signal=${signal}`);
    helperProcess = null;
  });

  child.on('error', (err) => {
    console.error('[ML Helper] Spawn error:', err.message || err);
    helperProcess = null;
  });

  return child;
};

const startMlHelper = async () => {
  if (startingPromise) {
    return startingPromise;
  }

  startingPromise = (async () => {
    if (await isMlHelperAlive()) {
      console.log('[ML Helper] Service already running.');
      return;
    }

    let lastError = null;
    for (const pythonCmd of PYTHON_COMMANDS) {
      const isValid = await validatePythonCommand(pythonCmd);
      if (!isValid) {
        continue;
      }

      try {
        console.log(`[ML Helper] Attempting to start ML helper with command: ${pythonCmd}`);
        spawnMlHelper(pythonCmd);
        await waitForHelperReady();
        console.log('[ML Helper] Service is now available.');
        return;
      } catch (err) {
        lastError = err;
        console.warn(`[ML Helper] Failed to start with ${pythonCmd}: ${err.message}`);
      }
    }

    throw new Error(`Unable to start ML helper service. Last error: ${lastError?.message || 'unknown'}`);
  })();

  try {
    return await startingPromise;
  } finally {
    startingPromise = null;
  }
};

module.exports = {
  ML_URL,
  startMlHelper,
  isMlHelperAlive,
};
