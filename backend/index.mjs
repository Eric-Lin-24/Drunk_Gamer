// index.mjs — ESM ONLY (Node.js 24 Lambda)
// NO require(), NO import assertions.
// cards.json must be in the same folder as this file.
// Env vars: TABLE_NAME (required), CORS_ORIGIN (optional)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// --- load cards.json safely without import assertions ---
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const cardsPath = path.join(__dirname, "cards.json");

let cards = [];
try {
  const raw = fs.readFileSync(cardsPath, "utf-8");
  cards = JSON.parse(raw);
} catch (e) {
  // keep cards as []
  console.error("Failed to load cards.json:", e);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE_NAME = process.env.TABLE_NAME;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

/* ---------- helpers ---------- */

function resp(statusCode, body, contentType = "application/json") {
  return {
    statusCode,
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    },
    body: contentType === "application/json" ? JSON.stringify(body) : String(body)
  };
}

function ok(body) {
  return resp(200, body);
}

function bad(code, message, detail) {
  const out = { error: message };
  if (detail) out.detail = detail;
  return resp(code, out);
}

function safeJsonParse(s) {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function clampName(name) {
  const s = String(name ?? "").trim();
  if (!s) return null;
  return s.slice(0, 24);
}

function getRoomIdFromStatePath(p) {
  const idx = p.lastIndexOf("/state/");
  if (idx === -1) return null;
  return decodeURIComponent(p.slice(idx + "/state/".length)).trim().toUpperCase();
}

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

function hideSecrets(roomItem) {
  if (!roomItem) return roomItem;
  const { deckOrder, ...safe } = roomItem;
  return safe;
}

/* ---------- cards index ---------- */

const CARDS_OK = Array.isArray(cards) && cards.length > 0;
const CARD_IDS = CARDS_OK ? cards.map((c) => c.id) : [];
const CARD_BY_ID = new Map((CARDS_OK ? cards : []).map((c) => [c.id, c]));

/* ---------- handler ---------- */

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const p = event.requestContext?.http?.path || event.rawPath || event.path || "";

  // CORS preflight
  if (method === "OPTIONS") return resp(204, {});

  // Setup checks
  if (!TABLE_NAME) return bad(500, "Server error", "Missing TABLE_NAME env var");
  if (!CARDS_OK) return bad(500, "Server error", "cards.json missing/empty/invalid");

  try {
    // GET /testing
    if (method === "GET" && p.endsWith("/testing")) {
      return resp(200, "HELLO", "text/plain");
    }

    // POST /create-room
    if (method === "POST" && p.endsWith("/create-room")) {
      const body = safeJsonParse(event.body);
      const hostName = clampName(body.hostName) || "Host";

      const roomId = makeRoomId();
      const createdAt = Date.now();
      const expiresAt = nowSec() + 2 * 60 * 60;

      const deckSeed = Math.floor(Math.random() * 2 ** 31);
      const deckOrder = shuffleWithSeed(CARD_IDS, deckSeed);

      const room = {
        roomId,
        createdAt,
        expiresAt,
        status: "active",
        players: [{ id: crypto.randomUUID(), name: hostName, joinedAt: Date.now() }],
        deckSeed,
        deckOrder,
        deckPos: 0,
        cardCounter: 0,
        currentCard: null,
        currentRound: 1,
        activeRules: []
      };

      await ddb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: room,
        ConditionExpression: "attribute_not_exists(roomId)"
      }));

      return ok({ roomId });
    }

    // POST /add-player
    if (method === "POST" && p.endsWith("/add-player")) {
      const body = safeJsonParse(event.body);
      const roomId = String(body.roomId || "").trim().toUpperCase();
      const name = clampName(body.name);

      if (!roomId || !name) return bad(400, "roomId and name required");

      const { Item: room } = await ddb.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { roomId }
      }));
      if (!room) return bad(404, "Room not found");
      if (room.status !== "active") return bad(409, "Room not active");

      const players = Array.isArray(room.players) ? room.players : [];
      const exists = players.some((pl) => (pl?.name || "").toLowerCase() === name.toLowerCase());
      if (exists) return bad(409, "Name already exists");

      const newPlayer = { id: crypto.randomUUID(), name, joinedAt: Date.now() };

      await ddb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { roomId },
        UpdateExpression: "SET players = list_append(if_not_exists(players, :empty), :p), expiresAt = :exp",
        ExpressionAttributeValues: {
          ":p": [newPlayer],
          ":empty": [],
          ":exp": nowSec() + 2 * 60 * 60
        }
      }));

      return ok({ ok: true, player: newPlayer });
    }

    // POST /remove-player
    if (method === "POST" && p.endsWith("/remove-player")) {
      const body = safeJsonParse(event.body);
      const roomId = String(body.roomId || "").trim().toUpperCase();
      const playerId = String(body.playerId || "").trim();

      if (!roomId || !playerId) return bad(400, "roomId and playerId required");

      const { Item: room } = await ddb.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { roomId }
      }));
      if (!room) return bad(404, "Room not found");

      const players = Array.isArray(room.players) ? room.players : [];
      const nextPlayers = players.filter((pl) => pl?.id !== playerId);

      await ddb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { roomId },
        UpdateExpression: "SET players = :p, expiresAt = :exp",
        ExpressionAttributeValues: {
          ":p": nextPlayers,
          ":exp": nowSec() + 2 * 60 * 60
        }
      }));

      return ok({ ok: true });
    }

    // POST /next-card
    if (method === "POST" && p.endsWith("/next-card")) {
      const body = safeJsonParse(event.body);
      const roomId = String(body.roomId || "").trim().toUpperCase();
      if (!roomId) return bad(400, "roomId required");

      const { Item: room } = await ddb.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { roomId }
      }));
      if (!room) return bad(404, "Room not found");
      if (room.status !== "active") return bad(409, "Room not active");

      const players = Array.isArray(room.players) ? room.players : [];
      if (players.length < 1) return bad(400, "Need at least 1 player");

      let deckSeed = typeof room.deckSeed === "number" ? room.deckSeed : Math.floor(Math.random() * 2 ** 31);
      let deckOrder = Array.isArray(room.deckOrder) ? room.deckOrder : null;
      let deckPos = typeof room.deckPos === "number" ? room.deckPos : 0;

      if (!deckOrder || deckOrder.length !== CARD_IDS.length) {
        deckSeed = Math.floor(Math.random() * 2 ** 31);
        deckOrder = shuffleWithSeed(CARD_IDS, deckSeed);
        deckPos = 0;
      }

      if (deckPos >= deckOrder.length) {
        deckSeed = Math.floor(Math.random() * 2 ** 31);
        deckOrder = shuffleWithSeed(CARD_IDS, deckSeed);
        deckPos = 0;
      }

      const cardId = deckOrder[deckPos];
      const c = CARD_BY_ID.get(cardId);
      if (!c) return bad(500, "Server error", `Card not found for id: ${cardId}`);

      const currentCard = {
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category || null,
        shownAt: Date.now()
      };

      // Round and active rules logic
      const realPlayers = players.filter(p => p.name !== "Host");
      const numPlayers = realPlayers.length || 1;
      const currentCardCounter = Number(room.cardCounter || 0);
      const newCardCounter = currentCardCounter + 1;
      
      let currentRound = Number(room.currentRound || 1);
      let activeRules = Array.isArray(room.activeRules) ? room.activeRules : [];
      
      // Calculate current player index (0-based, before increment)
      const currentPlayerIndex = currentCardCounter % numPlayers;
      const currentPlayerId = realPlayers[currentPlayerIndex]?.id;
      
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
      if (c.category) {
        const match = c.category.match(/^(person|group)_round_based:(\d+)$/);
        if (match) {
          const ruleType = match[1]; // "person" or "group"
          const rounds = parseInt(match[2], 10);
          
          activeRules.push({
            ruleId: crypto.randomUUID(),
            cardTitle: c.title,
            cardDescription: c.description,
            type: ruleType,
            playerId: ruleType === "person" ? currentPlayerId : null,
            playerName: ruleType === "person" ? realPlayers[currentPlayerIndex]?.name : null,
            roundsRemaining: rounds,
            addedInRound: currentRound
          });
        }
      }

      await ddb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { roomId },
        UpdateExpression:
          "SET currentCard = :card, deckSeed = :seed, deckOrder = :order, deckPos = :pos, cardCounter = :counter, currentRound = :round, activeRules = :rules, expiresAt = :exp",
        ExpressionAttributeValues: {
          ":card": currentCard,
          ":seed": deckSeed,
          ":order": deckOrder,
          ":pos": deckPos + 1,
          ":counter": newCardCounter,
          ":round": currentRound,
          ":rules": activeRules,
          ":exp": nowSec() + 2 * 60 * 60
        }
      }));

      return ok({ ok: true, currentCard, currentRound, activeRules });
    }

    // POST /reset
    if (method === "POST" && p.endsWith("/reset")) {
      const body = safeJsonParse(event.body);
      const roomId = String(body.roomId || "").trim().toUpperCase();
      if (!roomId) return bad(400, "roomId required");

      await ddb.send(new UpdateCommand({
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

      return ok({ ok: true });
    }

    // GET /state/{roomId}
    if (method === "GET" && p.includes("/state/")) {
      const roomId = getRoomIdFromStatePath(p);
      if (!roomId) return bad(400, "roomId required");

      const { Item } = await ddb.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { roomId }
      }));
      if (!Item) return bad(404, "Room not found");

      return ok(hideSecrets(Item));
    }

    return bad(404, "Not found", `${method} ${p}`);
  } catch (err) {
    console.error("Lambda error:", err);
    return bad(500, "Server error", String(err?.message || err));
  }
}