import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AmountString, InstantString, buildOpenApiDocument, defineRoute } from '../src';
import { renderSpec, SPEC_FILE } from '../scripts/generate-openapi';

/** Resolves every `$ref` as a JSON pointer against the document root: catches `#/$defs/...` leaks. */
export function unresolvedRefs(doc: unknown): string[] {
  const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"([^"]+)"/g)].map((m) => m[1] ?? '');
  return refs.filter((ref) => {
    if (!ref.startsWith('#/')) return true;
    let node: unknown = doc;
    for (const part of ref.slice(2).split('/')) node = (node as Record<string, unknown> | undefined)?.[part];
    return node === undefined;
  });
}

type Doc = {
  openapi: string;
  paths: Record<string, Record<string, Record<string, unknown>>>;
  components: { schemas: Record<string, Record<string, unknown>> };
};

describe('generated API specification', () => {
  it('docs/architecture/api/openapi.json is up to date (run `pnpm api:spec` if this fails)', () => {
    expect(readFileSync(SPEC_FILE, 'utf8')).toBe(renderSpec());
  });

  it('is OpenAPI 3.1 and EVERY $ref resolves inside the document', () => {
    const doc = JSON.parse(renderSpec()) as Doc;
    expect(doc.openapi).toBe('3.1.0');
    expect(JSON.stringify(doc)).toContain('"$ref"');
    expect(unresolvedRefs(doc)).toEqual([]);
  });
});

describe('buildOpenApiDocument', () => {
  const Body = z.object({ amount: z.string() }).meta({ id: 'SpendBody' });
  const Result = z.object({ ok: z.literal(true) }).meta({ id: 'SpendResult' });
  const route = defineRoute({
    id: 'economy.spend',
    method: 'POST',
    path: '/cities/{cityId}/spend',
    summary: 'test route',
    tags: ['economy'],
    auth: 'session',
    idempotent: true,
    request: {
      params: z.object({ cityId: z.uuid() }),
      query: z.object({ dryRun: z.boolean().optional() }),
      body: Body,
    },
    responses: { 201: { description: 'spent', schema: Result } },
    errors: ['INSUFFICIENT_RESOURCES', 'NOT_FOUND'],
  });
  const op = (buildOpenApiDocument([route], 'test') as Doc).paths['/cities/{cityId}/spend']?.post as {
    parameters: { name: string; in: string; required: boolean }[];
    requestBody: unknown;
    responses: Record<string, { description: string }>;
  };

  it('declares path, query and Idempotency-Key header parameters', () => {
    expect(op.parameters.map((p) => [p.in, p.name, p.required])).toEqual([
      ['path', 'cityId', true],
      ['query', 'dryRun', false],
      ['header', 'Idempotency-Key', true],
    ]);
  });

  it('references named body and response components', () => {
    expect(JSON.stringify(op.requestBody)).toContain('#/components/schemas/SpendBody');
    expect(JSON.stringify(op.responses['201'])).toContain('#/components/schemas/SpendResult');
  });

  it('declares security on every operation: none for public routes, a session for the others', () => {
    const doc = buildOpenApiDocument([route], 'test') as Doc & { components: { securitySchemes?: object } };
    expect((op as unknown as { security: unknown }).security).toEqual([{ session: [] }]);
    expect(doc.components.securitySchemes).toHaveProperty('session');
    const pub = JSON.parse(renderSpec()) as Doc & { components: { securitySchemes?: object } };
    for (const item of Object.values(pub.paths))
      for (const o of Object.values(item)) expect(o.security).toEqual([]);
    expect(pub.components.securitySchemes).toBeUndefined(); // no session routes yet
  });

  it('lists route, auth, idempotency and generic error codes grouped by status', () => {
    expect(op.responses['401']?.description).toBe('Error codes: UNAUTHENTICATED');
    expect(op.responses['404']?.description).toBe('Error codes: NOT_FOUND');
    expect(op.responses['422']?.description).toBe(
      'Error codes: IDEMPOTENCY_KEY_REUSED, INSUFFICIENT_RESOURCES',
    );
    expect(op.responses['400']?.description).toBe('Error codes: IDEMPOTENCY_KEY_REQUIRED, VALIDATION_FAILED');
  });

  it('refuses bodies without a component id', () => {
    const bad = defineRoute({
      ...route,
      id: 'economy.bad',
      request: { ...route.request, body: z.object({ x: z.int() }) },
    });
    expect(() => buildOpenApiDocument([bad], 'test')).toThrow(/meta\(\{ id \}\)/);
  });

  it('describes codecs by their wire form and nests named schemas as resolvable components', () => {
    const Money = z.object({ ore: AmountString, at: InstantString }).meta({ id: 'Money' });
    const Nested = z.object({ price: Money }).meta({ id: 'NestedBody' });
    const nested = defineRoute({
      ...route,
      id: 'economy.nested',
      request: { ...route.request, body: Nested },
    });
    const doc = buildOpenApiDocument([nested], 'test') as Doc;
    expect(doc.components.schemas.Money).toMatchObject({
      properties: { ore: { type: 'string' }, at: { type: 'string', format: 'date-time' } },
    });
    expect(JSON.stringify(doc.components.schemas.NestedBody)).toContain('#/components/schemas/Money');
    expect(unresolvedRefs(doc)).toEqual([]);
    expect(Object.keys(doc.components.schemas)).not.toContain('SpendBody'); // only reachable components
  });
});
