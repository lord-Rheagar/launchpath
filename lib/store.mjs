import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export class Store {
  constructor(directory) { this.directory = directory; this.queues = new Map(); }
  async init() { await mkdir(this.directory, { recursive: true }); }
  filename(kind, id) {
    if (!['run','guide'].includes(kind) || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('Invalid record identifier.');
    return join(this.directory, `${kind}-${id}.json`);
  }
  async save(kind, record) {
    const filename = this.filename(kind, record.id);
    // Capture now; serialize writes to avoid late event snapshots replacing terminal state.
    const content = JSON.stringify(record, null, 2);
    const prior = this.queues.get(filename) || Promise.resolve();
    const write = prior.catch(() => {}).then(async () => {
      const temp = `${filename}.tmp`;
      await writeFile(temp, content, { mode: 0o600 });
      // Windows antivirus/indexers or a concurrent reader can briefly lock the target.
      // Retain the last good snapshot and retry replacement; never unlink it first.
      for (let attempt = 0; ; attempt++) {
        try { await rename(temp, filename); break; }
        catch (error) {
          if (!['EPERM','EBUSY','EACCES'].includes(error.code) || attempt >= 6) throw error;
          await new Promise(resolve => setTimeout(resolve, 15 * 2 ** attempt));
        }
      }
    });
    this.queues.set(filename, write);
    try { await write; } finally { if (this.queues.get(filename) === write) this.queues.delete(filename); }
  }
  async get(kind, id) {
    try { return JSON.parse(await readFile(this.filename(kind,id), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  }
  async list(kind) {
    const names = (await readdir(this.directory)).filter(n => n.startsWith(`${kind}-`) && n.endsWith('.json'));
    return Promise.all(names.map(n => this.get(kind, n.slice(kind.length+1,-5))));
  }
  async recover() {
    for (const run of await this.list('run')) if (['queued','running'].includes(run.status)) {
      run.status = 'interrupted'; run.finishedAt = new Date().toISOString();
      run.error = 'The server restarted before this research finished. Start a new run; saved evidence is preserved.';
      await this.save('run',run);
    }
  }
}
