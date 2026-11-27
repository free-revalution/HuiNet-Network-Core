/**
 * Outbound internet bridge for local agents.
 * Hub stays on 127.0.0.1; agents ask the hub to fetch the public web.
 */

export interface NetFetchRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface NetFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  truncated: boolean;
  ms: number;
}

const MAX_BODY = 256 * 1024;
const BLOCKED_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.google.com',
]);

function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Only http/https allowed');
  }
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.startsWith('169.254.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    BLOCKED_HOSTS.has(host)
  ) {
    throw new Error('Private / link-local / metadata hosts are blocked');
  }
  return u;
}

export async function netFetch(req: NetFetchRequest): Promise<NetFetchResult> {
  const url = assertSafeUrl(req.url);
  const method = (req.method || 'GET').toUpperCase();
  const timeoutMs = Math.min(Math.max(req.timeoutMs || 15000, 1000), 60000);
  const started = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: req.headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : req.body,
      signal: controller.signal,
      redirect: 'follow',
    });

    const buf = Buffer.from(await res.arrayBuffer());
    const truncated = buf.length > MAX_BODY;
    const slice = truncated ? buf.subarray(0, MAX_BODY) : buf;
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      url: res.url || url.toString(),
      headers,
      body: slice.toString('utf-8'),
      truncated,
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}
