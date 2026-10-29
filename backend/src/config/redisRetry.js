
function redisReconnectStrategy(retries) {
  if (retries > 10) {
    return new Error("Redis reconnect limit reached");
  }

  return Math.min(retries * 500, 5000);
}

module.exports = { redisReconnectStrategy };
