/**
 * tapStream — splits a response body into two readable streams without buffering.
 * One is returned to the client (the actual response), the other is consumed
 * line-by-line on the server for metering purposes.
 */

export function tapStream(input: ReadableStream<Uint8Array>): {
  toClient: ReadableStream<Uint8Array>;
  toMeter: ReadableStream<Uint8Array>;
} {
  const [a, b] = input.tee();
  return { toClient: a, toMeter: b };
}

/** Read an SSE-style stream as text chunks (newline-delimited). */
export async function* readSseChunks(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buf.trim()) yield buf;
        return;
      }
      buf += decoder.decode(value, { stream: true });
      let nl = buf.indexOf('\n\n');
      while (nl >= 0) {
        const chunk = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        if (chunk.trim()) yield chunk;
        nl = buf.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Parse `data: {...}` SSE payload lines and yield the JSON objects. */
export function parseSseData(chunk: string): unknown[] {
  const out: unknown[] = [];
  for (const line of chunk.split('\n')) {
    const m = line.match(/^data:\s*(.*)$/);
    if (!m) continue;
    const payload = m[1]!.trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      out.push(JSON.parse(payload));
    } catch {
      // ignore non-JSON SSE lines
    }
  }
  return out;
}
