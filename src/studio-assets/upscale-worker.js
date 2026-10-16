'use strict';
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function fileHash(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

// No built-in process launch: host must supply a reviewed OS-isolated runner.
// Its run method must settle only after its process tree has stopped on abort.
class UpscaleWorker {
  constructor({ root, runner, validateImage, register, authorize, manifest, timeoutMs = 300000, maxInputBytes = 25 * 1024 * 1024, maxOutputBytes = 128 * 1024 * 1024 }) {
    this.root = root; this.runner = runner; this.validateImage = validateImage; this.register = register; this.authorize = authorize; this.manifest = manifest;
    this.timeoutMs = timeoutMs; this.maxInputBytes = maxInputBytes; this.maxOutputBytes = maxOutputBytes; this.active = false;
  }
  async prerequisites() {
    const m = this.manifest;
    if (!m || m.approval !== 'owner-approved' || !m.licenseReview || !m.deviceVerified || !m.executable || !m.model || !m.executableSha256 || !m.modelSha256) fail('PREREQUISITES_PENDING');
    if (!this.runner || this.runner.isolation !== 'os-enforced' || typeof this.runner.run !== 'function' || typeof this.validateImage !== 'function' || typeof this.authorize !== 'function' || typeof this.register !== 'function') fail('ISOLATION_PENDING');
    for (const [file, hash] of [[m.executable, m.executableSha256], [m.model, m.modelSha256]]) {
      const stat = await fs.lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) fail('UNSAFE_PATH');
      if (await fileHash(file) !== hash) fail('PIN_MISMATCH');
    }
  }
  async run({ projectId, assetId, parentVersionId, originalVersionId, jobId, input, signal, onState = () => {} }) {
    if (this.active) fail('WORKER_BUSY');
    if (!(input instanceof Uint8Array) || !input.length) fail('MISSING_FILE');
    if (input.length > this.maxInputBytes) fail('TOO_LARGE');
    if (![projectId,assetId,parentVersionId,originalVersionId,jobId].every(v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(v))) fail('INVALID_JOB');
    const inputCopy = Buffer.from(input); const originalHash = sha256(inputCopy);
    this.active = true; const controller = new AbortController(); let timer; let directory; let root; let registered = false;
    const abort = () => controller.abort(); if (signal) { signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort(); }
    const check = () => { if (controller.signal.aborted) fail('CANCELLED'); };
    try {
      onState('checking'); check(); await this.prerequisites(); check();
      await this.authorize({ projectId, assetId, parentVersionId, originalVersionId, signal: controller.signal }); check();
      const inputInfo = await this.validateImage(inputCopy, { signal: controller.signal }); if (!inputInfo || !Number.isSafeInteger(inputInfo.pixels) || inputInfo.pixels > 16000000 || inputInfo.pixels < 1) fail('CORRUPT_MEDIA'); check();
      const rootStat = await fs.lstat(this.root); if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('UNSAFE_PATH');
      root = await fs.realpath(this.root); directory = await fs.mkdtemp(path.join(root, 'studio-job-'));
      if (path.dirname(directory) !== root) fail('UNSAFE_PATH');
      const inputPath = path.join(directory, 'input.png'); const outputPath = path.join(directory, 'output.png');
      await fs.writeFile(inputPath, inputCopy, { flag: 'wx', mode: 0o400 }); check(); onState('running');
      timer = setTimeout(() => controller.abort(), this.timeoutMs);
      check(); const outcome = await this.runner.run({ executable: this.manifest.executable, model: this.manifest.model, inputPath, outputPath, signal: controller.signal });
      clearTimeout(timer); check();
      if (!outcome || outcome.exitCode !== 0) fail('PROCESS_FAILED');
      onState('validating');
      const stat = await fs.lstat(outputPath); if (!stat.isFile() || stat.isSymbolicLink()) fail('UNSAFE_PATH');
      if (!stat.size || stat.size > this.maxOutputBytes) fail('OUTPUT_LIMIT');
      const output = await fs.readFile(outputPath); const info = await this.validateImage(output, { signal: controller.signal });
      if (!info || !Number.isSafeInteger(info.pixels) || info.pixels < 1 || info.pixels > 64000000) fail('CORRUPT_MEDIA');
      if (sha256(await fs.readFile(inputPath)) !== originalHash) fail('ORIGINAL_CHANGED');
      check(); await this.authorize({ projectId, assetId, parentVersionId, originalVersionId, signal: controller.signal }); check();
      onState('registering');
      const version = await this.register({ projectId, assetId, parentVersionId, originalVersionId, jobId, idempotencyKey: jobId, operation: 'upscale', bytes: output, inputSha256: originalHash, outputSha256: sha256(output), executableSha256: this.manifest.executableSha256, modelSha256: this.manifest.modelSha256, signal: controller.signal });
      // Host registration must be idempotent and authorize atomically at commit.
      registered = true; onState('succeeded'); return { version, inputSha256: originalHash, outputSha256: sha256(output) };
    } catch (error) {
      const code = controller.signal.aborted && !registered ? 'CANCELLED' : error.code || 'WORKER_FAILED';
      onState(code === 'CANCELLED' ? 'cancelled' : 'failed'); fail(code);
    } finally {
      clearTimeout(timer); if (signal) signal.removeEventListener('abort', abort);
      // The reviewed runner owns stopping its process tree before settlement.
      try {
        if (directory && root && path.dirname(directory) === root && path.basename(directory).startsWith('studio-job-')) await fs.rm(directory, { recursive: true, force: true });
      } finally { this.active = false; }
    }
  }
}
module.exports = { UpscaleWorker, sha256 };
