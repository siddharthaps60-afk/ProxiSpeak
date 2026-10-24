
const { createServer } = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");

const {
  registerSocketUserMapping,
  getSocketId,
  getUserId,
} = require("../src/sockets/socketUserMapping");

const httpServer = createServer();
const io = new Server(httpServer);

registerSocketUserMapping(io);

let port;
const clients = [];

function connectClient() {
  return new Promise((resolve, reject) => {
    const client = createClient(`http://127.0.0.1:${port}`, {
      forceNew: true,
    });

    clients.push(client);

    client.once("connect", () => resolve(client));
    client.once("connect_error", reject);
  });
}

function waitForEvent(client, eventName) {
  return new Promise((resolve) => {
    client.once(eventName, resolve);
  });
}

async function runTests() {
  try {
    await new Promise((resolve) => {
      httpServer.listen(0, "127.0.0.1", resolve);
    });

    port = httpServer.address().port;

    // Test 1: Valid registration.
    const first = await connectClient();
    const registeredPromise = waitForEvent(first, "user:registered");

    first.emit("user:register", { userId: "test-user-1" });

    const registered = await registeredPromise;

    if (
      registered.userId !== "test-user-1" ||
      getSocketId("test-user-1") !== first.id ||
      getUserId(first.id) !== "test-user-1"
    ) {
      throw new Error("Valid registration test failed");
    }

    console.log("PASS: valid registration");

    // Test 2: Invalid registration.
    const invalidPromise = waitForEvent(first, "user:error");

    first.emit("user:register", { userId: "" });

    const invalid = await invalidPromise;

    if (invalid.code !== "INVALID_USER_ID") {
      throw new Error("Invalid registration test failed");
    }

    console.log("PASS: invalid registration rejected");

    // Test 3: Duplicate registration.
    const second = await connectClient();
    const duplicatePromise = waitForEvent(second, "user:error");

    second.emit("user:register", { userId: "test-user-1" });

    const duplicate = await duplicatePromise;

    if (duplicate.code !== "USER_ALREADY_REGISTERED") {
      throw new Error("Duplicate registration test failed");
    }

    console.log("PASS: duplicate registration rejected");

    // Test 4: Disconnect cleanup.
    const serverSocket = io.sockets.sockets.get(first.id);

    if (!serverSocket) {
      throw new Error("Server socket not found");
    }

    const disconnectedPromise = new Promise((resolve) => {
      serverSocket.once("disconnect", resolve);
    });

    first.disconnect();

    await Promise.race([
      disconnectedPromise,
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Disconnect event timed out")),
          3000
        );
      }),
    ]);

    if (
      getSocketId("test-user-1") !== null ||
      getUserId(first.id) !== null
    ) {
      throw new Error("Disconnect cleanup test failed");
    }

    console.log("PASS: disconnect cleanup");
  } finally {
    for (const client of clients) {
      client.disconnect();
    }

    await new Promise((resolve) => io.close(resolve));
  }
}

runTests().catch((error) => {
  console.error("TEST FAILED:", error.message);
  process.exitCode = 1;
});
