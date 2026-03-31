import http from "node:http";
import { randomUUID } from "node:crypto";
import {
  buildApplyStylePlan,
  listSupportedApplyStyleTypes
} from "./apply-style.js";
import {
  buildBindVariablePlan,
  listSupportedBindVariableFields
} from "./bind-variable.js";
import {
  buildCreateComponentPlan,
  listSupportedCreateComponentSourceTypes
} from "./create-component.js";
import { buildCreateComponentSetPlan } from "./create-component-set.js";
import { buildCreateNodePlan, listSupportedCreateNodeTypes } from "./create-node.js";
import { buildFileComponentSearchPlan, searchFileComponents } from "./file-components.js";
import {
  buildImportLibraryComponentPlan,
  listSupportedImportLibraryAssetTypes
} from "./import-library-component.js";
import {
  buildDesignSystemSearchPlan,
  mergeDesignSystemSearchResults
} from "./design-system-search.js";
import { buildLibraryAssetSearchPlan, searchLibraryAssets } from "./library-assets.js";
import { buildSearchInstancesPlan } from "./search-instances.js";
import { buildReplayPlan } from "./replay-snapshot.js";
import { buildSnapshotPlan } from "./scene-snapshot.js";
import { buildSetComponentPropertiesPlan } from "./set-component-properties.js";
import { buildSearchNodesPlan } from "./node-discovery.js";

const DEFAULT_PORTS = [3846, 3847, 3848, 3849];
const REQUESTED_PORT = process.env.PORT ? Number(process.env.PORT) : null;
const CANDIDATE_PORTS = REQUESTED_PORT
  ? [REQUESTED_PORT, ...DEFAULT_PORTS.filter((port) => port !== REQUESTED_PORT)]
  : DEFAULT_PORTS;
const TOOL_TIMEOUT_MS = Number(process.env.TOOL_TIMEOUT_MS || 30000);
const pluginSessions = new Map();
const pendingCommands = new Map();
const pendingResults = new Map();
let activeHttpPort = null;

function ensurePluginSession(pluginId) {
  if (!pluginSessions.has(pluginId)) {
    pluginSessions.set(pluginId, {
      pluginId,
      lastSeenAt: Date.now(),
      lastSelection: [],
      fileKey: null,
      fileName: null
    });
  }

  return pluginSessions.get(pluginId);
}

function resolveActivePluginId(pluginId) {
  const normalized = pluginId || "default";

  if (normalized !== "default") {
    return normalized;
  }

  if (pluginSessions.has("default")) {
    return "default";
  }

  const activePluginIds = Array.from(pluginSessions.keys());
  if (activePluginIds.length === 1) {
    return activePluginIds[0];
  }

  if (activePluginIds.length > 1) {
    throw new Error(
      `Multiple active plugin sessions: ${activePluginIds.join(", ")}. Specify pluginId explicitly.`
    );
  }

  return normalized;
}

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk.toString("utf8");
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function withTimeout(promise, ms, message) {
  let timeoutId = null;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function createPendingCommand(pluginId, type, payload) {
  const commandId = randomUUID();
  const command = {
    commandId,
    pluginId,
    type,
    payload,
    createdAt: Date.now(),
    deliveredAt: null
  };

  pendingCommands.set(commandId, command);
  return command;
}

function waitForResult(commandId) {
  return new Promise((resolve, reject) => {
    pendingResults.set(commandId, { resolve, reject });
  });
}

async function executePluginCommand(pluginId, type, payload = {}) {
  const resolvedPluginId = resolveActivePluginId(pluginId);
  ensurePluginSession(resolvedPluginId);
  const command = createPendingCommand(resolvedPluginId, type, payload);

  return withTimeout(
    waitForResult(command.commandId),
    TOOL_TIMEOUT_MS,
    `Timed out waiting for plugin response: ${type}`
  );
}

function completeCommand(commandId, result, error) {
  const resolver = pendingResults.get(commandId);
  if (!resolver) {
    return;
  }

  pendingResults.delete(commandId);
  pendingCommands.delete(commandId);

  if (error) {
    resolver.reject(new Error(error));
    return;
  }

  resolver.resolve(result);
}

function cleanupExpiredCommands() {
  const now = Date.now();
  for (const [commandId, command] of pendingCommands.entries()) {
    if (now - command.createdAt > TOOL_TIMEOUT_MS) {
      completeCommand(commandId, null, `Command expired: ${command.type}`);
    }
  }
}

setInterval(cleanupExpiredCommands, 5000).unref();

const httpServer = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      jsonResponse(res, 200, {
        ok: true,
        server: "writable-mcp-bridge",
        port: activeHttpPort,
        activePlugins: Array.from(pluginSessions.keys())
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/get-selection") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "get_selection"
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/get-metadata") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "get_metadata",
        {
          targetNodeId: body.targetNodeId,
          maxDepth: body.maxDepth,
          maxNodes: body.maxNodes
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/get-variable-defs") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "get_variable_defs",
        {
          targetNodeId: body.targetNodeId,
          maxDepth: body.maxDepth,
          maxNodes: body.maxNodes
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/list-text-nodes") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "list_text_nodes",
        {
          targetNodeId: body.targetNodeId
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search-nodes") {
      const body = await readJsonBody(req);
      const plan = buildSearchNodesPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "search_nodes",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/snapshot-selection") {
      const body = await readJsonBody(req);
      const plan = buildSnapshotPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "snapshot_selection",
        {
          targetNodeId: body.targetNodeId,
          maxDepth: plan.maxDepth,
          maxNodes: plan.maxNodes,
          placeholderInstances: plan.placeholderInstances
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search-library-assets") {
      const body = await readJsonBody(req);
      const plan = buildLibraryAssetSearchPlan(body);
      const result = await searchLibraryAssets(plan, {
        accessToken: process.env.FIGMA_ACCESS_TOKEN
      });
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search-design-system") {
      const body = await readJsonBody(req);
      const plan = buildDesignSystemSearchPlan(body);
      const localResult = await executePluginCommand(
        body.pluginId || "default",
        "search_design_system",
        plan
      );
      const sources = [localResult];

      if (plan.fileKeys.length > 0 && (plan.sources.includes("all") || plan.sources.includes("library-files"))) {
        for (const fileKey of plan.fileKeys) {
          if (plan.includeComponents || plan.includeStyles) {
            sources.push(
              await searchLibraryAssets(
                {
                  fileKey,
                  query: plan.query,
                  assetTypes: [
                    ...(plan.includeComponents ? ["COMPONENT", "COMPONENT_SET"] : []),
                    ...(plan.includeStyles ? ["STYLE"] : [])
                  ],
                  maxResults: plan.maxResults
                },
                {
                  accessToken: process.env.FIGMA_ACCESS_TOKEN
                }
              )
            );
          }

          if (plan.includeComponents) {
            sources.push(
              await searchFileComponents(
                {
                  fileKey,
                  query: plan.query,
                  maxResults: plan.maxResults
                },
                {
                  accessToken: process.env.FIGMA_ACCESS_TOKEN
                }
              )
            );
          }
        }
      }

      const result = mergeDesignSystemSearchResults(sources, plan);
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search-instances") {
      const body = await readJsonBody(req);
      const plan = buildSearchInstancesPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "search_instances",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/recreate-snapshot") {
      const body = await readJsonBody(req);
      const plan = buildReplayPlan(body.snapshot, {
        targetParentId: body.targetParentId
      });
      const result = await executePluginCommand(
        body.pluginId || "default",
        "recreate_snapshot",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search-file-components") {
      const body = await readJsonBody(req);
      const plan = buildFileComponentSearchPlan(body);
      const result = await searchFileComponents(plan, {
        accessToken: process.env.FIGMA_ACCESS_TOKEN
      });
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/list-component-properties") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "list_component_properties",
        {
          targetNodeId: body.targetNodeId
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/update-text") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "update_text",
        {
          nodeId: body.nodeId,
          text: body.text
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/set-component-property") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "set_component_property",
        {
          nodeId: body.nodeId,
          propertyName: body.propertyName,
          value: body.value
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/set-component-properties") {
      const body = await readJsonBody(req);
      const plan = buildSetComponentPropertiesPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "set_component_properties",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bind-variable") {
      const body = await readJsonBody(req);
      const plan = buildBindVariablePlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "bind_variable",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/apply-style") {
      const body = await readJsonBody(req);
      const plan = buildApplyStylePlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "apply_style",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/create-component") {
      const body = await readJsonBody(req);
      const plan = buildCreateComponentPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "create_component",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/create-component-set") {
      const body = await readJsonBody(req);
      const plan = buildCreateComponentSetPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "create_component_set",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/preview-changes") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "preview_changes",
        {
          nodeId: body.nodeId,
          target: body.target,
          visible: body.visible,
          fillColor: body.fillColor,
          cornerRadius: body.cornerRadius,
          opacity: body.opacity,
          x: body.x,
          y: body.y,
          width: body.width,
          height: body.height,
          layoutMode: body.layoutMode,
          itemSpacing: body.itemSpacing,
          paddingLeft: body.paddingLeft,
          paddingRight: body.paddingRight,
          paddingTop: body.paddingTop,
          paddingBottom: body.paddingBottom,
          primaryAxisAlignItems: body.primaryAxisAlignItems,
          counterAxisAlignItems: body.counterAxisAlignItems,
          primaryAxisSizingMode: body.primaryAxisSizingMode,
          counterAxisSizingMode: body.counterAxisSizingMode,
          layoutGrow: body.layoutGrow,
          layoutAlign: body.layoutAlign,
          updates: body.updates
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bulk-update-texts") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "bulk_update_texts",
        {
          updates: body.updates || []
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/rename-node") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "rename_node",
        {
          nodeId: body.nodeId,
          name: body.name
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bulk-rename-nodes") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "bulk_rename_nodes",
        {
          updates: body.updates || []
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/update-node") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "update_node",
        {
          nodeId: body.nodeId,
          target: body.target,
          visible: body.visible,
          fillColor: body.fillColor,
          cornerRadius: body.cornerRadius,
          opacity: body.opacity,
          x: body.x,
          y: body.y,
          width: body.width,
          height: body.height,
          layoutMode: body.layoutMode,
          itemSpacing: body.itemSpacing,
          paddingLeft: body.paddingLeft,
          paddingRight: body.paddingRight,
          paddingTop: body.paddingTop,
          paddingBottom: body.paddingBottom,
          primaryAxisAlignItems: body.primaryAxisAlignItems,
          counterAxisAlignItems: body.counterAxisAlignItems,
          primaryAxisSizingMode: body.primaryAxisSizingMode,
          counterAxisSizingMode: body.counterAxisSizingMode,
          layoutGrow: body.layoutGrow,
          layoutAlign: body.layoutAlign,
          characters: body.characters,
          fontFamily: body.fontFamily,
          fontStyle: body.fontStyle,
          fontSize: body.fontSize
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bulk-update-nodes") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "bulk_update_nodes",
        {
          updates: body.updates || []
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/create-node") {
      const body = await readJsonBody(req);
      const plan = buildCreateNodePlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "create_node",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/import-library-component") {
      const body = await readJsonBody(req);
      const plan = buildImportLibraryComponentPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "import_library_component",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/duplicate-node") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "duplicate_node",
        {
          nodeId: body.nodeId,
          count: body.count
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/move-node") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "move_node",
        {
          nodeId: body.nodeId,
          parentId: body.parentId,
          index: body.index
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/move-section") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "move_section",
        {
          sectionId: body.sectionId,
          destinationParentId: body.destinationParentId,
          index: body.index
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/normalize-spacing") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "normalize_spacing",
        {
          containerId: body.containerId,
          spacing: body.spacing,
          mode: body.mode,
          recursive: body.recursive
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/apply-naming-rule") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "apply_naming_rule",
        {
          rootNodeId: body.rootNodeId,
          ruleSet: body.ruleSet,
          recursive: body.recursive,
          previewOnly: body.previewOnly
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/promote-section") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "promote_section",
        {
          sectionId: body.sectionId,
          destinationParentId: body.destinationParentId,
          index: body.index,
          normalizeSpacing: body.normalizeSpacing,
          previewOnly: body.previewOnly
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/delete-node") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "delete_node",
        {
          nodeId: body.nodeId
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/reorder-child") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "reorder_child",
        {
          nodeId: body.nodeId,
          index: body.index
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/boolean-subtract") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "boolean_subtract",
        {
          baseNodeId: body.baseNodeId,
          subtractNodeIds: body.subtractNodeIds || [],
          parentId: body.parentId,
          index: body.index,
          name: body.name
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/undo-last-batch") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "undo_last_batch"
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/plugin/register") {
      const body = await readJsonBody(req);
      const pluginId = body.pluginId || "default";
      const session = ensurePluginSession(pluginId);
      session.lastSeenAt = Date.now();
      session.fileKey = typeof body.fileKey === "string" ? body.fileKey : null;
      session.fileName = typeof body.fileName === "string" ? body.fileName : null;
      jsonResponse(res, 200, { ok: true, pluginId });
      return;
    }

    if (req.method === "POST" && url.pathname === "/plugin/selection") {
      const body = await readJsonBody(req);
      const pluginId = body.pluginId || "default";
      const session = ensurePluginSession(pluginId);
      session.lastSeenAt = Date.now();
      session.lastSelection = body.selection || [];
      jsonResponse(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/plugin/commands") {
      const pluginId = url.searchParams.get("pluginId") || "default";
      const session = ensurePluginSession(pluginId);
      session.lastSeenAt = Date.now();

      const commands = Array.from(pendingCommands.values())
        .filter(
          (command) =>
            command.pluginId === pluginId && command.deliveredAt === null
        )
        .sort((a, b) => a.createdAt - b.createdAt);

      for (const command of commands) {
        command.deliveredAt = Date.now();
      }

      jsonResponse(res, 200, { ok: true, commands });
      return;
    }

    if (req.method === "POST" && url.pathname === "/plugin/results") {
      const body = await readJsonBody(req);
      completeCommand(body.commandId, body.result, body.error);
      jsonResponse(res, 200, { ok: true });
      return;
    }

    jsonResponse(res, 404, {
      ok: false,
      error: `Unknown route: ${req.method} ${url.pathname}`
    });
  } catch (error) {
    jsonResponse(res, 400, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

function listenOnAvailablePort(server, ports) {
  return new Promise((resolve, reject) => {
    const queue = [...ports];

    const tryNext = () => {
      const port = queue.shift();
      if (typeof port === "undefined") {
        reject(new Error(`Unable to bind bridge to any allowed port: ${ports.join(", ")}`));
        return;
      }

      const onError = (error) => {
        server.off("listening", onListening);
        if (error && error.code === "EADDRINUSE") {
          tryNext();
          return;
        }
        reject(error);
      };

      const onListening = () => {
        server.off("error", onError);
        activeHttpPort = port;
        resolve(port);
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
    };

    tryNext();
  });
}

const toolDefinitions = [
  {
    name: "get_active_plugins",
    description: "List the registered Figma plugin bridge sessions.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "get_selection",
    description: "Read the current Figma selection for a plugin session.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_metadata",
    description: "Return a sparse XML outline of the current selection, explicit target node, or current page when nothing is selected.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        maxDepth: { type: "number" },
        maxNodes: { type: "number" }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_variable_defs",
    description: "Return variables and styles used by the current selection, explicit target node, or current page when nothing is selected.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        maxDepth: { type: "number" },
        maxNodes: { type: "number" }
      },
      additionalProperties: false
    }
  },
  {
    name: "list_text_nodes",
    description: "List text nodes under the current selection or a specific node.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "search_nodes",
    description: "Search descendants of the current selection or a specific root by name and type using lightweight metadata.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        query: { type: "string" },
        nodeTypes: {
          type: "array",
          items: { type: "string" }
        },
        maxDepth: { type: "number" },
        maxResults: { type: "number" },
        includeText: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    name: "snapshot_selection",
    description: "Serialize the currently selected source subtree into a bounded snapshot that can be replayed in another file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        maxDepth: { type: "number" },
        maxNodes: { type: "number" },
        placeholderInstances: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    name: "search_design_system",
    description: "Search the current file's local components, styles, and variables, and optionally merge in external library/file matches.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        query: { type: "string" },
        maxResults: { type: "number" },
        kinds: {
          type: "array",
          items: {
            type: "string",
            enum: ["components", "styles", "variables"]
          }
        },
        sources: {
          type: "array",
          items: {
            type: "string",
            enum: ["local-file", "library-files", "all"]
          }
        },
        includeComponents: { type: "boolean" },
        includeStyles: { type: "boolean" },
        includeVariables: { type: "boolean" },
        fileKeys: {
          type: "array",
          items: { type: "string" }
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "search_instances",
    description: "Search instance nodes under an explicit target, the current selection, or the current page.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        query: { type: "string" },
        maxDepth: { type: "number" },
        maxResults: { type: "number" },
        includeProperties: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    name: "search_library_assets",
    description: "Search published library components, component sets, and styles in a Figma library file via the REST API.",
    inputSchema: {
      type: "object",
      properties: {
        fileKey: { type: "string" },
        query: { type: "string" },
        assetTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["COMPONENT", "COMPONENT_SET", "STYLE"]
          }
        },
        maxResults: { type: "number" }
      },
      required: ["fileKey"],
      additionalProperties: false
    }
  },
  {
    name: "recreate_snapshot",
    description: "Recreate a previously captured snapshot under a target parent in the connected file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetParentId: { type: "string" },
        snapshot: { type: "object" }
      },
      required: ["targetParentId", "snapshot"],
      additionalProperties: false
    }
  },
  {
    name: "search_file_components",
    description: "Search component metadata exposed by a Figma file response, useful for Community files that are not published as libraries.",
    inputSchema: {
      type: "object",
      properties: {
        fileKey: { type: "string" },
        query: { type: "string" },
        maxResults: { type: "number" }
      },
      required: ["fileKey"],
      additionalProperties: false
    }
  },
  {
    name: "list_component_properties",
    description: "Inspect component properties for a selected or explicit target node.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "update_text",
    description: "Update a single text node's characters in the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        text: { type: "string" }
      },
      required: ["nodeId", "text"],
      additionalProperties: false
    }
  },
  {
    name: "set_component_property",
    description: "Set one component property value on an instance node in the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        propertyName: { type: "string" },
        value: {
          oneOf: [{ type: "string" }, { type: "boolean" }]
        }
      },
      required: ["nodeId", "propertyName", "value"],
      additionalProperties: false
    }
  },
  {
    name: "set_component_properties",
    description: "Set multiple component property values on an instance node in one atomic update.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        properties: {
          type: "object",
          additionalProperties: {
            oneOf: [{ type: "string" }, { type: "boolean" }]
          }
        }
      },
      required: ["nodeId", "properties"],
      additionalProperties: false
    }
  },
  {
    name: "bind_variable",
    description: "Bind or unbind a Figma variable to a supported property on a node.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        property: {
          type: "string",
          enum: listSupportedBindVariableFields()
        },
        variableId: { type: "string" },
        variableKey: { type: "string" },
        unbind: { type: "boolean" }
      },
      required: ["nodeId", "property"],
      additionalProperties: false
    }
  },
  {
    name: "apply_style",
    description: "Apply or clear a supported shared style on a node.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        styleType: {
          type: "string",
          enum: listSupportedApplyStyleTypes()
        },
        styleId: { type: "string" },
        styleKey: { type: "string" },
        clear: { type: "boolean" }
      },
      required: ["nodeId", "styleType"],
      additionalProperties: false
    }
  },
  {
    name: "create_component",
    description: "Promote an existing node in the current file into a local component.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        supportedSourceTypes: {
          type: "array",
          items: {
            type: "string",
            enum: listSupportedCreateComponentSourceTypes()
          }
        }
      },
      required: ["targetNodeId"],
      additionalProperties: false
    }
  },
  {
    name: "create_component_set",
    description: "Combine existing local components into a component set.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        componentNodeIds: {
          type: "array",
          items: { type: "string" }
        },
        parentId: { type: "string" },
        index: { type: "number" },
        name: { type: "string" },
        description: { type: "string" }
      },
      required: ["componentNodeIds"],
      additionalProperties: false
    }
  },
  {
    name: "preview_changes",
    description: "Preview one or more node updates without mutating the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        target: { type: "string", enum: ["self", "parent"] },
        visible: { type: "boolean" },
        fillColor: { type: "string" },
        cornerRadius: { type: "number" },
        opacity: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        layoutMode: {
          type: "string",
          enum: ["NONE", "HORIZONTAL", "VERTICAL"]
        },
        itemSpacing: { type: "number" },
        paddingLeft: { type: "number" },
        paddingRight: { type: "number" },
        paddingTop: { type: "number" },
        paddingBottom: { type: "number" },
        primaryAxisAlignItems: {
          type: "string",
          enum: ["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]
        },
        counterAxisAlignItems: {
          type: "string",
          enum: ["MIN", "MAX", "CENTER", "BASELINE"]
        },
        primaryAxisSizingMode: {
          type: "string",
          enum: ["FIXED", "AUTO"]
        },
        counterAxisSizingMode: {
          type: "string",
          enum: ["FIXED", "AUTO"]
        },
        layoutGrow: { type: "number" },
        layoutAlign: {
          type: "string",
          enum: ["INHERIT", "STRETCH", "MIN", "CENTER", "MAX"]
        },
        characters: { type: "string" },
        fontFamily: { type: "string" },
        fontStyle: { type: "string" },
        fontSize: { type: "number" },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              target: { type: "string", enum: ["self", "parent"] },
              visible: { type: "boolean" },
              fillColor: { type: "string" },
              cornerRadius: { type: "number" },
              opacity: { type: "number" },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              layoutMode: {
                type: "string",
                enum: ["NONE", "HORIZONTAL", "VERTICAL"]
              },
              itemSpacing: { type: "number" },
              paddingLeft: { type: "number" },
              paddingRight: { type: "number" },
              paddingTop: { type: "number" },
              paddingBottom: { type: "number" },
              primaryAxisAlignItems: {
                type: "string",
                enum: ["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]
              },
              counterAxisAlignItems: {
                type: "string",
                enum: ["MIN", "MAX", "CENTER", "BASELINE"]
              },
              primaryAxisSizingMode: {
                type: "string",
                enum: ["FIXED", "AUTO"]
              },
              counterAxisSizingMode: {
                type: "string",
                enum: ["FIXED", "AUTO"]
              },
              layoutGrow: { type: "number" },
              layoutAlign: {
                type: "string",
                enum: ["INHERIT", "STRETCH", "MIN", "CENTER", "MAX"]
              },
              characters: { type: "string" },
              fontFamily: { type: "string" },
              fontStyle: { type: "string" },
              fontSize: { type: "number" }
            },
            required: ["nodeId"],
            additionalProperties: false
          }
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "rename_node",
    description: "Rename a single node in the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        name: { type: "string" }
      },
      required: ["nodeId", "name"],
      additionalProperties: false
    }
  },
  {
    name: "bulk_rename_nodes",
    description: "Rename multiple nodes in one request.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              name: { type: "string" }
            },
            required: ["nodeId", "name"],
            additionalProperties: false
          }
        }
      },
      required: ["updates"],
      additionalProperties: false
    }
  },
  {
    name: "bulk_update_texts",
    description: "Update multiple text nodes in one request.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              text: { type: "string" }
            },
            required: ["nodeId", "text"],
            additionalProperties: false
          }
        }
      },
      required: ["updates"],
      additionalProperties: false
    }
  },
  {
    name: "update_node",
    description: "Update visibility or solid fill color for a node in the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        target: { type: "string", enum: ["self", "parent"] },
        visible: { type: "boolean" },
        fillColor: { type: "string" },
        cornerRadius: { type: "number" },
        opacity: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        layoutMode: {
          type: "string",
          enum: ["NONE", "HORIZONTAL", "VERTICAL"]
        },
        itemSpacing: { type: "number" },
        paddingLeft: { type: "number" },
        paddingRight: { type: "number" },
        paddingTop: { type: "number" },
        paddingBottom: { type: "number" },
        primaryAxisAlignItems: {
          type: "string",
          enum: ["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]
        },
        counterAxisAlignItems: {
          type: "string",
          enum: ["MIN", "MAX", "CENTER", "BASELINE"]
        },
        primaryAxisSizingMode: {
          type: "string",
          enum: ["FIXED", "AUTO"]
        },
        counterAxisSizingMode: {
          type: "string",
          enum: ["FIXED", "AUTO"]
        },
        layoutGrow: { type: "number" },
        layoutAlign: {
          type: "string",
          enum: ["INHERIT", "STRETCH", "MIN", "CENTER", "MAX"]
        },
        characters: { type: "string" },
        fontFamily: { type: "string" },
        fontStyle: { type: "string" },
        fontSize: { type: "number" }
      },
      required: ["nodeId"],
      additionalProperties: false
    }
  },
  {
    name: "bulk_update_nodes",
    description: "Update visibility or fill color for multiple nodes in one request.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              target: { type: "string", enum: ["self", "parent"] },
              visible: { type: "boolean" },
              fillColor: { type: "string" },
              cornerRadius: { type: "number" },
              opacity: { type: "number" },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              layoutMode: {
                type: "string",
                enum: ["NONE", "HORIZONTAL", "VERTICAL"]
              },
              itemSpacing: { type: "number" },
              paddingLeft: { type: "number" },
              paddingRight: { type: "number" },
              paddingTop: { type: "number" },
              paddingBottom: { type: "number" },
              primaryAxisAlignItems: {
                type: "string",
                enum: ["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]
              },
              counterAxisAlignItems: {
                type: "string",
                enum: ["MIN", "MAX", "CENTER", "BASELINE"]
              },
              primaryAxisSizingMode: {
                type: "string",
                enum: ["FIXED", "AUTO"]
              },
              counterAxisSizingMode: {
                type: "string",
                enum: ["FIXED", "AUTO"]
              },
              layoutGrow: { type: "number" },
              layoutAlign: {
                type: "string",
                enum: ["INHERIT", "STRETCH", "MIN", "CENTER", "MAX"]
              },
              characters: { type: "string" },
              fontFamily: { type: "string" },
              fontStyle: { type: "string" },
              fontSize: { type: "number" }
            },
            required: ["nodeId"],
            additionalProperties: false
          }
        }
      },
      required: ["updates"],
      additionalProperties: false
    }
  },
  {
    name: "create_node",
    description: "Create and insert a new first-slice node into a target parent.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        index: { type: "number" },
        nodeType: { type: "string", enum: listSupportedCreateNodeTypes() },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        characters: { type: "string" },
        fontFamily: { type: "string" },
        fontStyle: { type: "string" },
        fontSize: { type: "number" },
        fillColor: { type: "string" },
        cornerRadius: { type: "number" },
        opacity: { type: "number" }
      },
      required: ["parentId", "nodeType"],
      additionalProperties: false
    }
  },
  {
    name: "import_library_component",
    description: "Import a published library component or component set by key and insert an instance into a target parent.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        key: { type: "string" },
        parentId: { type: "string" },
        assetType: {
          type: "string",
          enum: listSupportedImportLibraryAssetTypes()
        },
        name: { type: "string" },
        index: { type: "number" },
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["key", "parentId"],
      additionalProperties: false
    }
  },
  {
    name: "duplicate_node",
    description: "Duplicate a node inside the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        count: { type: "number" }
      },
      required: ["nodeId"],
      additionalProperties: false
    }
  },
  {
    name: "move_node",
    description: "Move an existing node into a target parent at an optional index.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        parentId: { type: "string" },
        index: { type: "number" }
      },
      required: ["nodeId", "parentId"],
      additionalProperties: false
    }
  },
  {
    name: "move_section",
    description: "Move or reorder an explicit container section into a destination parent at an optional index.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        sectionId: { type: "string" },
        destinationParentId: { type: "string" },
        index: { type: "number" }
      },
      required: ["sectionId"],
      additionalProperties: false
    }
  },
  {
    name: "normalize_spacing",
    description: "Normalize auto layout gap and/or padding for an explicit container and optional descendant subtree.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        containerId: { type: "string" },
        spacing: { type: "number" },
        mode: { type: "string", enum: ["both", "gap", "padding"] },
        recursive: { type: "boolean" }
      },
      required: ["containerId"],
      additionalProperties: false
    }
  },
  {
    name: "promote_section",
    description: "Preview or apply promotion of a section-like node to a more primary position, with optional spacing normalization.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        sectionId: { type: "string" },
        destinationParentId: { type: "string" },
        index: { type: "number" },
        previewOnly: { type: "boolean" },
        normalizeSpacing: {
          type: "object",
          properties: {
            spacing: { type: "number" },
            mode: { type: "string", enum: ["both", "gap", "padding"] },
            recursive: { type: "boolean" }
          },
          additionalProperties: false
        }
      },
      required: ["sectionId"],
      additionalProperties: false
    }
  },
  {
    name: "apply_naming_rule",
    description: "Preview or apply a safe pattern-mapped rename plan for a subtree.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        rootNodeId: { type: "string" },
        ruleSet: {
          type: "string",
          enum: ["app-screen", "header-basic", "tab-bar-basic", "card-list-basic", "fab-basic", "content-screen-basic", "ai-chat-screen"]
        },
        recursive: { type: "boolean" },
        previewOnly: { type: "boolean" }
      },
      required: ["rootNodeId"],
      additionalProperties: false
    }
  },
  {
    name: "delete_node",
    description: "Delete a node from the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" }
      },
      required: ["nodeId"],
      additionalProperties: false
    }
  },
  {
    name: "reorder_child",
    description: "Reorder a node within its current parent by child index.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        index: { type: "number" }
      },
      required: ["nodeId", "index"],
      additionalProperties: false
    }
  },
  {
    name: "boolean_subtract",
    description: "Create a Figma subtract boolean operation from a base node and one or more subtractor nodes.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        baseNodeId: { type: "string" },
        subtractNodeIds: {
          type: "array",
          items: { type: "string" }
        },
        parentId: { type: "string" },
        index: { type: "number" },
        name: { type: "string" }
      },
      required: ["baseNodeId", "subtractNodeIds"],
      additionalProperties: false
    }
  },
  {
    name: "undo_last_batch",
    description: "Undo the most recent supported mutation batch in the current plugin session.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" }
      },
      additionalProperties: false
    }
  }
];

async function handleToolCall(name, args) {
  const pluginId = args.pluginId || "default";

  if (name === "get_active_plugins") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            Array.from(pluginSessions.values()).map((session) => ({
              pluginId: session.pluginId,
              fileKey: session.fileKey,
              fileName: session.fileName,
              lastSeenAt: session.lastSeenAt,
              selectionCount: session.lastSelection.length
            })),
            null,
            2
          )
        }
      ]
    };
  }

  if (name === "get_selection") {
    const result = await executePluginCommand(pluginId, "get_selection");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_metadata") {
    const result = await executePluginCommand(pluginId, "get_metadata", {
      targetNodeId: args.targetNodeId,
      maxDepth: args.maxDepth,
      maxNodes: args.maxNodes
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_variable_defs") {
    const result = await executePluginCommand(pluginId, "get_variable_defs", {
      targetNodeId: args.targetNodeId,
      maxDepth: args.maxDepth,
      maxNodes: args.maxNodes
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "list_text_nodes") {
    const result = await executePluginCommand(pluginId, "list_text_nodes", {
      targetNodeId: args.targetNodeId
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_nodes") {
    const plan = buildSearchNodesPlan(args);
    const result = await executePluginCommand(pluginId, "search_nodes", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "snapshot_selection") {
    const plan = buildSnapshotPlan(args);
    const result = await executePluginCommand(pluginId, "snapshot_selection", {
      targetNodeId: args.targetNodeId,
      maxDepth: plan.maxDepth,
      maxNodes: plan.maxNodes,
      placeholderInstances: plan.placeholderInstances
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_library_assets") {
    const plan = buildLibraryAssetSearchPlan(args);
    const result = await searchLibraryAssets(plan, {
      accessToken: process.env.FIGMA_ACCESS_TOKEN
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_design_system") {
    const plan = buildDesignSystemSearchPlan(args);
    const localResult = await executePluginCommand(pluginId, "search_design_system", plan);
    const sources = [localResult];

    if (plan.fileKeys.length > 0 && (plan.sources.includes("all") || plan.sources.includes("library-files"))) {
      for (const fileKey of plan.fileKeys) {
        if (plan.includeComponents || plan.includeStyles) {
          sources.push(
            await searchLibraryAssets(
              {
                fileKey,
                query: plan.query,
                assetTypes: [
                  ...(plan.includeComponents ? ["COMPONENT", "COMPONENT_SET"] : []),
                  ...(plan.includeStyles ? ["STYLE"] : [])
                ],
                maxResults: plan.maxResults
              },
              {
                accessToken: process.env.FIGMA_ACCESS_TOKEN
              }
            )
          );
        }

        if (plan.includeComponents) {
          sources.push(
            await searchFileComponents(
              {
                fileKey,
                query: plan.query,
                maxResults: plan.maxResults
              },
              {
                accessToken: process.env.FIGMA_ACCESS_TOKEN
              }
            )
          );
        }
      }
    }

    const result = mergeDesignSystemSearchResults(sources, plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_instances") {
    const plan = buildSearchInstancesPlan(args);
    const result = await executePluginCommand(pluginId, "search_instances", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "recreate_snapshot") {
    const plan = buildReplayPlan(args.snapshot, {
      targetParentId: args.targetParentId
    });
    const result = await executePluginCommand(
      pluginId,
      "recreate_snapshot",
      plan
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_file_components") {
    const plan = buildFileComponentSearchPlan(args);
    const result = await searchFileComponents(plan, {
      accessToken: process.env.FIGMA_ACCESS_TOKEN
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "list_component_properties") {
    const result = await executePluginCommand(pluginId, "list_component_properties", {
      targetNodeId: args.targetNodeId
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "update_text") {
    const result = await executePluginCommand(pluginId, "update_text", {
      nodeId: args.nodeId,
      text: args.text
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "set_component_property") {
    const result = await executePluginCommand(pluginId, "set_component_property", {
      nodeId: args.nodeId,
      propertyName: args.propertyName,
      value: args.value
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "set_component_properties") {
    const plan = buildSetComponentPropertiesPlan(args);
    const result = await executePluginCommand(pluginId, "set_component_properties", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bind_variable") {
    const plan = buildBindVariablePlan(args);
    const result = await executePluginCommand(pluginId, "bind_variable", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "apply_style") {
    const plan = buildApplyStylePlan(args);
    const result = await executePluginCommand(pluginId, "apply_style", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "create_component") {
    const plan = buildCreateComponentPlan(args);
    const result = await executePluginCommand(pluginId, "create_component", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "create_component_set") {
    const plan = buildCreateComponentSetPlan(args);
    const result = await executePluginCommand(pluginId, "create_component_set", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "preview_changes") {
    const result = await executePluginCommand(pluginId, "preview_changes", {
      nodeId: args.nodeId,
      target: args.target,
      visible: args.visible,
      fillColor: args.fillColor,
      cornerRadius: args.cornerRadius,
      opacity: args.opacity,
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      layoutMode: args.layoutMode,
      itemSpacing: args.itemSpacing,
      paddingLeft: args.paddingLeft,
      paddingRight: args.paddingRight,
      paddingTop: args.paddingTop,
      paddingBottom: args.paddingBottom,
      primaryAxisAlignItems: args.primaryAxisAlignItems,
      counterAxisAlignItems: args.counterAxisAlignItems,
      primaryAxisSizingMode: args.primaryAxisSizingMode,
      counterAxisSizingMode: args.counterAxisSizingMode,
      layoutGrow: args.layoutGrow,
      layoutAlign: args.layoutAlign,
      characters: args.characters,
      fontFamily: args.fontFamily,
      fontStyle: args.fontStyle,
      fontSize: args.fontSize,
      updates: args.updates
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "rename_node") {
    const result = await executePluginCommand(pluginId, "rename_node", {
      nodeId: args.nodeId,
      name: args.name
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_rename_nodes") {
    const result = await executePluginCommand(pluginId, "bulk_rename_nodes", {
      updates: args.updates
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_update_texts") {
    const result = await executePluginCommand(pluginId, "bulk_update_texts", {
      updates: args.updates
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "update_node") {
    const result = await executePluginCommand(pluginId, "update_node", {
      nodeId: args.nodeId,
      target: args.target,
      visible: args.visible,
      fillColor: args.fillColor,
      cornerRadius: args.cornerRadius,
      opacity: args.opacity,
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      layoutMode: args.layoutMode,
      itemSpacing: args.itemSpacing,
      paddingLeft: args.paddingLeft,
      paddingRight: args.paddingRight,
      paddingTop: args.paddingTop,
      paddingBottom: args.paddingBottom,
      primaryAxisAlignItems: args.primaryAxisAlignItems,
      counterAxisAlignItems: args.counterAxisAlignItems,
      primaryAxisSizingMode: args.primaryAxisSizingMode,
      counterAxisSizingMode: args.counterAxisSizingMode,
      layoutGrow: args.layoutGrow,
      layoutAlign: args.layoutAlign,
      characters: args.characters,
      fontFamily: args.fontFamily,
      fontStyle: args.fontStyle,
      fontSize: args.fontSize
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_update_nodes") {
    const result = await executePluginCommand(pluginId, "bulk_update_nodes", {
      updates: args.updates
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "create_node") {
    const plan = buildCreateNodePlan(args);
    const result = await executePluginCommand(pluginId, "create_node", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "import_library_component") {
    const plan = buildImportLibraryComponentPlan(args);
    const result = await executePluginCommand(
      pluginId,
      "import_library_component",
      plan
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "duplicate_node") {
    const result = await executePluginCommand(pluginId, "duplicate_node", {
      nodeId: args.nodeId,
      count: args.count
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "move_node") {
    const result = await executePluginCommand(pluginId, "move_node", {
      nodeId: args.nodeId,
      parentId: args.parentId,
      index: args.index
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "move_section") {
    const result = await executePluginCommand(pluginId, "move_section", {
      sectionId: args.sectionId,
      destinationParentId: args.destinationParentId,
      index: args.index
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "normalize_spacing") {
    const result = await executePluginCommand(pluginId, "normalize_spacing", {
      containerId: args.containerId,
      spacing: args.spacing,
      mode: args.mode,
      recursive: args.recursive
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "apply_naming_rule") {
    const result = await executePluginCommand(pluginId, "apply_naming_rule", {
      rootNodeId: args.rootNodeId,
      ruleSet: args.ruleSet,
      recursive: args.recursive,
      previewOnly: args.previewOnly
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "promote_section") {
    const result = await executePluginCommand(pluginId, "promote_section", {
      sectionId: args.sectionId,
      destinationParentId: args.destinationParentId,
      index: args.index,
      normalizeSpacing: args.normalizeSpacing,
      previewOnly: args.previewOnly
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "delete_node") {
    const result = await executePluginCommand(pluginId, "delete_node", {
      nodeId: args.nodeId
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "reorder_child") {
    const result = await executePluginCommand(pluginId, "reorder_child", {
      nodeId: args.nodeId,
      index: args.index
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "boolean_subtract") {
    const result = await executePluginCommand(pluginId, "boolean_subtract", {
      baseNodeId: args.baseNodeId,
      subtractNodeIds: args.subtractNodeIds,
      parentId: args.parentId,
      index: args.index,
      name: args.name
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "undo_last_batch") {
    const result = await executePluginCommand(pluginId, "undo_last_batch");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

function writeMessage(message) {
  const body = JSON.stringify(message);
  process.stdout.write(
    `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`
  );
}

function parseHeaders(headerText) {
  const headers = {};
  for (const line of headerText.split("\r\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headers[key] = value;
  }
  return headers;
}

let buffer = Buffer.alloc(0);

async function handleMessage(message) {
  if (message.method === "initialize") {
    writeMessage({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "figma-writable-mcp-prototype",
          version: "0.1.0"
        }
      }
    });
    return;
  }

  if (message.method === "notifications/initialized") {
    return;
  }

  if (message.method === "tools/list") {
    writeMessage({
      jsonrpc: "2.0",
      id: message.id,
      result: { tools: toolDefinitions }
    });
    return;
  }

  if (message.method === "tools/call") {
    try {
      const result = await handleToolCall(
        message.params.name,
        message.params.arguments || {}
      );

      writeMessage({
        jsonrpc: "2.0",
        id: message.id,
        result
      });
    } catch (error) {
      writeMessage({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
    return;
  }

  writeMessage({
    jsonrpc: "2.0",
    id: message.id,
    error: {
      code: -32601,
      message: `Unsupported method: ${message.method}`
    }
  });
}

process.stdin.on("data", async (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);

  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return;
    }

    const headerText = buffer.slice(0, headerEnd).toString("utf8");
    const headers = parseHeaders(headerText);
    const contentLength = Number(headers["content-length"] || 0);
    const totalLength = headerEnd + 4 + contentLength;

    if (buffer.length < totalLength) {
      return;
    }

    const body = buffer
      .slice(headerEnd + 4, totalLength)
      .toString("utf8");
    buffer = buffer.slice(totalLength);

    let message;
    try {
      message = JSON.parse(body);
    } catch (error) {
      writeMessage({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Invalid JSON received"
        }
      });
      continue;
    }

    await handleMessage(message);
  }
});

listenOnAvailablePort(httpServer, CANDIDATE_PORTS)
  .then((port) => {
    process.stderr.write(`[writable-mcp-bridge] listening on http://127.0.0.1:${port}\n`);
  })
  .catch((error) => {
    process.stderr.write(
      `[writable-mcp-bridge] failed to bind local HTTP bridge: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  });

process.stdin.resume();
