
require("dotenv").config();

const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { createClient } = require("redis");
const { Server } = require("socket.io");
const { io: createSocketClient } = require("socket.io-client");
const { createAdapter } = require("@socket.io/redis-adapter");

test(
  "relays room broadcasts between two Socket.IO instances through Redis",
  { timeout: 20000 },
  async () => {
    assert.ok(process.env.REDIS_URL, "REDIS_URL is missing from backend/.env");

    const redisClients = Array.from({ length: 4 }, () =>
      createClient({ url: process.env.REDIS_URL })
    );

    let httpServerA;
    let httpServerB;
    let serverA;
    let serverB;
    let clientA;
    let clientB;

    try {
      await Promise.all(redisClients.map((client) => client.connect()));

      httpServerA = http.createServer();
      httpServerB = http.createServer();

      serverA = new Server(httpServerA);
      serverB = new Server(httpServerB);

      serverA.adapter(createAdapter(redisClients[0], redisClients[1]));
      serverB.adapter(createAdapter(redisClients[2], redisClients[3]));

      serverB.on("connection", async (socket) => {
        await socket.join("redis-integration-room");
        socket.emit("room-ready");
      });

      const listen = (httpServer) =>
        new Promise((resolve, reject) => {
          httpServer.once("error", reject);
          httpServer.listen(0, "127.0.0.1", () => {
            httpServer.removeListener("error", reject);
            resolve();
          });
        });

      await Promise.all([listen(httpServerA), listen(httpServerB)]);

      const urlA = `http://127.0.0.1:${httpServerA.address().port}`;
      const urlB = `http://127.0.0.1:${httpServerB.address().port}`;

      clientA = createSocketClient(urlA, {
        forceNew: true,
        reconnection: false,
      });

      clientB = createSocketClient(urlB, {
        forceNew: true,
        reconnection: false,
      });

      const connect = (client) =>
        new Promise((resolve, reject) => {
          client.once("connect", resolve);
          client.once("connect_error", reject);
        });

      // Start listening before connecting so we don't miss the room-ready event.
const roomReady = new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    reject(new Error("Client B did not confirm joining the room"));
  }, 5000);

  clientB.once("room-ready", () => {
    clearTimeout(timer);
    resolve();
  });

  clientB.once("connect_error", (error) => {
    clearTimeout(timer);
    reject(error);
  });
});

await Promise.all([connect(clientA), connect(clientB)]);
await roomReady;

      const received = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("Cross-instance broadcast timed out"));
        }, 5000);

        clientB.once("cross-instance-message", (message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });

      serverA.to("redis-integration-room").emit("cross-instance-message", {
        message: "hello from instance A",
      });

      assert.deepEqual(await received, {
        message: "hello from instance A",
      });
    } finally {
      clientA?.disconnect();
      clientB?.disconnect();

      if (serverA) {
        await new Promise((resolve) => serverA.close(resolve));
      } else if (httpServerA?.listening) {
        await new Promise((resolve) => httpServerA.close(resolve));
      }

      if (serverB) {
        await new Promise((resolve) => serverB.close(resolve));
      } else if (httpServerB?.listening) {
        await new Promise((resolve) => httpServerB.close(resolve));
      }

      await Promise.all(
        redisClients.map(async (client) => {
          if (client.isOpen) {
            await client.quit();
          }
        })
      );
    }
  }
);
