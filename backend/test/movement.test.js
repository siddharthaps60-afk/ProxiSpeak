const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");

const User = require("../src/models/user.model");

let httpServer;
let ioServer;
let serverUrl;

const clients = [];

const originalFindOneAndUpdate = User.findOneAndUpdate;
const originalFindOneAndDelete = User.findOneAndDelete;

function waitForEvent(socket, eventName, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeout);

    function handler(data) {
      clearTimeout(timer);
      resolve(data);
    }

    socket.once(eventName, handler);
  });
}

async function connectClient() {
  const client = createClient(serverUrl, {
    forceNew: true,
    reconnection: false,
  });

  clients.push(client);
  await waitForEvent(client, "connect");

  return client;
}

before(async () => {
  // Mock database updates so tests do not require MongoDB.
  User.findOneAndUpdate = async (...args) => ({
    query: args[0],
    update: args[1],
    options: args[2],
  });

  // Prevent disconnect handlers from attempting database operations.
  User.findOneAndDelete = async () => null;

  httpServer = http.createServer();
  ioServer = new Server(httpServer);

  require("../src/sockets/movement").registerMovementHandlers(ioServer);

  await new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });

  serverUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  for (const client of clients) {
    if (client.connected) {
      client.disconnect();
    }
  }

  if (ioServer) {
    await new Promise((resolve) => ioServer.close(resolve));
  }

  // Restore the original Mongoose methods.
  User.findOneAndUpdate = originalFindOneAndUpdate;
  User.findOneAndDelete = originalFindOneAndDelete;
});

test("valid movement updates position and broadcasts it", async () => {
  const sender = await connectClient();
  const receiver = await connectClient();

  const broadcast = waitForEvent(receiver, "player:moved");

  sender.emit("player:move", { x: 100, y: 200 });

  const payload = await broadcast;

  assert.equal(payload.socketId, sender.id);
  assert.deepEqual(payload.location, { x: 100, y: 200 });
});

test("invalid coordinate types are ignored", async () => {
  const sender = await connectClient();
  const receiver = await connectClient();

  let updateCalled = false;

  User.findOneAndUpdate = async () => {
    updateCalled = true;
  };

  const broadcastPromise = waitForEvent(receiver, "player:moved", 500);

  sender.emit("player:move", { x: "100", y: 200 });

  await assert.rejects(broadcastPromise, /Timed out/);

  assert.equal(updateCalled, false);
});
test("validates coordinate boundaries", async () => {
  const sender = await connectClient();
  const receiver = await connectClient();

  let updateCalled = false;

  User.findOneAndUpdate = async (...args) => {
    updateCalled = true;
    return {
      query: args[0],
      update: args[1],
      options: args[2],
    };
  };

  const broadcastPromise = waitForEvent(receiver, "player:moved", 500);

  sender.emit("player:move", { x: -1, y: 200 });

  await assert.rejects(broadcastPromise, /Timed out/);
  assert.equal(updateCalled, false);
});
