export const SESSION_STATES = {
  REGISTERED: "registered",
  LIVE: "live",
  STALE: "stale",
  OFFLINE: "offline"
};

export class BridgeRuntimeError extends Error {
  constructor(code, message, { statusCode = 400, details } = {}) {
    super(message);
    this.name = "BridgeRuntimeError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function createSession(pluginId, now = Date.now()) {
  return {
    pluginId,
    registeredAt: now,
    lastSeenAt: now,
    lastHeartbeatAt: null,
    lastSelection: [],
    fileKey: null,
    fileName: null,
    pageId: null,
    pageName: null
  };
}

export function registerSession(session, body = {}, now = Date.now()) {
  session.lastSeenAt = now;
  if (typeof session.registeredAt !== "number") {
    session.registeredAt = now;
  }
  session.fileKey = typeof body.fileKey === "string" ? body.fileKey : null;
  session.fileName = typeof body.fileName === "string" ? body.fileName : null;
  session.pageId = typeof body.pageId === "string" ? body.pageId : null;
  session.pageName = typeof body.pageName === "string" ? body.pageName : null;
  return session;
}

export function markSessionHeartbeat(session, now = Date.now()) {
  session.lastSeenAt = now;
  session.lastHeartbeatAt = now;
  return session;
}

export function getSessionState(
  session,
  { now = Date.now(), activeWindowMs, retentionMs } = {}
) {
  if (!session) {
    return SESSION_STATES.OFFLINE;
  }

  const lastHeartbeatAt =
    typeof session.lastHeartbeatAt === "number" ? session.lastHeartbeatAt : null;
  if (lastHeartbeatAt === null) {
    return SESSION_STATES.REGISTERED;
  }

  const staleMs = Math.max(0, now - lastHeartbeatAt);
  if (staleMs <= activeWindowMs) {
    return SESSION_STATES.LIVE;
  }
  if (staleMs <= retentionMs) {
    return SESSION_STATES.STALE;
  }
  return SESSION_STATES.OFFLINE;
}

export function getSessionStaleMs(session, now = Date.now()) {
  if (!session) {
    return null;
  }
  if (typeof session.lastHeartbeatAt === "number") {
    return Math.max(0, now - session.lastHeartbeatAt);
  }
  if (typeof session.registeredAt === "number") {
    return Math.max(0, now - session.registeredAt);
  }
  if (typeof session.lastSeenAt === "number") {
    return Math.max(0, now - session.lastSeenAt);
  }
  return null;
}

export function preflightPluginCommand(
  pluginId,
  session,
  { now = Date.now(), activeWindowMs, retentionMs } = {}
) {
  const state = getSessionState(session, { now, activeWindowMs, retentionMs });
  const staleMs = getSessionStaleMs(session, now);

  if (state === SESSION_STATES.LIVE) {
    return { ok: true, state, staleMs };
  }

  if (state === SESSION_STATES.REGISTERED) {
    throw new BridgeRuntimeError(
      "ERR_PLUGIN_SESSION_REGISTERED",
      `Plugin session is registered but not live yet: ${pluginId}. Send heartbeat before command execution.`,
      {
        statusCode: 409,
        details: { pluginId, state, staleMs }
      }
    );
  }

  if (state === SESSION_STATES.STALE) {
    throw new BridgeRuntimeError(
      "ERR_PLUGIN_SESSION_STALE",
      `Plugin session is stale: ${pluginId}. Reconnect or refresh heartbeat.`,
      {
        statusCode: 409,
        details: { pluginId, state, staleMs }
      }
    );
  }

  throw new BridgeRuntimeError(
    "ERR_PLUGIN_SESSION_OFFLINE",
    `Plugin session is offline: ${pluginId}. Open the Figma plugin bridge and register again.`,
    {
      statusCode: 404,
      details: { pluginId, state, staleMs }
    }
  );
}

export function toSessionSnapshot(
  session,
  { now = Date.now(), activeWindowMs, retentionMs } = {}
) {
  const state = getSessionState(session, { now, activeWindowMs, retentionMs });
  const staleMs = getSessionStaleMs(session, now);
  return {
    pluginId: session.pluginId,
    fileKey: session.fileKey,
    fileName: session.fileName,
    pageId: session.pageId,
    pageName: session.pageName,
    registeredAt: session.registeredAt,
    lastSeenAt: session.lastSeenAt,
    lastHeartbeatAt: session.lastHeartbeatAt,
    selectionCount: Array.isArray(session.lastSelection) ? session.lastSelection.length : 0,
    state,
    active: state === SESSION_STATES.LIVE,
    staleMs
  };
}
