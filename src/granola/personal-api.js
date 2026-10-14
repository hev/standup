// Node/server only. Never bundle credentials or candidate content into a public app.
export class ConnectorError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
export class PersonalAPI {
  constructor({token = process.env.GRANOLA_API_KEY, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), maxPages = 1000, retries = 3} = {}) {
    if (!token) throw new ConnectorError('GRANOLA_API_KEY_REQUIRED');
    Object.assign(this, {token, fetchImpl, sleep, maxPages, retries});
  }
  async get(path, params = {}) {
    const url = new URL('https://public-api.granola.ai/v1/' + path);
    for (const [k,v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      let response;
      try { response = await this.fetchImpl(url, {headers:{Authorization:'Bearer ' + this.token}, redirect:'error', signal:AbortSignal.timeout(30000)}); }
      catch { if (attempt === this.retries) throw new ConnectorError('GRANOLA_NETWORK_FAILURE'); }
      if (response?.ok) {
        try { return await response.json(); } catch { throw new ConnectorError('GRANOLA_INVALID_JSON'); }
      }
      if (response && response.status !== 429 && response.status < 500) throw new ConnectorError('GRANOLA_HTTP_' + response.status, response.status);
      if (attempt === this.retries) throw new ConnectorError('GRANOLA_RETRIES_EXHAUSTED', response?.status);
      const retry = response?.headers.get('retry-after');
      const delay = retry ? (/^\d+(\.\d+)?$/.test(retry) ? Number(retry)*1000 : Date.parse(retry)-Date.now()) : 500*2**attempt;
      if (!Number.isFinite(delay) || delay > 60000) throw new ConnectorError('GRANOLA_RETRY_LATER');
      await this.sleep(Math.max(0, delay));
    }
  }
  async *pages(path, key, params = {}, cursor = null) {
    const seen = new Set();
    for (let page = 0; page < this.maxPages; page++) {
      const data = await this.get(path, {...params, cursor});
      if (!Array.isArray(data[key]) || typeof data.hasMore !== 'boolean') throw new ConnectorError('GRANOLA_INVALID_PAGE');
      if (data.hasMore && (!data.cursor || typeof data.cursor !== 'string' || seen.has(data.cursor) || data.cursor === cursor)) throw new ConnectorError('GRANOLA_CURSOR_LOOP');
      yield data;
      if (!data.hasMore) return;
      seen.add(data.cursor); cursor = data.cursor;
    }
    throw new ConnectorError('GRANOLA_PAGE_LIMIT');
  }
  async note(id) {
    if (!/^[\w-]+$/.test(id)) throw new ConnectorError('GRANOLA_INVALID_ID');
    const path = 'notes/' + encodeURIComponent(id);
    // Separate transcript endpoint avoids oversized-inline responses entirely.
    const note = await this.get(path);
    const transcript = [];
    for await (const page of this.pages(path + '/transcript', 'transcript', {page_size:100})) transcript.push(...page.transcript);
    if (note.id !== id || transcript.some(t => typeof t.text !== 'string')) throw new ConnectorError('GRANOLA_INVALID_NOTE');
    return {...note, transcript};
  }
}
