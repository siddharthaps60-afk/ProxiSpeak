
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { redisReconnectStrategy } = require("../src/config/redisRetry");

test("uses increasing reconnect delays capped at 5000 ms", () => {
  assert.equal(redisReconnectStrategy(0), 0);
  assert.equal(redisReconnectStrategy(1), 500);
  assert.equal(redisReconnectStrategy(2), 1000);
  assert.equal(redisReconnectStrategy(5), 2500);
  assert.equal(redisReconnectStrategy(10), 5000);
});

test("stops reconnecting after more than 10 retries", () => {
  const result = redisReconnectStrategy(11);

  assert.ok(result instanceof Error);
  assert.equal(result.message, "Redis reconnect limit reached");
});
