// index.js (Node.js 20) — CommonJS
// Required env: TABLE_NAME
// Optional env: CORS_ORIGIN (e.g. http://localhost:5173 or your S3/CloudFront domain)
//
// Requires cards.json in the same folder (pack into the Lambda zip).

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");

const cards = require("./cards.json");

const TABLE_NAME = process.env.TABLE_NAME;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

// ---------------- helpers ----------------

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function roomId6() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function clampName(name) {
  const s = String(name ?? "").trim();
  if (!s) return null;
  return s.slice(0, 24);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function safeParse(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

// Deterministic RNG for shuffle
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed(arr, seed) {
  const out = arr.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// API Gateway HTTP API may include stage prefixes.
// We'll match routes using endsWith.
function getPath(event) {
  return (
    event?.requestContext?.http?.path ||
    event?.rawPath ||
    event?.path ||
    ""
  );
}

function getMethod(event) {
  return event?.requestContext?.http?.method || event?.httpMethod || "";
}

function roomIdFromStatePath(path) {
  const idx = path.lastIndexOf("/state/");
  if (idx === -1) return null;
  return decodeURIComponent(path.slice(idx + "/state/".length)).trim().toUpperCase();
}

// Cards indexing
const CARDS_OK = Array.isArray(cards) && cards.length > 0;
const CARD_IDS = CARDS_OK ? cards.map((c) => c.id) : [];
const CARD_BY_ID = new Map((CARDS_OK ? cards : []).map((c) => [c.id, c]));

// ---------------- handler ----------------

exports.handler = async (event) => {
  const method = getMethod(event);
  const path = getPath(event);

  try {
    // Preflight
    if (method === "OPTIONS") return json(200, { ok: true });

    // Hard fail with clear message if TABLE_NAME missing
    if (!TABLE_NAME) return json(500, { error: "Server error", detail: "Missing TABLE_NAME env var" });
    if (!CARDS_OK) return json(500, { error: "Server error", detail: "cards.json missing/empty/invalid" });

    const body = method === "POST" ? safeParse(event.body) : {};
    if (method === "POST" && body === null) return json(400, { error: "Invalid JSON body" });

    // -------- POST /create-room --------
    if (method === "POST" && path.endsWith("/create-room")) {
      const hostName = clampName(body.hostName) || "Host";

      const roomId = roomId6();
      const createdAt = nowSec();
      const expiresAt = createdAt + 2 * 60 * 60;

      const deckSeed = Math.floor(Math.random() * 2 ** 31);
      const deckOrder = shuffleWithSeed(CARD_IDS, deckSeed);

      const room = {
        roomId,
        createdAt,
        expiresAt,
        status: "active",
        players: [{ playerId: crypto.randomUUID(), name: hostName }],
        deckSeed,
        deckOrder,
        deckPos: 0,
        cardCounter: 0,
        currentCard: null,
        currentRound: 1,
        activeRules: []
      };

      await db.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: room,
        ConditionExpression: "attribute_not_exists(roomId)"
      }));

      // Don't leak deckOrder to client
      const { deckOrder: _, ...safe } = room;
      return json(200, safe);
    }

    // -------- POST /add-player --------
    if (method === "POST" && path.endsWith("/add-player")) {
      const roomId = String(body.roomId || "").trim().toUpperCase();
      const name = clampName(body.name);

      if (!roomId) return json(400, { error: "roomId required" });
      if (!name) return json(400, { error: "name required" });

      const { Item } = await db.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { roomId }
      }));

      if (!Item) return json(404, { error: "Room not found" });
      if (Item.status !== "active") return json(400, { error: "Room not active" });

      const players = Array.isArray(Item.players) ? Item.players : [];
      const exists = players.some((p) => (p?.name || "").toLowerCase() === name.toLowerCase());
      if (exists) return json(409, { error: "Name already exists" });

      const newPlayer = { playerId: crypto.randomUUID(), name };

      await db.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { roomId },
        UpdateExpression: "SET players = list_append(if_not_exists(players, :empty), :p), expiresAt = :exp",
        ExpressionAttributeValues: {
          ":p": [newPlayer],
          ":empty": [],
          ":exp": nowSec() + 2 * 60 * 60
        }
      }));

      return json(200, { success: true, player: newPlayer });
    }

    // -------- POST /remove-player --------
    if (method === "POST" && path.endsWith("/remove-player")) {
      const roomId = String(body.roomId || "").trim().toUpperCase();
      const playerId = String(body.playerId || "").trim();

      if (!roomId || !playerId) return json(400, { error: "roomId and playerId required" });

      const { Item } = await db.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { roomId }
      }));
      if (!Item) return json(404, { error: "Room not found" });

      const players = Array.isArray(Item.players) ? Item.players : [];
      const updated = players.filter((p) => p?.playerId !== playerId);

      await db.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { roomId },
        UpdateExpression: "SET players = :players, expiresAt = :exp",
        ExpressionAttributeValues: {
          ":players": updated,
          ":exp": nowSec() + 2 * 60 * 60
        }
      }));

      return json(200, { success: true });
    }

    // -------- POST /next-card --------
    if (method === "POST" && path.endsWith("/next-card")) {
      const roomId = String(body.roomId || "").trim().toUpperCase();
      if (!roomId) return json(400, { error: "roomId required" });

      const { Item } = await db.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { roomId }
      }));

      if (!Item) return json(404, { error: "Room not found" });
      if (Item.status !== "active") return json(400, { error: "Room not active" });

      let deckOrder = Array.isArray(Item.deckOrder) ? Item.deckOrder : null;
      let deckPos = typeof Item.deckPos === "number" ? Item.deckPos : 0;
      let deckSeed = typeof Item.deckSeed === "number" ? Item.deckSeed : Math.floor(Math.random() * 2 ** 31);

      // Initialize deck if missing/mismatched
      if (!deckOrder || deckOrder.length !== CARD_IDS.length) {
        deckSeed = Math.floor(Math.random() * 2 ** 31);
        deckOrder = shuffleWithSeed(CARD_IDS, deckSeed);
        deckPos = 0;
      }

      // Reshuffle when exhausted
      if (deckPos >= deckOrder.length) {
        deckSeed = Math.floor(Math.random() * 2 ** 31);
        deckOrder = shuffleWithSeed(CARD_IDS, deckSeed);
        deckPos = 0;
      }

      const cardId = deckOrder[deckPos];
      const card = CARD_BY_ID.get(cardId) || { id: cardId, title: "Unknown Card", description: "Card not found." };

      const currentCard = {
        id: card.id,
        title: card.title,
        description: card.description,
        category: card.category || null,
        shownAt: nowSec()
      };

      // Round and active rules logic
      const players = Array.isArray(Item.players) ? Item.players : [];
      const realPlayers = players.filter(p => p.name !== "Host");
      const numPlayers = realPlayers.length || 1;
      const currentCardCounter = Number(Item.cardCounter || 0);
      const newCardCounter = currentCardCounter + 1;
      
      let currentRound = Number(Item.currentRound || 1);
      let activeRules = Array.isArray(Item.activeRules) ? Item.activeRules : [];
      
      // Calculate current player index (0-based, before increment)
      const currentPlayerIndex = currentCardCounter % numPlayers;
      const currentPlayerId = realPlayers[currentPlayerIndex]?.playerId;
      
      // Decrement person-based rules for the current player (their turn is ending)
      activeRules = activeRules.map(rule => {
        if (rule.type === "person" && rule.playerId === currentPlayerId) {
          return { ...rule, roundsRemaining: rule.roundsRemaining - 1 };
        }
        return rule;
      }).filter(rule => rule.roundsRemaining > 0);
      
      // Check if we completed a full round (all players had a turn)
      // Decrement group-based rules when round completes
      if (newCardCounter > 0 && newCardCounter % numPlayers === 0) {
        currentRound++;
        
        activeRules = activeRules.map(rule => {
          if (rule.type === "group") {
            return { ...rule, roundsRemaining: rule.roundsRemaining - 1 };
          }
          return rule;
        }).filter(rule => rule.roundsRemaining > 0);
      }
      
      // Check if this card is round-based and add to active rules
      if (card.category) {
        const match = card.category.match(/^(person|group)_round_based:(\d+)$/);
        if (match) {
          const ruleType = match[1]; // "person" or "group"
          const rounds = parseInt(match[2], 10);
          
          activeRules.push({
            ruleId: crypto.randomUUID(),
            cardTitle: card.title,
            cardDescription: card.description,
            type: ruleType,
            playerId: ruleType === "person" ? currentPlayerId : null,
            playerName: ruleType === "person" ? realPlayers[currentPlayerIndex]?.name : null,
            roundsRemaining: rounds,
            addedInRound: currentRound
          });
        }
      }

      await db.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { roomId },
        UpdateExpression:
          "SET currentCard = :card, deckOrder = :order, deckPos = :pos, deckSeed = :seed, cardCounter = :counter, currentRound = :round, activeRules = :rules, expiresAt = :exp",
        ExpressionAttributeValues: {
          ":card": currentCard,
          ":order": deckOrder,
          ":pos": deckPos + 1,
          ":seed": deckSeed,
          ":counter": newCardCounter,
          ":round": currentRound,
          ":rules": activeRules,
          ":exp": nowSec() + 2 * 60 * 60
        }
      }));

      return json(200, { success: true, card: currentCard, currentRound, activeRules });
    }

    // -------- POST /reset --------
    if (method === "POST" && path.endsWith("/reset")) {
      const roomId = String(body.roomId || "").trim().toUpperCase();
      if (!roomId) return json(400, { error: "roomId required" });

      await db.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { roomId },
        UpdateExpression: "SET currentCard = :n, deckPos = :z, cardCounter = :z, currentRound = :one, activeRules = :empty, expiresAt = :exp",
        ExpressionAttributeValues: {
          ":n": null,
          ":z": 0,
          ":one": 1,
          ":empty": [],
          ":exp": nowSec() + 2 * 60 * 60
        }
      }));

      return json(200, { success: true });
    }

    // -------- GET /state/{roomId} --------
    if (method === "GET" && path.includes("/state/")) {
      const roomId = roomIdFromStatePath(path);
      if (!roomId) return json(400, { error: "roomId required" });

      const { Item } = await db.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { roomId }
      }));

      if (!Item) return json(404, { error: "Room not found" });

      // Hide deckOrder so client can't peek the upcoming cards
      const { deckOrder, ...safe } = Item;
      return json(200, safe);
    }

    return json(404, { error: "Not found" });
  } catch (e) {
    console.error("Lambda error:", e);
    return json(500, { error: "Server error", detail: String(e?.message || e) });
  }
};
