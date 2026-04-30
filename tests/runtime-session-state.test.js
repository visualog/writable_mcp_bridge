import test from "node:test";
import assert from "node:assert/strict";

import {
  BridgeRuntimeError,
  SESSION_STATES,
  createSession,
  getSessionRecencyAt,
  getSessionState,
  markSessionHeartbeat,
  preflightPluginCommand,
  registerSession,
  toSessionSnapshot
} from "../src/runtime-session-state.js";

const ACTIVE_WINDOW_MS = 50;
const RETENTION_MS = 200;

test("session state transitions from registered to live to stale to offline", () => {
  const now = 1000;
  const session = createSession("file:abc", now);

  registerSession(session, { fileName: "Demo" }, now);
  assert.equal(
    getSessionState(session, {
      now: now + 10,
      activeWindowMs: ACTIVE_WINDOW_MS,
      retentionMs: RETENTION_MS
    }),
    SESSION_STATES.REGISTERED
  );

  markSessionHeartbeat(session, now + 20);
  assert.equal(
    getSessionState(session, {
      now: now + 40,
      activeWindowMs: ACTIVE_WINDOW_MS,
      retentionMs: RETENTION_MS
    }),
    SESSION_STATES.LIVE
  );

  assert.equal(
    getSessionState(session, {
      now: now + 120,
      activeWindowMs: ACTIVE_WINDOW_MS,
      retentionMs: RETENTION_MS
    }),
    SESSION_STATES.STALE
  );

  assert.equal(
    getSessionState(session, {
      now: now + 250,
      activeWindowMs: ACTIVE_WINDOW_MS,
      retentionMs: RETENTION_MS
    }),
    SESSION_STATES.OFFLINE
  );
});

test("preflight allows only live sessions", () => {
  const now = 5000;
  const session = createSession("file:live", now);
  markSessionHeartbeat(session, now);

  const accepted = preflightPluginCommand("file:live", session, {
    now: now + 20,
    activeWindowMs: ACTIVE_WINDOW_MS,
    retentionMs: RETENTION_MS
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.state, SESSION_STATES.LIVE);

  registerSession(session, {}, now + 40);
  session.lastHeartbeatAt = null;
  assert.throws(
    () =>
      preflightPluginCommand("file:live", session, {
        now: now + 50,
        activeWindowMs: ACTIVE_WINDOW_MS,
        retentionMs: RETENTION_MS
      }),
    (error) =>
      error instanceof BridgeRuntimeError &&
      error.code === "ERR_PLUGIN_SESSION_REGISTERED"
  );

  markSessionHeartbeat(session, now);
  assert.throws(
    () =>
      preflightPluginCommand("file:live", session, {
        now: now + 120,
        activeWindowMs: ACTIVE_WINDOW_MS,
        retentionMs: RETENTION_MS
      }),
    (error) =>
      error instanceof BridgeRuntimeError && error.code === "ERR_PLUGIN_SESSION_STALE"
  );

  assert.throws(
    () =>
      preflightPluginCommand("file:live", session, {
        now: now + 300,
        activeWindowMs: ACTIVE_WINDOW_MS,
        retentionMs: RETENTION_MS
      }),
    (error) =>
      error instanceof BridgeRuntimeError && error.code === "ERR_PLUGIN_SESSION_OFFLINE"
  );

  assert.throws(
    () =>
      preflightPluginCommand("file:missing", null, {
        now: now + 10,
        activeWindowMs: ACTIVE_WINDOW_MS,
        retentionMs: RETENTION_MS
      }),
    (error) =>
      error instanceof BridgeRuntimeError && error.code === "ERR_PLUGIN_SESSION_OFFLINE"
  );
});

test("session snapshot includes explicit state and heartbeat metadata", () => {
  const now = 9000;
  const session = createSession("file:xyz", now);
  registerSession(session, { pageId: "12:1", pageName: "Page 1" }, now);
  markSessionHeartbeat(session, now + 10);
  session.lastSelection = [{ id: "node-1" }, { id: "node-2" }];

  const snapshot = toSessionSnapshot(session, {
    now: now + 20,
    activeWindowMs: ACTIVE_WINDOW_MS,
    retentionMs: RETENTION_MS
  });

  assert.equal(snapshot.pluginId, "file:xyz");
  assert.equal(snapshot.state, SESSION_STATES.LIVE);
  assert.equal(snapshot.active, true);
  assert.equal(snapshot.selectionCount, 2);
  assert.equal(snapshot.pageId, "12:1");
  assert.equal(snapshot.lastHeartbeatAt, now + 10);
});

test("session snapshot preserves plugin ui metrics when present", () => {
  const now = 12000;
  const session = createSession("file:metrics", now);
  registerSession(session, { fileName: "Metrics File" }, now);
  markSessionHeartbeat(session, now + 5);
  session.uiMetrics = {
    generatedAt: "2026-04-14T00:00:00.000Z",
    polls: 12,
    commandFetches: 7,
    pollDrivenReads: {
      runtime: 3,
      detail: 1
    },
    eventDrivenReads: {
      sessions: 4,
      runtime: 5,
      detail: 2
    },
    transport: {
      bridgeConnected: true,
      eventsConnected: true,
      wsCommandConnected: false
    }
  };

  const snapshot = toSessionSnapshot(session, {
    now: now + 10,
    activeWindowMs: ACTIVE_WINDOW_MS,
    retentionMs: RETENTION_MS
  });

  assert.deepEqual(snapshot.uiMetrics, session.uiMetrics);
  assert.equal(snapshot.pluginId, "file:metrics");
  assert.equal(snapshot.fileName, "Metrics File");
  assert.equal(snapshot.state, SESSION_STATES.LIVE);
});

test("session recency prefers heartbeat, then seen, then registration timestamps", () => {
  const registeredOnly = createSession("file:registered", 1000);
  assert.equal(getSessionRecencyAt(registeredOnly), 1000);

  const seenSession = createSession("file:seen", 2000);
  seenSession.lastSeenAt = 2050;
  assert.equal(getSessionRecencyAt(seenSession), 2050);

  const liveSession = createSession("file:live", 3000);
  liveSession.lastSeenAt = 3060;
  liveSession.lastHeartbeatAt = 3090;
  assert.equal(getSessionRecencyAt(liveSession), 3090);

  assert.equal(getSessionRecencyAt(null), 0);
});
