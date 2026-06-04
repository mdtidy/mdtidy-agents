import { describe, expect, it } from 'vitest';

import { createMdtidyClient } from './client';
import { MdtidyApiError } from './errors';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createMdtidyClient', () => {
  it('sends X-API-KEY only (never Authorization: Bearer — blocked by mdtidy v1)', async () => {
    let xKey: string | null = null;
    let auth: string | null = null;
    const client = createMdtidyClient({
      apiKey: 'mt_test_abc',
      baseUrl: 'https://x.test',
      fetch: async (input, init) => {
        const req = input instanceof Request ? input : new Request(input, init);
        xKey = req.headers.get('x-api-key');
        auth = req.headers.get('authorization');
        return jsonResponse({
          subscriptionCredits: 5,
          topupCredits: 0,
          creditsRemaining: 5,
          periodEnd: null,
          callsThisPeriod: 0,
          recentCalls: [],
        });
      },
    });

    const { data } = await client.GET('/api/v1/usage', {});
    expect(xKey).toBe('mt_test_abc');
    expect(auth).toBeNull(); // Authorization: Bearer is reserved/blocked in mdtidy v1
    expect(data?.creditsRemaining).toBe(5);
  });

  it('maps an API error body to MdtidyApiError', async () => {
    const client = createMdtidyClient({
      apiKey: 'k',
      baseUrl: 'https://x.test',
      fetch: async () =>
        jsonResponse(
          { error: { code: 'out_of_credits', message: 'insufficient', requestId: 'r1' } },
          402,
        ),
    });

    await expect(
      client.POST('/api/v1/convert', { body: { markdown: '# h', format: 'text' } }),
    ).rejects.toBeInstanceOf(MdtidyApiError);
  });

  it('preserves the POST body through the timeout wrapper (regression: "expected non-null body source")', async () => {
    let received: string | null = null;
    const client = createMdtidyClient({
      apiKey: 'k',
      baseUrl: 'https://x.test',
      fetch: async (input, init) => {
        const req = input instanceof Request ? input : new Request(input, init);
        received = await req.text();
        return jsonResponse({
          format: 'text',
          contentType: 'text/plain',
          byteSize: 1,
          designSystem: 'minimal-clean',
          output: 'x',
          warnings: [],
          creditsCharged: 1,
          creditsRemaining: 1,
          requestId: 'r',
        });
      },
    });

    await client.POST('/api/v1/convert', { body: { markdown: '# h', format: 'text' } });
    expect(received).not.toBeNull();
    expect(JSON.parse(received!)).toEqual({ markdown: '# h', format: 'text' });
  });
});
