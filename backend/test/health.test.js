
const test = require("node:test");
const assert = require("node:assert/strict");

test("health endpoint reports backend and Redis status", async () => {
  const redisClient = require("../src/config/redis");
  const app = require("../app");

  const originalIsReady = redisClient.isReady;
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));

    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/health`;

    // Test when Redis is ready.
    Object.defineProperty(redisClient, "isReady", {
      configurable: true,
      value: true,
    });

    const healthyResponse = await fetch(url);
    const healthyBody = await healthyResponse.json();

    assert.equal(healthyResponse.status, 200);
    assert.deepEqual(healthyBody, {
      success: true,
      backend: "ok",
      redis: "connected",
    });

    // Test when Redis is not ready.
    Object.defineProperty(redisClient, "isReady", {
      configurable: true,
      value: false,
    });

    const unhealthyResponse = await fetch(url);
    const unhealthyBody = await unhealthyResponse.json();

    assert.equal(unhealthyResponse.status, 503);
    assert.deepEqual(unhealthyBody, {
      success: false,
      backend: "ok",
      redis: "disconnected",
    });
  } finally {
    Object.defineProperty(redisClient, "isReady", {
      configurable: true,
      value: originalIsReady,
    });

    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
