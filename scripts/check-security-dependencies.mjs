import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
const dbRequire = createRequire(new URL('../packages/db/package.json', import.meta.url));
const aiRequire = createRequire(new URL('../packages/ai/package.json', import.meta.url));
const openAiRequire = createRequire(aiRequire.resolve('@ai-sdk/openai'));
const providerRequire = createRequire(openAiRequire.resolve('@ai-sdk/provider-utils'));
const nextRequire = createRequire(require.resolve('next'));
const { Agent, fetch } = providerRequire('undici');
const { sql } = dbRequire('drizzle-orm');
const { PgDialect } = dbRequire('drizzle-orm/pg-core');

// Exercise the identifier-escaping behavior fixed by the ORM security update.
assert.equal(new PgDialect().sqlToQuery(sql`select ${sql.identifier('a"b')}`).sql, 'select "a""b"');
assert.equal(require('next/package.json').version, '16.3.3');
assert.equal(nextRequire('sharp').versions.sharp, '0.35.4');
assert.equal(providerRequire('undici/package.json').version, '6.28.0');

// The SDK uses Agent({connect:{lookup}}) with fetch. Verify that contract on a
// loopback-only fixture, without API keys, external traffic, or personal records.
const server = createServer((_request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.end('{"ok":true}');
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert.ok(address && typeof address === 'object');
let lookupUsed = false;
const dispatcher = new Agent({
  connect: {
    lookup(_hostname, options, callback) {
      lookupUsed = true;
      if (options.all) callback(null, [{ address: '127.0.0.1', family: 4 }]);
      else callback(null, '127.0.0.1', 4);
    },
  },
});
try {
  const response = await fetch(`http://fixture.invalid:${address.port}/`, {
    dispatcher,
    signal: AbortSignal.timeout(5000),
  });
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(lookupUsed, true);
  console.log('Patched versions, SQL identifier escaping, and SDK HTTP-client compatibility passed.');
} finally {
  await dispatcher.close();
  server.close();
  await once(server, 'close');
}
