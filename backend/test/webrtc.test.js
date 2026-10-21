
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");

const User = require("../src/models/user.model");
const proximityService = require("../src/services/proximityService");

let httpServer;
let ioServer;
let serverUrl;
let nearbySocketIds = [];
const clients = [];

const originalFindOne = User.findOne;
const originalGetNearbyUsers = proximityService.getNearbyUsers;

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

async function registerUser(client, userId) {
  const registered = waitForEvent(client, "user:registered");
  client.emit("user:register", { userId });
  await registered;
}

before(async () => {
  // Mock database positions so tests do not modify MongoDB.
  User.findOne = ({ socketId }) => ({
    select() {
      return this;
    },
    lean: async () => ({
      socketId,
      location: [10, 20],
    }),
  });

  // Control which recipients the proximity service considers nearby.
  proximityService.getNearbyUsers = async ({ excludeSocketId }) =>
    nearbySocketIds
      .filter((socketId) => socketId !== excludeSocketId)
      .map((socketId) => ({
        socketId,
        x: 10,
        y: 20,
      }));

  httpServer = http.createServer();
  ioServer = new Server(httpServer);

  require("../src/sockets/socketUserMapping")
    .registerSocketUserMapping(ioServer);

  require("../src/sockets/webrtc")
    .registerWebRTCHandlers(ioServer);

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

  await new Promise((resolve) => ioServer.close(resolve));

  User.findOne = originalFindOne;
  proximityService.getNearbyUsers = originalGetNearbyUsers;
});

test("relays a valid offer to a nearby registered recipient", async () => {
  const sender = await connectClient();
  const recipient = await connectClient();

  await registerUser(sender, "day4-sender");
  await registerUser(recipient, "day4-recipient");

  nearbySocketIds = [recipient.id];

  const receivedOffer = waitForEvent(recipient, "webrtc:offer");

  sender.emit("webrtc:offer", {
    recipientUserId: "day4-recipient",
    sdp: {
      type: "offer",
      sdp: "test-offer-sdp",
    },
  });

  const payload = await receivedOffer;

  assert.equal(payload.senderUserId, "day4-sender");
  assert.equal(payload.sdp.type, "offer");
  assert.equal(payload.sdp.sdp, "test-offer-sdp");
});

test("rejects an offer when the recipient is not nearby", async () => {
  const sender = await connectClient();
  const recipient = await connectClient();

  await registerUser(sender, "day4-far-sender");
  await registerUser(recipient, "day4-far-recipient");

  nearbySocketIds = [];

  const errorEvent = waitForEvent(sender, "webrtc:error");

  sender.emit("webrtc:offer", {
    recipientUserId: "day4-far-recipient",
    sdp: {
      type: "offer",
      sdp: "test-offer-sdp",
    },
  });

  const error = await errorEvent;

  assert.equal(error.code, "RECIPIENT_NOT_NEARBY");
});

test("rejects an invalid SDP answer", async () => {
  const sender = await connectClient();

  await registerUser(sender, "day4-invalid-sdp");

  const errorEvent = waitForEvent(sender, "webrtc:error");

  sender.emit("webrtc:answer", {
    recipientUserId: "missing-recipient",
    sdp: {
      type: "offer",
      sdp: "wrong-sdp-type",
    },
  });

  const error = await errorEvent;

  assert.equal(error.code, "INVALID_SDP");
});

test("rejects an offer from an unregistered sender", async () => {
  const sender = await connectClient();

  const errorEvent = waitForEvent(sender, "webrtc:error");

  sender.emit("webrtc:offer", {
    recipientUserId: "unknown-recipient",
    sdp: {
      type: "offer",
      sdp: "test-offer-sdp",
    },
  });

  const error = await errorEvent;

  assert.equal(error.code, "SENDER_NOT_REGISTERED");
});

test("rejects an offer sent to the same user", async () => {
  const sender = await connectClient();

  await registerUser(sender, "day4-self-sender");

  const errorEvent = waitForEvent(sender, "webrtc:error");

  sender.emit("webrtc:offer", {
    recipientUserId: "day4-self-sender",
    sdp: {
      type: "offer",
      sdp: "test-offer-sdp",
    },
  });

  const error = await errorEvent;

  assert.equal(error.code, "INVALID_RECIPIENT");
});

test("relays a valid answer to a nearby registered recipient", async () => {
  const sender = await connectClient();
  const recipient = await connectClient();

  await registerUser(sender, "day4-answer-sender");
  await registerUser(recipient, "day4-answer-recipient");

  nearbySocketIds = [recipient.id];

  const receivedAnswer = waitForEvent(recipient, "webrtc:answer");

  sender.emit("webrtc:answer", {
    recipientUserId: "day4-answer-recipient",
    sdp: {
      type: "answer",
      sdp: "test-answer-sdp",
    },
  });

  const payload = await receivedAnswer;

  assert.equal(payload.senderUserId, "day4-answer-sender");
  assert.equal(payload.sdp.type, "answer");
  assert.equal(payload.sdp.sdp, "test-answer-sdp");
});
