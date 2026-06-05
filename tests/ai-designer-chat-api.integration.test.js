import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { chmod, mkdtemp, writeFile, rm } from "node:fs/promises";

function parseRewriteUserContent(content) {
  const text = String(content || "");
  try {
    return JSON.parse(text);
  } catch {
    let request = "";
    let mode = "";
    const textNodes = text
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("\t");
        if (parts.length < 2) {
          return null;
        }
        const id = parts[0].trim();
        const characters = parts.slice(1).join("\t").trim();
        if (id === "REQUEST") {
          request = characters;
          return null;
        }
        if (id === "MODE") {
          mode = characters;
          return null;
        }
        if (id === "NODE" && parts.length >= 3) {
          return {
            id: parts[1].trim(),
            characters: parts.slice(2).join("\t").trim()
          };
        }
        return { id, characters };
      })
      .filter(Boolean);
    return { request, mode, textNodes };
  }
}

function isChatCompletionRequest(req) {
  return req.method === "POST" && req.url === "/v1/chat/completions";
}

function isOllamaGenerateRequest(req) {
  return req.method === "POST" && req.url === "/api/generate";
}

async function readJsonRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function getRewriteUserContentFromRequest(req, requestBody) {
  if (isOllamaGenerateRequest(req)) {
    return String(requestBody?.prompt || "");
  }
  return String(requestBody?.messages?.[1]?.content || "");
}

function sendRewriteResponse(req, res, payload) {
  res.writeHead(200, { "Content-Type": "application/json" });
  if (isOllamaGenerateRequest(req)) {
    res.end(
      JSON.stringify({
        response: payload
      })
    );
    return;
  }
  res.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content: payload
          }
        }
      ]
    })
  );
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to reserve a numeric port")));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function waitForBridgeListening(childProcess, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for writable bridge to start listening"));
    }, timeoutMs);
    timer.unref?.();

    const onData = (chunk) => {
      const text = chunk.toString("utf8");
      const match = text.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);
      if (!match) {
        return;
      }
      cleanup();
      resolve(Number(match[1]));
    };

    const onExit = (code, signal) => {
      cleanup();
      reject(new Error(`Bridge exited before listening (code=${String(code)}, signal=${String(signal)})`));
    };

    const cleanup = () => {
      clearTimeout(timer);
      childProcess.stderr?.off("data", onData);
      childProcess.off("exit", onExit);
    };

    childProcess.stderr?.on("data", onData);
    childProcess.once("exit", onExit);
  });
}

async function stopBridge(childProcess) {
  if (!childProcess || childProcess.exitCode !== null) {
    return;
  }
  const didExit = new Promise((resolve) => {
    childProcess.once("exit", () => resolve());
  });
  childProcess.kill("SIGTERM");
  await didExit;
}

async function startBridgeServer(extraEnv = {}) {
  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      OPENAI_API_KEY: "",
      XBRIDGE_AI_API_KEY: "",
      ...extraEnv
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const listeningPort = await waitForBridgeListening(childProcess);
  return {
    origin: `http://127.0.0.1:${listeningPort}`,
    childProcess
  };
}

async function createMockCodexCliScript({
  result = {
    intent: "inspect_selection",
    summary: "선택한 인스턴스의 variant와 override를 확인했습니다.",
    details: ["원본 컴포넌트는 Button입니다."],
    followUp: "현재 variant와 override 차이를 먼저 기록하기"
  },
  delayMs = 0
} = {}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "xbridge-codex-mock-"));
  const scriptPath = path.join(tempDir, "mock-codex-cli.mjs");
  const source = `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
${delayMs > 0 ? `await new Promise((resolve) => setTimeout(resolve, ${JSON.stringify(delayMs)}));` : ""}
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
if (outputIndex === -1 || !args[outputIndex + 1]) {
  console.error("missing output path");
  process.exit(1);
}
const outputPath = args[outputIndex + 1];
writeFileSync(outputPath, JSON.stringify(${JSON.stringify(result)}), "utf8");
process.exit(0);
`;
  await writeFile(scriptPath, source, "utf8");
  await chmod(scriptPath, 0o755);
  return {
    scriptPath,
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    }
  };
}

async function postJson(origin, path, payload) {
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

async function getJson(origin, path) {
  const response = await fetch(`${origin}${path}`);
  return {
    status: response.status,
    body: await response.json()
  };
}

async function waitForPluginCommands(origin, pluginId, { min = 1, timeoutMs = 1200 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await getJson(
      origin,
      `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
    );
    if ((response.body?.commands?.length || 0) >= min) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for ${min} command(s) for plugin ${pluginId}`);
}

async function startMockAiServer(handler) {
  const port = await reservePort();
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
}

test("designer chat API returns read context through Codex-first fallback contract", async (t) => {
  const mockCodex = await createMockCodexCliScript({
    result: {
      summary: "선택한 카드의 정보 위계를 읽기 결과 기준으로 정리했습니다.",
      findings: ["선택 대상은 Revenue Card입니다."],
      recommendations: ["제목, 핵심 수치, 보조 설명 순서로 정리하세요."]
    }
  });
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath,
    XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
    await mockCodex.cleanup();
  });

  const healthResponse = await fetch(`${bridge.origin}/health`);
  const health = await healthResponse.json();
  assert.equal(health.serverVersion, "0.5.65");
  assert.equal(health.aiDesigner.executionBackend, "codex_cli");

  const chatResponse = await fetch(`${bridge.origin}/api/designer/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pluginId: "default",
      message: "선택한 카드의 정보 위계를 정리해줘",
      figmaContext: {
        pageName: "Dashboard",
        selection: [{ id: "1:2", name: "Revenue Card" }]
      }
    })
  });
  const chat = await chatResponse.json();

  assert.equal(chatResponse.status, 200);
  assert.equal(chat.ok, true);
  assert.equal(chat.intentEnvelope.intents[0].kind, "improve_hierarchy");
  assert.equal(chat.aiBackend, "codex_cli");
  assert.equal(chat.codexStatus, "completed");
  assert.equal(chat.fallbackUsed, false);
  assert.equal(chat.ai.provider, "codex_cli");
  assert.equal(chat.ai.status, "completed");
  assert.equal(
    chat.ai.response.reply,
    "선택한 카드의 정보 위계를 읽기 결과 기준으로 정리했습니다."
  );
  assert.equal(Array.isArray(chat.designerSuggestionBundle.recommendations), true);
  assert.equal(Array.isArray(chat.designerActionPreviewBundle.previews), true);
  assert.equal(chat.designerSuggestionBundle.actionPreviewBundle.summary.actionCount > 0, true);
  assert.equal(Array.isArray(chat.designerSuggestionBundle.knowledgeReferences), true);
  assert.equal(
    chat.designerSuggestionBundle.knowledgeReferences.some((entry) =>
      entry.sourceKind === "document_chunk" &&
      String(entry.sourcePath || "").startsWith("docs/")
    ),
    true
  );
});

test("designer chat fast-path lets the configured AI own the user-facing reply", { skip: "legacy provider fast-path contract replaced by Codex-first text rewrite" }, async (t) => {
  let capturedRequestBody = null;
  const mockAi = await startMockAiServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    capturedRequestBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "AI가 방금 선택 텍스트를 커피동호회 제목과 본문으로 반영했어요.",
                intent: {
                  kind: "revise_copy",
                  confidence: "high"
                },
                readRequests: [],
                actionPlan: [],
                safety: {
                  canApply: true,
                  reason: "이미 브리지가 적용을 완료했습니다."
                }
              })
            }
          }
        ]
      })
    );
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "custom",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-fast-ai-reply";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    request: "선택한 텍스트 내용을 커피동호회에 맞게 변경해줘",
    figmaContext: {
      fileName: "FASOO CLUB",
      pageId: "1:1",
      pageName: "Home",
      selection: [
        { id: "20:1", name: "title", type: "TEXT" },
        { id: "20:2", name: "body", type: "TEXT" }
      ]
    }
  });

  const bulkUpdate = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(bulkUpdate.body.commands.length, 1);
  assert.equal(bulkUpdate.body.commands[0].type, "bulk_update_texts");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: bulkUpdate.body.commands[0].commandId,
    result: {
      updated: [
        { id: "20:1", name: "title", characters: "커피동호회 5월 정기모임 안내" },
        { id: "20:2", name: "body", characters: "이번 주 카페 투어 번개 참석 가능하신 분 모집합니다." }
      ]
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.ai?.status, "completed");
  assert.equal(
    response.body.ai?.response?.reply,
    "AI가 방금 선택 텍스트를 커피동호회 제목과 본문으로 반영했어요."
  );
  assert.equal(capturedRequestBody?.model, "local-test-model");
  assert.equal(
    capturedRequestBody?.messages?.[1]?.content?.includes("\"applyResult\""),
    true
  );
});

test("designer chat fast-path falls back quickly when AI reply narration is too slow", { skip: "legacy provider post-apply narration was removed from the Codex-first path" }, async (t) => {
  let requestCount = 0;
  const mockAi = await startMockAiServer(async (req, res) => {
    if (!isChatCompletionRequest(req) && !isOllamaGenerateRequest(req)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    const requestBody = await readJsonRequestBody(req);
    const userContent = getRewriteUserContentFromRequest(req, requestBody);
    const parsed = parseRewriteUserContent(userContent);
    const isRewritePreview = Array.isArray(parsed?.textNodes);
    const isPostApplyNarration = parsed && typeof parsed === "object" && parsed.applyResult;
    requestCount += 1;

    if (isRewritePreview) {
      sendRewriteResponse(
        req,
        res,
        JSON.stringify({
          reply: "선택한 텍스트를 한글 제목으로 바로 번역했어요.",
          updates: [
            { id: "22:1", text: "대시보드" },
            { id: "22:2", text: "메시지" }
          ],
          safety: {
            canApply: false,
            reason: "Preview before confirm"
          }
        })
      );
      return;
    }

    if (isPostApplyNarration) {
      await new Promise((resolve) => setTimeout(resolve, 3500));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: isPostApplyNarration
                  ? "AI가 적용 결과를 설명했어요."
                  : "먼저 선택한 텍스트를 번역 작업으로 해석할게요.",
                intent: {
                  kind: "revise_copy",
                  confidence: "high"
                },
                readRequests: [],
                actionPlan: [],
                safety: {
                  canApply: true,
                  reason: "이미 브리지가 적용을 완료했습니다."
                }
              })
            }
          }
        ]
      })
    );
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "ollama",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-fast-ai-timeout-fallback";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const startedAt = Date.now();
  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    request: "선택한 텍스트를 한글로 번역 적용해줘",
    figmaContext: {
      fileName: "Garuda",
      pageId: "1:1",
      pageName: "Board",
      selection: [
        { id: "22:1", name: "title-1", type: "TEXT", characters: "Dashboard" },
        { id: "22:2", name: "title-2", type: "TEXT", characters: "Messages" }
      ]
    }
  });

  const bulkUpdate = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(bulkUpdate.body.commands[0].type, "bulk_update_texts");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: bulkUpdate.body.commands[0].commandId,
    result: {
      updated: [
        { id: "22:1", name: "title-1", characters: "대시보드" },
        { id: "22:2", name: "title-2", characters: "메시지" }
      ]
    }
  });

  const response = await request;
  const elapsedMs = Date.now() - startedAt;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.fastPath?.type, "selection_text_rewrite_ai");
  assert.equal(
    response.body.ai?.response?.reply,
    "선택한 텍스트를 한글 제목으로 바로 번역했어요."
  );
  assert.equal(requestCount, 1);
  assert.equal(elapsedMs < 2200, true);
});

test("designer chat returns structured invalid_model_output when the selected model leaves translation in English", { skip: "legacy selected-provider validation is superseded by Codex CLI schema validation" }, async (t) => {
  const mockAi = await startMockAiServer(async (req, res) => {
    if (!isChatCompletionRequest(req) && !isOllamaGenerateRequest(req)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    sendRewriteResponse(
      req,
      res,
      "1\tThe request could not be completed because the server is unavailable."
    );
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "ollama",
      XBRIDGE_AI_MODEL: "qwen3.5:9b",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const response = await fetch(`${bridge.origin}/api/designer/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pluginId: "page:designer-invalid-translation",
      request: "선택한 텍스트를 한글로 번역 적용해줘",
      figmaContext: {
        pageName: "Beta",
        selection: [
          {
            id: "1",
            name: "body",
            type: "TEXT",
            characters: "The request could not be completed because the server is unavailable."
          }
        ]
      }
    })
  });
  const result = await response.json();

  assert.equal(response.status, 422);
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_model_output");
  assert.equal(result.details.outputValidation.valid, false);
});

test("designer chat rewrites selected text through Codex CLI without legacy provider calls", async (t) => {
  let capturedRequestBody = null;
  const mockAi = await startMockAiServer(async (req, res) => {
    capturedRequestBody = await readJsonRequestBody(req);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "legacy provider should not be called" }));
  });
  const mockCodex = await createMockCodexCliScript({
    result: {
      summary: "선택한 텍스트를 AI 관련 게시물 제목으로 바꿨습니다.",
      updates: [
        { id: "20:1", text: "AI 모델 개발 튜토리얼 모음" },
        { id: "20:2", text: "로컬 LLM 실전 활용 사례 정리" }
      ]
    }
  });
  t.after(async () => {
    await mockAi.close();
    await mockCodex.cleanup();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "ollama",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: "",
      XBRIDGE_CODEX_CLI_WRITE_ENABLED: "1",
      XBRIDGE_CODEX_CLI_BIN: process.execPath,
      XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-fast-ai-generic-rewrite";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    request: "선택한 텍스트를 ai 관련 게시물 제목으로 변경해줘",
    figmaContext: {
      fileName: "FDS",
      pageId: "1:1",
      pageName: "History",
      selection: [
        { id: "20:1", name: "title-1", type: "TEXT", characters: "Cell text" },
        { id: "20:2", name: "title-2", type: "TEXT", characters: "Cell text" }
      ]
    }
  });

  const bulkUpdate = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(bulkUpdate.body.commands.length, 1);
  assert.equal(bulkUpdate.body.commands[0].type, "bulk_update_texts");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: bulkUpdate.body.commands[0].commandId,
    result: {
      updated: [
        { id: "20:1", name: "title-1", characters: "AI 모델 개발 튜토리얼 모음" },
        { id: "20:2", name: "title-2", characters: "로컬 LLM 실전 활용 사례 정리" }
      ]
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.fastPath?.type, "selection_text_rewrite_ai");
  assert.equal(response.body.aiBackend, "codex_cli");
  assert.equal(response.body.codexStatus, "completed");
  assert.equal(response.body.fallbackUsed, false);
  assert.equal(response.body.execution.summary.commandCount, 1);
  assert.equal(
    response.body.designerSuggestionBundle.summaryText,
    "선택 텍스트 2개를 요청한 방향에 맞게 빠르게 바꿨습니다."
  );
  assert.equal(
    response.body.ai?.response?.reply,
    "선택한 텍스트를 AI 관련 게시물 제목으로 바꿨습니다."
  );
  assert.equal(response.body.ai?.provider, "codex_cli");
  assert.equal(capturedRequestBody, null);
});

test("designer chat fast-path also handles selected-text translation requests with the configured AI", { skip: "legacy provider rewrite contract replaced by Codex-first text rewrite" }, async (t) => {
  let capturedRequestBody = null;
  const mockAi = await startMockAiServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    capturedRequestBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "선택한 텍스트를 한글 제목으로 바로 번역했어요.",
                updates: [
                  { id: "20:1", text: "대시보드 페이지 와이어프레임 만들기" },
                  { id: "20:2", text: "메시지 페이지 하이파이 디자인 만들기" }
                ],
                safety: {
                  canApply: false,
                  reason: "Preview before confirm"
                }
              })
            }
          }
        ]
      })
    );
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "custom",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-fast-ai-translation";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    request: "선택한 텍스트를 한글로 번역 적용해줘",
    figmaContext: {
      fileName: "Garuda",
      pageId: "1:1",
      pageName: "Board",
      selection: [
        { id: "20:1", name: "title-1", type: "TEXT", characters: "Create wireframe for Dashboard page" },
        { id: "20:2", name: "title-2", type: "TEXT", characters: "Create hi-fi design for messages page" }
      ]
    }
  });

  const bulkUpdate = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(bulkUpdate.body.commands.length, 1);
  assert.equal(bulkUpdate.body.commands[0].type, "bulk_update_texts");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: bulkUpdate.body.commands[0].commandId,
    result: {
      updated: [
        { id: "20:1", name: "title-1", characters: "대시보드 페이지 와이어프레임 만들기" },
        { id: "20:2", name: "title-2", characters: "메시지 페이지 하이파이 디자인 만들기" }
      ]
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.fastPath?.type, "selection_text_rewrite_ai");
  assert.equal(response.body.execution.summary.commandCount, 1);
  assert.equal(
    response.body.ai?.response?.reply,
    "선택한 텍스트를 한글 제목으로 바로 번역했어요."
  );
  assert.equal(capturedRequestBody?.model, "local-test-model");
});

test("designer chat fast-path also matches compact selected-text translation phrasing", { skip: "legacy provider rewrite contract replaced by Codex-first text rewrite" }, async (t) => {
  const mockAi = await startMockAiServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "선택 텍스트를 바로 번역했어요.",
                updates: [
                  { id: "21:1", text: "대시보드" },
                  { id: "21:2", text: "메시지" }
                ],
                safety: {
                  canApply: false,
                  reason: "Preview before confirm"
                }
              })
            }
          }
        ]
      })
    );
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "custom",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-fast-ai-compact-translation";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    request: "선택 텍스트 한글로 번역 적용",
    figmaContext: {
      fileName: "Garuda",
      pageId: "1:1",
      pageName: "Board",
      selection: [
        { id: "21:1", name: "title-1", type: "TEXT", characters: "Dashboard" },
        { id: "21:2", name: "title-2", type: "TEXT", characters: "Messages" }
      ]
    }
  });

  const bulkUpdate = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(bulkUpdate.body.commands.length, 1);
  assert.equal(bulkUpdate.body.commands[0].type, "bulk_update_texts");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: bulkUpdate.body.commands[0].commandId,
    result: {
      updated: [
        { id: "21:1", name: "title-1", characters: "대시보드" },
        { id: "21:2", name: "title-2", characters: "메시지" }
      ]
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.fastPath?.type, "selection_text_rewrite_ai");
});

test("designer chat lets AI unlock selected-text fast-path when the phrasing does not match bridge rewrite heuristics", { skip: "legacy provider preflight reclassification is superseded by Codex-first planning" }, async (t) => {
  const calls = [];
  const mockAi = await startMockAiServer(async (req, res) => {
    if (!isChatCompletionRequest(req) && !isOllamaGenerateRequest(req)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    const requestBody = await readJsonRequestBody(req);
    const userContent = getRewriteUserContentFromRequest(req, requestBody);
    const parsed = parseRewriteUserContent(userContent);
    calls.push({ parsed, userContent });

    const isRewritePreview =
      Array.isArray(parsed?.textNodes) && parsed.textNodes.length > 0;
    if (isRewritePreview) {
      sendRewriteResponse(
        req,
        res,
        JSON.stringify({
          reply: "선택한 텍스트를 자연스러운 한국어 UI 카피로 옮겼어요.",
          updates: parsed.textNodes.map((node, index) => ({
            id: node.id,
            text: `id${node.id} 한국어 UI 카피 ${index + 1}`
          })),
          safety: {
            canApply: false,
            reason: "Preview before confirm"
          }
        })
      );
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "이 요청은 선택한 텍스트를 한국어 UI 카피로 옮기는 작업으로 보겠습니다.",
                intent: {
                  kind: "revise_copy",
                  confidence: "high"
                },
                readRequests: [],
                actionPlan: [],
                safety: {
                  canApply: false,
                  reason: "텍스트 변경 초안을 먼저 만들겠습니다."
                }
              })
            }
          }
        ]
      })
    );
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "custom",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-ai-unlocks-fast-path";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    request: "이 선택 항목들을 자연스러운 한국어 UI 카피로 옮겨줘",
    figmaContext: {
      fileName: "FDS",
      pageId: "1:1",
      pageName: "History",
      selection: [
        { id: "40:1", name: "title-1", type: "TEXT", characters: "Create wireframe for Dashboard page" },
        { id: "40:2", name: "title-2", type: "TEXT", characters: "Create wireframe for analytics page" }
      ]
    }
  });

  const bulkUpdate = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(bulkUpdate.body.commands.length, 1);
  assert.equal(bulkUpdate.body.commands[0].type, "bulk_update_texts");
  assert.deepEqual(
    bulkUpdate.body.commands[0].payload.updates.map((entry) => entry.text),
    ["한국어 UI 카피 1", "한국어 UI 카피 2"]
  );

  await postJson(bridge.origin, "/plugin/results", {
    commandId: bulkUpdate.body.commands[0].commandId,
    result: {
      updated: bulkUpdate.body.commands[0].payload.updates.map((entry) => ({
        id: entry.nodeId,
        name: entry.nodeId,
        characters: entry.text
      }))
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.fastPath?.type, "selection_text_rewrite_ai");
  assert.equal(calls.length >= 2, true);
});

test("designer chat fast-path batches larger selected-text rewrites for configured AI", { skip: "legacy provider batching is superseded by Codex-first text rewrite batching" }, async (t) => {
  let requestCount = 0;
  const mockAi = await startMockAiServer(async (req, res) => {
    if (!isChatCompletionRequest(req) && !isOllamaGenerateRequest(req)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    const requestBody = await readJsonRequestBody(req);
    const userContent = getRewriteUserContentFromRequest(req, requestBody);
    const parsed = parseRewriteUserContent(userContent);
    const textNodes = Array.isArray(parsed?.textNodes) ? parsed.textNodes : [];
    assert.equal(parsed?.request, "선택한 텍스트를 ai 관련 게시물 제목으로 변경해줘");
    requestCount += 1;

    sendRewriteResponse(
      req,
      res,
      JSON.stringify({
        reply: `선택한 텍스트 ${textNodes.length}개 초안을 만들었어요.`,
        updates: textNodes.map((node, index) => ({
          id: node.id,
          text: `AI 제목 ${requestCount}-${index + 1}`
        })),
        safety: {
          canApply: false,
          reason: "Preview before confirm"
        }
      })
    );
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "ollama",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-fast-ai-batched-rewrite";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const selection = Array.from({ length: 7 }, (_, index) => ({
    id: `20:${index + 1}`,
    name: `title-${index + 1}`,
    type: "TEXT",
    characters: "Cell text"
  }));

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    request: "선택한 텍스트를 ai 관련 게시물 제목으로 변경해줘",
    figmaContext: {
      fileName: "FDS",
      pageId: "1:1",
      pageName: "History",
      selection
    }
  });

  const bulkUpdate = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(bulkUpdate.body.commands.length, 1);
  assert.equal(bulkUpdate.body.commands[0].type, "bulk_update_texts");
  assert.equal(bulkUpdate.body.commands[0].payload.updates.length, 7);

  await postJson(bridge.origin, "/plugin/results", {
    commandId: bulkUpdate.body.commands[0].commandId,
    result: {
      updated: bulkUpdate.body.commands[0].payload.updates.map((entry) => ({
        id: entry.nodeId,
        name: entry.nodeId,
        characters: entry.text
      }))
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.fastPath?.type, "selection_text_rewrite_ai");
  assert.equal(requestCount >= 2, true);
});

test("designer chat fast-path retries local rewrite previews with smaller batches when a larger batch fails", { skip: "legacy local-provider retry behavior is not part of Codex-only fallback policy" }, async (t) => {
  let requestCount = 0;
  const mockAi = await startMockAiServer(async (req, res) => {
    if (!isChatCompletionRequest(req) && !isOllamaGenerateRequest(req)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    const requestBody = await readJsonRequestBody(req);
    const userContent = getRewriteUserContentFromRequest(req, requestBody);
    const parsed = parseRewriteUserContent(userContent);
    const textNodes = Array.isArray(parsed?.textNodes) ? parsed.textNodes : [];
    requestCount += 1;

    if (textNodes.length > 1) {
      sendRewriteResponse(
        req,
        res,
        JSON.stringify({
          reply: "한 번에 너무 많은 초안을 만들지 못했습니다.",
          updates: [],
          safety: {
            canApply: false,
            reason: "Preview before confirm"
          }
        })
      );
      return;
    }

    sendRewriteResponse(
      req,
      res,
      JSON.stringify({
        reply: `선택한 텍스트 ${textNodes.length}개 초안을 만들었어요.`,
        updates: textNodes.map((node) => ({
          id: node.id,
          text: `${node.characters} 번역`
        })),
        safety: {
          canApply: false,
          reason: "Preview before confirm"
        }
      })
    );
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "ollama",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-fast-ai-adaptive-retry";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const selection = Array.from({ length: 5 }, (_, index) => ({
    id: `30:${index + 1}`,
    name: `title-${index + 1}`,
    type: "TEXT",
    characters: `Cell text ${index + 1}`
  }));

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    request: "선택한 텍스트를 한글로 번역 적용해줘",
    figmaContext: {
      fileName: "FDS",
      pageId: "1:1",
      pageName: "History",
      selection
    }
  });

  const bulkUpdate = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(bulkUpdate.body.commands.length, 1);
  assert.equal(bulkUpdate.body.commands[0].type, "bulk_update_texts");
  assert.equal(bulkUpdate.body.commands[0].payload.updates.length, 5);

  await postJson(bridge.origin, "/plugin/results", {
    commandId: bulkUpdate.body.commands[0].commandId,
    result: {
      updated: bulkUpdate.body.commands[0].payload.updates.map((entry) => ({
        id: entry.nodeId,
        name: entry.nodeId,
        characters: entry.text
      }))
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.fastPath?.type, "selection_text_rewrite_ai");
  assert.equal(requestCount >= 1, true);
});

test("designer chat lets AI reclassify ambiguous requests before the bridge builds the read plan", { skip: "legacy provider preflight reclassification is superseded by Codex-first planning" }, async (t) => {
  const responses = [
    {
      reply: "먼저 선택된 카드의 텍스트를 기준으로 제목 변경 흐름으로 보겠습니다.",
      intent: {
        kind: "revise_copy",
        confidence: "high"
      },
      readRequests: [],
      actionPlan: [],
      safety: {
        canApply: false,
        reason: "적용 전 텍스트 컨텍스트를 더 읽어야 합니다."
      }
    },
    {
      reply: "선택한 카드의 텍스트를 기준으로 제목 변경 방향을 정리했어요.",
      intent: {
        kind: "revise_copy",
        confidence: "high"
      },
      readRequests: [],
      actionPlan: [],
      safety: {
        canApply: false,
        reason: "아직 제안 단계입니다."
      }
    }
  ];
  const capturedBodies = [];

  const mockAi = await startMockAiServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    capturedBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const payload = responses.shift() || responses[responses.length - 1];

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(payload)
            }
          }
        ]
      })
    );
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "custom",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const response = await fetch(`${bridge.origin}/api/designer/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pluginId: "default",
      message: "선택한 카드 제목을 현재 사회 이슈 제목으로 바꿔줘",
      figmaContext: {
        fileName: "FDS",
        pageName: "History",
        selection: [{ id: "10:1", name: "Issue Card", type: "FRAME" }]
      }
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.intentEnvelope.intents[0].kind, "revise_copy");
  assert.equal(body.designerSuggestionBundle.intentKind, "revise_copy");
  assert.equal(body.execution.readPlan.intentKind, "revise_copy");
  assert.equal(
    body.ai?.response?.reply,
    "선택한 카드의 텍스트를 기준으로 제목 변경 방향을 정리했어요."
  );
  assert.equal(capturedBodies.length, 2);
  assert.equal(
    capturedBodies[0]?.messages?.[1]?.content?.includes("\"readExecutionSummary\": null"),
    true
  );
});

test("designer chat lets AI augment the bridge read plan with explicit read requests", { skip: "legacy provider read-plan augmentation is superseded by Context Model v1 plus Codex suggestion" }, async (t) => {
  const responses = [
    {
      reply: "텍스트 중심으로 먼저 읽어볼게요.",
      intent: {
        kind: "revise_copy",
        confidence: "high"
      },
      readRequests: [
        {
          phase: "fast_context",
          reason: "텍스트 제목 변경 요청이라 텍스트 노드를 먼저 보는 편이 좋습니다.",
          command: "list_text_nodes"
        }
      ],
      actionPlan: [],
      safety: {
        canApply: false,
        reason: "먼저 텍스트 컨텍스트를 읽습니다."
      }
    },
    {
      reply: "텍스트 기준으로 읽기 계획을 다시 잡았어요.",
      intent: {
        kind: "revise_copy",
        confidence: "high"
      },
      readRequests: [],
      actionPlan: [],
      safety: {
        canApply: false,
        reason: "읽기 기반 제안 단계입니다."
      }
    }
  ];

  const mockAi = await startMockAiServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const payload = responses.shift() || responses[responses.length - 1];

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(payload)
            }
          }
        ]
      })
    );
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "custom",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const response = await fetch(`${bridge.origin}/api/designer/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pluginId: "default",
      message: "선택한 카드 제목을 현재 사회 이슈 제목으로 바꿔줘",
      figmaContext: {
        fileName: "FDS",
        pageName: "History",
        selection: [{ id: "10:1", name: "Issue Card", type: "FRAME" }]
      }
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.execution.readPlan.phases[0].commands, [
    "get_selection",
    "get_metadata",
    "list_text_nodes"
  ]);
  assert.equal(
    body.execution.readPlan.phases[0].reason.includes("텍스트 제목 변경 요청"),
    true
  );
});

test("designer chat exposes AI action-plan items through the bridge suggestion preview", { skip: "legacy provider action-plan items are being replaced by Codex structured suggestions" }, async (t) => {
  const responses = [
    {
      reply: "위계 판단을 위해 카드 구조를 먼저 읽겠습니다.",
      intent: {
        kind: "improve_hierarchy",
        confidence: "high"
      },
      readRequests: [],
      actionPlan: [],
      safety: {
        canApply: false,
        reason: "먼저 읽기 단계가 필요합니다."
      }
    },
    {
      reply: "AI가 다음 구조 정리 액션을 제안했어요.",
      intent: {
        kind: "improve_hierarchy",
        confidence: "high"
      },
      readRequests: [],
      actionPlan: [
        {
          title: "제목과 설명 영역을 분리해서 재정렬하기",
          detail: "상단 메시지와 보조 설명을 분리해 위계를 더 선명하게 만듭니다.",
          requiresConfirmation: true
        }
      ],
      safety: {
        canApply: false,
        reason: "확인 후 적용이 적절합니다."
      }
    }
  ];

  const mockAi = await startMockAiServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const payload = responses.shift() || responses[responses.length - 1];

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(payload)
            }
          }
        ]
      })
    );
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "custom",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const response = await fetch(`${bridge.origin}/api/designer/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pluginId: "default",
      message: "선택한 카드의 정보 위계를 정리해줘",
      figmaContext: {
        fileName: "FDS",
        pageName: "History",
        selection: [{ id: "10:1", name: "Issue Card", type: "FRAME" }]
      }
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(
    body.designerSuggestionBundle.recommendations.some((item) =>
      item.title.includes("제목과 설명 영역을 분리해서 재정렬하기")
    ),
    true
  );
  assert.equal(
    body.designerActionPreviewBundle.previews.some((item) =>
      item.label.includes("제목과 설명 영역을 분리해서 재정렬하기")
    ),
    true
  );
});

test("designer chat uses Codex CLI for inspect_selection and avoids legacy provider calls", async (t) => {
  let aiRequestCount = 0;
  const mockAi = await startMockAiServer(async (_req, res) => {
    aiRequestCount += 1;
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "inspect selection should not call AI" }));
  });
  const mockCodex = await createMockCodexCliScript();
  t.after(async () => {
    await mockAi.close();
    await mockCodex.cleanup();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "custom",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: "",
      XBRIDGE_CODEX_CLI_ENABLED: "1",
      XBRIDGE_CODEX_CLI_BIN: process.execPath,
      XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const response = await fetch(`${bridge.origin}/api/designer/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pluginId: "default",
      message: "선택한 버튼 인스턴스의 variant와 override를 설명해줘",
      figmaContext: {
        fileName: "Agent_skill_test",
        pageName: "Page 55",
        selection: [{ id: "10:1", name: "Primary Button", type: "INSTANCE" }]
      }
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.intentEnvelope.intents[0].kind, "inspect_selection");
  assert.equal(body.ai?.provider, "codex_cli");
  assert.equal(aiRequestCount, 0);
  assert.equal(body.designerSuggestionBundle.codex?.source, "codex_cli");
  assert.equal(
    body.designerSuggestionBundle.findings.some((item) =>
      String(item.label || "").includes("선택")
    ),
    true
  );
});

test("designer inspect falls back quickly when Codex CLI is slower than the inspect budget", async (t) => {
  const mockCodex = await createMockCodexCliScript({ delayMs: 1600 });
  t.after(async () => {
    await mockCodex.cleanup();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_API_KEY: "",
      XBRIDGE_CODEX_CLI_ENABLED: "1",
      XBRIDGE_CODEX_CLI_BIN: process.execPath,
      XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath,
      XBRIDGE_CODEX_CLI_INSPECT_TIMEOUT_MS: "150"
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const startedAt = Date.now();
  const response = await fetch(`${bridge.origin}/api/designer/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pluginId: "default",
      message: "선택한 버튼 인스턴스의 속성에 대해 설명해줘",
      figmaContext: {
        fileName: "Agent_skill_test",
        pageName: "Page 55",
        selection: [{ id: "10:1", name: "Primary Button", type: "INSTANCE" }]
      }
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.intentKind, "inspect_selection");
  assert.equal(body.aiBackend, "codex_cli");
  assert.equal(body.codexStatus, "timeout");
  assert.equal(body.fallbackUsed, true);
  assert.equal(body.fallbackReason, "codex_cli_timeout");
  assert.equal(body.ai.status, "fallback");
  assert.equal(Date.now() - startedAt < 1800, true);
});

test("designer chat re-targets inspect_selection detail reads to the live selected node id", async (t) => {
  let aiRequestCount = 0;
  const mockAi = await startMockAiServer(async (_req, res) => {
    aiRequestCount += 1;
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "inspect selection should not call AI" }));
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "custom",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:inspect-selection-live-target";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId: "default",
    message: "선택한 버튼 인스턴스의 variant와 override를 설명해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [{ id: "10:1", name: "Primary Button", type: "INSTANCE" }]
    }
  });

  const firstPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(firstPoll.body.commands.length, 1);
  assert.equal(firstPoll.body.commands[0].type, "get_selection");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: firstPoll.body.commands[0].commandId,
    result: {
      selection: [{ id: "33333:341", name: "button", type: "INSTANCE", visible: true }]
    }
  });

  const metadataPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(metadataPoll.body.commands[0].type, "get_metadata");
  assert.equal(metadataPoll.body.commands[0].payload.targetNodeId, "33333:341");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: metadataPoll.body.commands[0].commandId,
    result: {
      metadataTree: {
        id: "33333:341",
        name: "button",
        type: "INSTANCE",
        children: []
      }
    }
  });

  const instancePoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(instancePoll.body.commands[0].type, "get_instance_details");
  assert.equal(instancePoll.body.commands[0].payload.targetNodeId, "33333:341");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: instancePoll.body.commands[0].commandId,
    result: {
      detail: {
        node: { id: "33333:341", name: "button", type: "INSTANCE" },
        sourceComponent: { name: "Button / Primary" },
        variantProperties: { Size: "Large", Tone: "Primary" },
        componentProperties: { Label: { type: "TEXT", value: "Continue" } }
      }
    }
  });

  const detailPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(detailPoll.body.commands[0].type, "get_node_details");
  assert.equal(detailPoll.body.commands[0].payload.targetNodeId, "33333:341");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: detailPoll.body.commands[0].commandId,
    result: {
      detail: {
        node: { id: "33333:341", name: "button", type: "INSTANCE", childCount: 0 },
        layout: { layoutMode: "HORIZONTAL", itemSpacing: 8 }
      }
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.intentEnvelope.intents[0].kind, "inspect_selection");
  assert.equal(aiRequestCount, 0);
  assert.equal(
    response.body.designerSuggestionBundle.findings.some((item) =>
      String(item.label || "").includes("인스턴스")
    ),
    true
  );
  assert.equal(Array.isArray(response.body.execution?.phases), false);
  assert.equal(
    response.body.execution?.contextModel?.focusedNode?.componentProperties?.Label?.value,
    "Continue"
  );
});

test("designer inspect endpoint returns selected instance context through Codex CLI", async (t) => {
  let aiRequestCount = 0;
  const mockAi = await startMockAiServer(async (_req, res) => {
    aiRequestCount += 1;
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "inspect endpoint should not call AI" }));
  });
  const mockCodex = await createMockCodexCliScript();
  t.after(async () => {
    await mockAi.close();
    await mockCodex.cleanup();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "custom",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: "",
      XBRIDGE_CODEX_CLI_ENABLED: "1",
      XBRIDGE_CODEX_CLI_BIN: process.execPath,
      XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:inspect-selection-endpoint";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/inspect-selection", {
    pluginId: "default",
    request: "선택한 버튼 인스턴스의 variant와 override를 설명해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [{ id: "10:1", name: "Primary Button", type: "INSTANCE" }]
    }
  });

  const selectionPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(selectionPoll.body.commands[0].type, "get_selection");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: selectionPoll.body.commands[0].commandId,
    result: {
      selection: [{ id: "33333:341", name: "button", type: "INSTANCE", visible: true }]
    }
  });

  const metadataPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(metadataPoll.body.commands[0].type, "get_metadata");
  assert.equal(metadataPoll.body.commands[0].payload.targetNodeId, "33333:341");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: metadataPoll.body.commands[0].commandId,
    result: {
      metadataTree: {
        id: "33333:341",
        name: "button",
        type: "INSTANCE",
        children: []
      }
    }
  });

  const instancePoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(instancePoll.body.commands[0].type, "get_instance_details");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: instancePoll.body.commands[0].commandId,
    result: {
      detail: {
        node: { id: "33333:341", name: "button", type: "INSTANCE" },
        sourceComponent: { name: "Button / Primary" },
        variantProperties: { state: "default", size: "lg" },
        componentProperties: { label: { type: "TEXT", value: "Button" } }
      }
    }
  });

  const detailPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(detailPoll.body.commands[0].type, "get_node_details");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: detailPoll.body.commands[0].commandId,
    result: {
      detail: {
        node: { id: "33333:341", name: "button", type: "INSTANCE", childCount: 0 },
        layout: { layoutMode: "HORIZONTAL", itemSpacing: 8 }
      }
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.intentKind, "inspect_selection");
  assert.equal(response.body.ai?.provider, "codex_cli");
  assert.equal(aiRequestCount, 0);
  assert.equal(response.body.designerSuggestionBundle.codex?.source, "codex_cli");
  assert.equal(response.body.execution?.contextModel?.focusedNode?.sourceComponent?.name, "Button / Primary");
  assert.deepEqual(response.body.execution?.contextModel?.focusedNode?.variantProperties, {
    state: "default",
    size: "lg"
  });
});

test("designer chat can use codex cli structured inspect output when enabled", async (t) => {
  const mockCodex = await createMockCodexCliScript({
    result: {
      intent: "inspect_selection",
      summary: "선택한 인스턴스의 variant와 override를 확인했습니다.",
      details: [
        "원본 컴포넌트는 Button / Primary 입니다.",
        "현재 variant 값은 Size=Large, Tone=Primary 입니다.",
        "현재 override는 Label=Continue 입니다."
      ],
      followUp: "현재 variant와 override 차이를 먼저 기록하기"
    }
  });
  t.after(async () => {
    await mockCodex.cleanup();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_CODEX_CLI_ENABLED: "1",
      XBRIDGE_CODEX_CLI_BIN: process.execPath,
      XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:inspect-selection-codex-cli";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId: "default",
    message: "선택한 버튼 인스턴스의 variant와 override를 설명해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [{ id: "10:1", name: "Primary Button", type: "INSTANCE" }]
    }
  });

  const firstPoll = await waitForPluginCommands(bridge.origin, pluginId);
  await postJson(bridge.origin, "/plugin/results", {
    commandId: firstPoll.body.commands[0].commandId,
    result: {
      selection: [{ id: "33333:341", name: "button", type: "INSTANCE", visible: true }]
    }
  });

  const metadataPoll = await waitForPluginCommands(bridge.origin, pluginId);
  await postJson(bridge.origin, "/plugin/results", {
    commandId: metadataPoll.body.commands[0].commandId,
    result: {
      metadataTree: {
        id: "33333:341",
        name: "button",
        type: "INSTANCE",
        children: []
      }
    }
  });

  const instancePoll = await waitForPluginCommands(bridge.origin, pluginId);
  await postJson(bridge.origin, "/plugin/results", {
    commandId: instancePoll.body.commands[0].commandId,
    result: {
      detail: {
        node: { id: "33333:341", name: "button", type: "INSTANCE" },
        sourceComponent: { name: "Button / Primary" },
        variantProperties: { Size: "Large", Tone: "Primary" },
        componentProperties: { Label: { type: "TEXT", value: "Continue" } }
      }
    }
  });

  const detailPoll = await waitForPluginCommands(bridge.origin, pluginId);
  await postJson(bridge.origin, "/plugin/results", {
    commandId: detailPoll.body.commands[0].commandId,
    result: {
      detail: {
        node: { id: "33333:341", name: "button", type: "INSTANCE", childCount: 0 },
        layout: { layoutMode: "HORIZONTAL", itemSpacing: 8 }
      }
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.designerSuggestionBundle.codex?.source, "codex_cli");
  assert.equal(
    response.body.designerSuggestionBundle.findings[0]?.label,
    "선택한 인스턴스의 variant와 override를 확인했습니다."
  );
  assert.equal(
    response.body.designerSuggestionBundle.findings[0]?.detail.includes("원본 컴포넌트는 Button / Primary 입니다."),
    true
  );
  assert.equal(
    response.body.designerSuggestionBundle.recommendations[0]?.title,
    "현재 variant와 override 차이를 먼저 기록하기"
  );
});

test("designer action candidate endpoint runs a safe read-only bridge command", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-action-candidate";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/action-candidates/run", {
    pluginId,
    candidate: {
      command: "list_text_nodes",
      readOnly: true,
      targetNodeId: "10:1",
      argsHint: {
        scope: "target"
      }
    }
  });

  const polled = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polled.body.commands.length, 1);
  assert.equal(polled.body.commands[0].type, "list_text_nodes");
  assert.equal(polled.body.commands[0].payload.targetNodeId, "10:1");
  assert.equal(polled.body.commands[0].payload.scope, "target");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polled.body.commands[0].commandId,
    result: {
      root: { id: "10:1", name: "Issue Card", type: "FRAME" },
      textNodes: [
        { id: "20:1", name: "title", characters: "원래 제목" }
      ]
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.command, "list_text_nodes");
  assert.equal(Array.isArray(response.body.result?.textNodes), true);
  assert.equal(response.body.result.textNodes.length, 1);
});

test("designer write candidate preview and confirm flow generates drafts before applying", { skip: "legacy provider write-preview contract replaced by Codex CLI structured write_plan" }, async (t) => {
  const mockAi = await startMockAiServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const requestBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(requestBody.model, "local-test-model");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "이슈 제목 초안을 만들었습니다.",
                updates: [
                  { id: "20:1", text: "이란 전쟁" },
                  { id: "20:2", text: "중동 긴장 고조 배경 정리" }
                ],
                safety: {
                  canApply: false,
                  reason: "Preview before confirm"
                }
              })
            }
          }
        ]
      })
    );
  });
  t.after(async () => {
    await mockAi.close();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      XBRIDGE_AI_PROVIDER: "custom",
      XBRIDGE_AI_MODEL: "local-test-model",
      XBRIDGE_AI_BASE_URL: `${mockAi.origin}/v1`,
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-write-candidate";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const previewRequest = postJson(bridge.origin, "/api/designer/action-candidates/preview", {
    pluginId,
    message: "선택한 텍스트 내용을 현재 한국 사회에서 이슈가 되는 제목으로 바꿔줘",
    actionLabel: "시사 이슈 제목으로 바꾸기",
    candidate: {
      command: "bulk_update_texts",
      readOnly: false,
      targetNodeId: "10:1",
      argsHint: {
        targetNodeId: "10:1",
        scope: "target"
      }
    },
    figmaContext: {
      fileName: "FDS",
      pageName: "History"
    }
  });

  const previewPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(previewPoll.body.commands.length, 1);
  assert.equal(previewPoll.body.commands[0].type, "list_text_nodes");
  assert.equal(previewPoll.body.commands[0].payload.targetNodeId, "10:1");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: previewPoll.body.commands[0].commandId,
    result: {
      root: { id: "10:1", name: "Issue Card", type: "FRAME" },
      textNodes: [
        { id: "20:1", name: "title", characters: "Cell text" },
        { id: "20:2", name: "body", characters: "Cell text" }
      ]
    }
  });

  const previewResponse = await previewRequest;
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.body.ok, true);
  assert.equal(previewResponse.body.preview.updateCount, 2);
  assert.equal(previewResponse.body.preview.updates[0].text, "이란 전쟁");

  const confirmRequest = postJson(bridge.origin, "/api/designer/action-candidates/confirm", {
    pluginId,
    candidate: {
      command: "bulk_update_texts",
      readOnly: false,
      targetNodeId: "10:1"
    },
    preview: previewResponse.body.preview
  });

  const confirmPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(confirmPoll.body.commands.length, 1);
  assert.equal(confirmPoll.body.commands[0].type, "bulk_update_texts");
  assert.equal(confirmPoll.body.commands[0].payload.updates.length, 2);
  assert.equal(confirmPoll.body.commands[0].payload.updates[0].text, "이란 전쟁");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: confirmPoll.body.commands[0].commandId,
    result: {
      updated: [
        { id: "20:1", characters: "이란 전쟁" },
        { id: "20:2", characters: "중동 긴장 고조 배경 정리" }
      ]
    }
  });

  const confirmResponse = await confirmRequest;
  assert.equal(confirmResponse.status, 200);
  assert.equal(confirmResponse.body.ok, true);
  assert.equal(confirmResponse.body.appliedUpdateCount, 2);
});

test("designer write candidate preview can use codex cli structured write_plan when enabled", async (t) => {
  const mockCodex = await createMockCodexCliScript({
    result: {
      summary: "선택 텍스트 초안을 만들었습니다.",
      updates: [
        { id: "20:1", text: "짧은 제목" },
        { id: "20:2", text: "짧은 본문" }
      ]
    }
  });
  t.after(async () => {
    await mockCodex.cleanup();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      OPENAI_API_KEY: "",
      XBRIDGE_AI_API_KEY: "",
      XBRIDGE_CODEX_CLI_WRITE_ENABLED: "1",
      XBRIDGE_CODEX_CLI_BIN: process.execPath,
      XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-write-candidate-codex";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const previewRequest = postJson(bridge.origin, "/api/designer/action-candidates/preview", {
    pluginId,
    message: "선택한 텍스트를 더 짧게 바꿔줘",
    actionLabel: "짧게 다듬기",
    candidate: {
      command: "bulk_update_texts",
      readOnly: false,
      targetNodeId: "10:1",
      argsHint: {
        targetNodeId: "10:1",
        scope: "target"
      }
    },
    figmaContext: {
      fileName: "FDS",
      pageName: "History"
    }
  });

  const previewPoll = await waitForPluginCommands(bridge.origin, pluginId);
  await postJson(bridge.origin, "/plugin/results", {
    commandId: previewPoll.body.commands[0].commandId,
    result: {
      root: { id: "10:1", name: "Issue Card", type: "FRAME" },
      textNodes: [
        { id: "20:1", name: "title", characters: "긴 제목" },
        { id: "20:2", name: "body", characters: "긴 본문" }
      ]
    }
  });

  const previewResponse = await previewRequest;
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.body.ok, true);
  assert.equal(previewResponse.body.provider, "codex_cli");
  assert.equal(previewResponse.body.preview.reply, "선택 텍스트 초안을 만들었습니다.");
  assert.deepEqual(previewResponse.body.preview.updates, [
    { id: "20:1", text: "짧은 제목" },
    { id: "20:2", text: "짧은 본문" }
  ]);
});

test("designer variant write candidate preview and confirm can use codex cli structured write_plan when enabled", async (t) => {
  const mockCodex = await createMockCodexCliScript({
    result: {
      summary: "현재 variant를 compact 목적에 맞게 조정했습니다.",
      componentNodeId: "30:1",
      variantProperties: {
        Size: "Medium",
        State: "Default"
      }
    }
  });
  t.after(async () => {
    await mockCodex.cleanup();
  });

  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      OPENAI_API_KEY: "",
      XBRIDGE_AI_API_KEY: "",
      XBRIDGE_CODEX_CLI_WRITE_ENABLED: "1",
      XBRIDGE_CODEX_CLI_BIN: process.execPath,
      XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const bridge = {
    origin: `http://127.0.0.1:${await waitForBridgeListening(childProcess)}`,
    childProcess
  };
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-variant-candidate-codex";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const previewRequest = postJson(bridge.origin, "/api/designer/action-candidates/preview", {
    pluginId,
    message: "현재 버튼 variant를 더 compact하게 바꿔줘",
    actionLabel: "variant 조정",
    candidate: {
      command: "set_variant_properties",
      readOnly: false,
      targetNodeId: "30:1",
      argsHint: {
        componentNodeId: "30:1"
      }
    },
    figmaContext: {
      fileName: "FDS",
      pageName: "Components"
    }
  });

  const previewPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(previewPoll.body.commands[0].type, "get_component_variant_details");
  assert.equal(previewPoll.body.commands[0].payload.targetNodeId, "30:1");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: previewPoll.body.commands[0].commandId,
    result: {
      detail: {
        targetNode: {
          id: "30:1",
          name: "Button / Size=Large, State=Default",
          type: "COMPONENT",
          variantProperties: {
            Size: "Large",
            State: "Default"
          }
        },
        componentSet: {
          id: "30:0",
          name: "Button"
        },
        variants: [
          { id: "30:1", name: "Button / Size=Large, State=Default" },
          { id: "30:2", name: "Button / Size=Medium, State=Default" }
        ]
      }
    }
  });

  const previewResponse = await previewRequest;
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.body.ok, true);
  assert.equal(previewResponse.body.provider, "codex_cli");
  assert.equal(previewResponse.body.preview.componentNodeId, "30:1");
  assert.deepEqual(previewResponse.body.preview.variantProperties, {
    Size: "Medium",
    State: "Default"
  });

  const confirmRequest = postJson(bridge.origin, "/api/designer/action-candidates/confirm", {
    pluginId,
    candidate: {
      command: "set_variant_properties",
      readOnly: false,
      targetNodeId: "30:1"
    },
    preview: previewResponse.body.preview
  });

  const confirmPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(confirmPoll.body.commands[0].type, "set_variant_properties");
  assert.equal(confirmPoll.body.commands[0].payload.componentNodeId, "30:1");
  assert.deepEqual(confirmPoll.body.commands[0].payload.variantProperties, {
    Size: "Medium",
    State: "Default"
  });

  await postJson(bridge.origin, "/plugin/results", {
    commandId: confirmPoll.body.commands[0].commandId,
    result: {
      updated: {
        node: { id: "30:1", name: "Button / Size=Medium, State=Default", type: "COMPONENT" },
        variantProperties: { Size: "Medium", State: "Default" }
      }
    }
  });

  const confirmResponse = await confirmRequest;
  assert.equal(confirmResponse.status, 200);
  assert.equal(confirmResponse.body.ok, true);
  assert.equal(confirmResponse.body.appliedUpdateCount, 2);
});

test("designer chat returns selection_required when a text rewrite request arrives without synced selection", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-selection-required";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const response = await fetch(`${bridge.origin}/api/designer/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pluginId,
      message: "선택한 텍스트를 한글로 번역 적용해줘",
      figmaContext: {
        fileName: "FDS",
        pageName: "History",
        selection: []
      }
    })
  });
  const result = await response.json();

  assert.equal(response.status, 409);
  assert.equal(result.ok, false);
  assert.equal(result.code, "selection_required");
  assert.equal(result.error, "현재 선택이 브리지에 동기화되지 않았습니다.");
});

test("designer chat rejects understructured image screen generation with actionable quality details", async (t) => {
  const mockCodex = await createMockCodexCliScript({
    result: {
      summary: "화면을 단순 박스로 축약했습니다.",
      canvasSpecJson: JSON.stringify({
        surfaceType: "mobile-app",
        width: 390,
        height: 844,
        gridUnit: 4,
        margin: { x: 24, y: 0 },
        columns: 4,
        gutter: 16
      }),
      layoutMapJson: JSON.stringify([]),
      roleMapJson: JSON.stringify([
        { id: "title", role: "screen-title", label: "생활통장" },
        { id: "balance", role: "metric", label: "케이뱅크 100" },
        { id: "badge", role: "chip", label: "간편결제" },
        { id: "row", role: "list-row", label: "이벤트 쿠폰 적금 알아보기" },
        { id: "section", role: "section-title", label: "내 자산에서 노출" },
        { id: "button", role: "button", label: "내 자산 연결 해제" }
      ]),
      textStyleMapJson: JSON.stringify([]),
      treeJson: JSON.stringify({
        helper: "screen",
        name: "Generated from image",
        width: 390,
        height: 844,
        children: [
          {
            helper: "card",
            name: "Phone screenshot copy",
            x: 0,
            y: 0,
            width: 390,
            height: 844,
            fill: "#FFFFFF"
          }
        ]
      })
    }
  });
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath,
    XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
    await mockCodex.cleanup();
  });

  const response = await postJson(bridge.origin, "/api/designer/chat", {
    pluginId: "default",
    message: "선택한 이미지를 분석해서 화면으로 구현해줘",
    attachments: [
      {
        kind: "image",
        title: "screen.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AAAA"
      }
    ],
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: []
    }
  });

  assert.equal(response.status, 422);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.code, "codex_cli_image_layout_understructured");
  assert.match(response.body.error, /편집 가능한 Figma 레이어/u);
  assert.equal(response.body.details.imageLayoutQuality.roleCount, 6);
  assert.equal(response.body.details.imageLayoutQuality.generatedNodeCount < 4, true);
  assert.equal(response.body.details.imageLayoutQuality.nodeCoverageTooLow, true);
  assert.equal(response.body.details.imageLayoutQuality.textCoverageTooLow, true);
  assert.equal(response.body.details.imageLayoutQuality.coordinateCoverageTooLow, true);
  assert.equal(
    response.body.details.imageLayoutQuality.missingRoleLabels.includes("이벤트 쿠폰 적금 알아보기"),
    true
  );
  assert.deepEqual(response.body.details.imageLayoutQualitySummary.failureFlags, [
    "nodeCoverageTooLow",
    "textCoverageTooLow",
    "coordinateCoverageTooLow"
  ]);
  assert.equal(
    response.body.details.imageLayoutQualitySummary.labelsToFix.missing.includes("이벤트 쿠폰 적금 알아보기"),
    true
  );
  assert.equal(
    response.body.details.imageLayoutQualitySummary.nextActions.some((item) =>
      item.includes("상태바/헤더/본문")
    ),
    true
  );
});

test("designer chat treats a selected screenshot as image-to-screen input for short create requests", async (t) => {
  const mockCodex = await createMockCodexCliScript({
    result: {
      summary: "선택 이미지를 큰 박스 하나로만 구성했습니다.",
      canvasSpecJson: JSON.stringify({
        surfaceType: "mobile-app",
        width: 390,
        height: 844,
        gridUnit: 4
      }),
      layoutMapJson: JSON.stringify([]),
      roleMapJson: JSON.stringify([
        { id: "header", role: "header-nav", label: "관리" },
        { id: "title", role: "text-group", label: "생활통장" },
        { id: "coupon", role: "list-row", label: "이벤트 쿠폰 적금 알아보기" },
        { id: "toggle", role: "toggle", label: "ON" }
      ]),
      textStyleMapJson: JSON.stringify([]),
      treeJson: JSON.stringify({
        helper: "screen",
        name: "Selected screenshot copy",
        width: 390,
        height: 844,
        layout: "none",
        children: [
          {
            helper: "card",
            name: "Single screenshot slab",
            x: 0,
            y: 0,
            width: 390,
            height: 844,
            fill: "#FFFFFF"
          }
        ]
      })
    }
  });
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath,
    XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
    await mockCodex.cleanup();
  });

  const pluginId = "page:selected-screenshot-image-screen";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "선택한 이미지를 분석해서 화면으로 구현해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [{ id: "55:10", name: "npay_asset_08_reconstruction", type: "RECTANGLE" }]
    }
  });

  const exportPoll = await waitForPluginCommands(bridge.origin, pluginId, { timeoutMs: 2000 });
  assert.equal(exportPoll.body.commands.length, 1);
  assert.equal(exportPoll.body.commands[0].type, "export_node");
  assert.equal(exportPoll.body.commands[0].payload.targetNodeId, "55:10");
  assert.equal(exportPoll.body.commands[0].payload.contentsOnly, true);
  assert.equal(exportPoll.body.commands[0].payload.useAbsoluteBounds, false);
  assert.equal(exportPoll.body.commands[0].payload.scale, 1);

  await postJson(bridge.origin, "/plugin/results", {
    commandId: exportPoll.body.commands[0].commandId,
    result: {
      node: { id: "55:10", name: "npay_asset_08_reconstruction" },
      mimeType: "image/png",
      dataBase64: "QUFBQQ==",
      sizeBytes: 4
    }
  });

  const response = await request;
  assert.equal(response.status, 422);
  assert.equal(response.body.code, "codex_cli_image_layout_understructured");
  assert.equal(response.body.details.imageLayoutQuality.roleCount, 4);
});

test("designer chat exports selected frame screenshots with bounded frame-safe options", async (t) => {
  const mockCodex = await createMockCodexCliScript({
    result: {
      summary: "프레임 선택 이미지를 구성했습니다.",
      canvasSpecJson: JSON.stringify({
        surfaceType: "mobile-app",
        width: 402,
        height: 870,
        gridUnit: 4
      }),
      layoutMapJson: JSON.stringify([]),
      roleMapJson: JSON.stringify([
        { id: "title", role: "text-group", label: "Running Challenge" },
        { id: "results", role: "table", label: "Results" }
      ]),
      textStyleMapJson: JSON.stringify([]),
      treeJson: JSON.stringify({
        helper: "screen",
        name: "Running Challenge reconstruction",
        width: 402,
        height: 870,
        layout: "none",
        children: [
          {
            helper: "text",
            name: "Running Challenge",
            text: "Running Challenge",
            x: 120,
            y: 64,
            width: 160,
            height: 24
          },
          {
            helper: "text",
            name: "Results",
            text: "Results",
            x: 24,
            y: 420,
            width: 80,
            height: 20
          }
        ]
      })
    }
  });
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath,
    XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
    await mockCodex.cleanup();
  });

  const pluginId = "page:selected-frame-screenshot-image-screen";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "선택한 이미지를 분석해서 화면으로 구현해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [{ id: "33392:3971998", name: "Frame 2", type: "FRAME" }]
    }
  });

  const exportPoll = await waitForPluginCommands(bridge.origin, pluginId, { timeoutMs: 2000 });
  assert.equal(exportPoll.body.commands.length, 1);
  assert.equal(exportPoll.body.commands[0].type, "export_node");
  assert.equal(exportPoll.body.commands[0].payload.targetNodeId, "33392:3971998");
  assert.equal(exportPoll.body.commands[0].payload.contentsOnly, false);
  assert.equal(exportPoll.body.commands[0].payload.useAbsoluteBounds, false);
  assert.equal(exportPoll.body.commands[0].payload.scale, 0.25);
  assert.equal(exportPoll.body.commands[0].payload.analysisScope, "clipped_frame_viewport");
  assert.equal(exportPoll.body.commands[0].payload.frameViewportClipped, true);
  assert.equal(exportPoll.body.commands[0].payload.selectedNodeType, "FRAME");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: exportPoll.body.commands[0].commandId,
    result: {
      node: { id: "33392:3971998", name: "Frame 2" },
      mimeType: "image/png",
      dataBase64: "QUFBQQ==",
      sizeBytes: 4
    }
  });

  const response = await request;
  assert.equal(response.status, 422);
  assert.equal(response.body.code, "codex_cli_image_layout_understructured");
});

test("designer chat image analysis only exports and analyzes without building Figma layers", async (t) => {
  const mockCodex = await createMockCodexCliScript({
    result: {
      summary: "선택 이미지의 UI 역할과 텍스트를 분석했습니다.",
      canvasSpecJson: JSON.stringify({
        surfaceType: "mobile-app",
        width: 402,
        height: 870,
        gridUnit: 4
      }),
      layoutMapJson: JSON.stringify([]),
      roleMapJson: JSON.stringify([
        { id: "status", role: "status-bar", textLabels: ["9:41"], bbox: { x: 24, y: 12, width: 48, height: 16 } },
        { id: "title", role: "header-title", label: "Running Challenge", bbox: { x: 120, y: 48, width: 160, height: 24 } },
        { id: "results", role: "section-title", label: "Results", bbox: { x: 24, y: 390, width: 80, height: 20 } },
        { id: "reward", role: "reward-bar", label: "Winner gets 50 coins + Champion Badge", bbox: { x: 24, y: 810, width: 354, height: 36 } }
      ]),
      textStyleMapJson: JSON.stringify([]),
      treeJson: JSON.stringify({
        helper: "screen",
        name: "Running Challenge analysis structure",
        width: 402,
        height: 870,
        layout: "none",
        children: [
          { helper: "text", name: "time", text: "9:41", x: 24, y: 12, width: 48, height: 16 },
          { helper: "text", name: "title", text: "Running Challenge", x: 120, y: 48, width: 160, height: 24 },
          { helper: "text", name: "results", text: "Results", x: 24, y: 390, width: 80, height: 20 },
          { helper: "text", name: "reward", text: "Winner gets 50 coins + Champion Badge", x: 24, y: 810, width: 354, height: 20 }
        ]
      })
    }
  });
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath,
    XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
    await mockCodex.cleanup();
  });

  const pluginId = "page:image-analysis-only";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "선택한 이미지를 분석만 하고 화면 구현은 하지마",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [{ id: "33392:3971998", name: "Frame 2", type: "FRAME" }]
    }
  });

  const exportPoll = await waitForPluginCommands(bridge.origin, pluginId, { timeoutMs: 2000 });
  assert.equal(exportPoll.body.commands.length, 1);
  assert.equal(exportPoll.body.commands[0].type, "export_node");
  assert.equal(exportPoll.body.commands[0].payload.targetNodeId, "33392:3971998");
  assert.equal(exportPoll.body.commands[0].payload.analysisScope, "clipped_frame_viewport");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: exportPoll.body.commands[0].commandId,
    result: {
      node: { id: "33392:3971998", name: "Frame 2" },
      mimeType: "image/png",
      dataBase64: "QUFBQQ==",
      sizeBytes: 4
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.intentKind, "inspect_selection");
  assert.equal(response.body.intentClassification.userIntentKind, "image_analysis_only");
  assert.equal(response.body.imageAnalysis.roleMap.length, 4);
  assert.equal(response.body.imageAnalysis.buildResult, undefined);

  const leftoverPoll = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(leftoverPoll.body.commands.length, 0);
});

test("designer chat classifies image analysis only Codex timeout as debug bridge failure", async (t) => {
  const mockCodex = await createMockCodexCliScript({
    delayMs: 1250,
    result: {
      summary: "늦은 분석 결과입니다.",
      canvasSpecJson: JSON.stringify({ surfaceType: "mobile-app", width: 390, height: 844 }),
      layoutMapJson: JSON.stringify([]),
      roleMapJson: JSON.stringify([]),
      textStyleMapJson: JSON.stringify([]),
      treeJson: JSON.stringify({ helper: "screen", width: 390, height: 844, children: [] })
    }
  });
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath,
    XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath,
    XBRIDGE_CODEX_CLI_IMAGE_TIMEOUT_MS: "50"
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
    await mockCodex.cleanup();
  });

  const pluginId = "page:image-analysis-only-timeout";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "선택한 이미지를 분석만 하고 화면 구현은 하지마",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [{ id: "33392:3971998", name: "Frame 2", type: "FRAME" }]
    }
  });

  const exportPoll = await waitForPluginCommands(bridge.origin, pluginId, { timeoutMs: 2000 });
  assert.equal(exportPoll.body.commands.length, 1);
  assert.equal(exportPoll.body.commands[0].type, "export_node");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: exportPoll.body.commands[0].commandId,
    result: {
      node: { id: "33392:3971998", name: "Frame 2" },
      mimeType: "image/png",
      dataBase64: "QUFBQQ==",
      sizeBytes: 4
    }
  });

  const response = await request;
  assert.equal(response.status, 504);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.code, "debug_bridge_failure");
  assert.equal(response.body.details.imageLayoutQuality.userIntentKind, "image_analysis_only");
  assert.equal(response.body.details.imageLayoutQuality.failureIntentKind, "debug_bridge_failure");
  assert.equal(response.body.details.imageLayoutQuality.failureSource, "codex_cli_timeout");
  assert.equal(response.body.details.imageLayoutQuality.stage, "image_analysis_codex");

  const leftoverPoll = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(leftoverPoll.body.commands.length, 0);
});

test("designer chat diagnoses pasted image-analysis bridge failure without running Figma commands", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:debug-bridge-failure";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const response = await postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message:
      "이미지 분석 화면 구성 실패: 이미지에서 인식한 UI 요소가 편집 가능한 Figma 레이어로 충분히 변환되지 않아 화면 구성을 중단했습니다. " +
      "인식 역할 7개 중 생성 노드 85개, 좌표 노드 38/4개, 텍스트 반영 3/7개입니다. " +
      "누락된 문구: \"9:41, cellular, Wi-Fi, battery\", \"Competitor image collage\". " +
      "이미지에서 인식한 bbox 위치와 같은 문구의 레이어 위치가 어긋났습니다. " +
      "참조 이미지는 프레임 안에 담겨있고 이미지가 프레임보다 더 큰 상태이며 넘친 컨텐츠 숨기기가 켜져 있습니다.",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [{ id: "33392:3971998", name: "Frame 2", type: "FRAME" }]
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.intentKind, "debug_bridge_failure");
  assert.equal(response.body.intentClassification.userIntentKind, "debug_bridge_failure");
  assert.equal(response.body.bridgeFailureDiagnosis.stage, "semantic_quality_gate");
  assert.equal(response.body.bridgeFailureDiagnosis.failureSource, "understructured_layer_conversion");
  assert.equal(response.body.bridgeFailureDiagnosis.metrics.recognizedRoleCount, 7);
  assert.equal(response.body.bridgeFailureDiagnosis.metrics.generatedNodeCount, 85);
  assert.equal(response.body.bridgeFailureDiagnosis.metrics.coordinateNodeCount, 38);
  assert.equal(response.body.bridgeFailureDiagnosis.metrics.coordinateExpectedCount, 4);
  assert.equal(response.body.bridgeFailureDiagnosis.metrics.textMappedCount, 3);
  assert.equal(response.body.bridgeFailureDiagnosis.metrics.textExpectedCount, 7);
  assert.deepEqual(response.body.bridgeFailureDiagnosis.missingTexts, [
    "9:41, cellular, Wi-Fi, battery",
    "Competitor image collage"
  ]);
  assert.equal(
    response.body.bridgeFailureDiagnosis.signals.some((signal) => signal.code === "bbox_alignment_mismatch"),
    true
  );
  assert.equal(
    response.body.bridgeFailureDiagnosis.signals.some((signal) => signal.code === "clipped_viewport_reference"),
    true
  );
  assert.equal(response.body.bridgeFailureDiagnosis.metrics.clippedViewportReferenceLikely, true);
  assert.equal(response.body.designerSuggestionBundle.applyActions.length, 0);

  const leftoverPoll = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(leftoverPoll.body.commands.length, 0);
});

test("designer chat reports selected image export failures distinctly", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:selected-screenshot-export-empty";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "이거 그대로 만들어줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [{ id: "55:10", name: "npay_asset_08_reconstruction", type: "RECTANGLE" }]
    }
  });

  const exportPoll = await waitForPluginCommands(bridge.origin, pluginId, { timeoutMs: 2000 });
  assert.equal(exportPoll.body.commands.length, 1);
  assert.equal(exportPoll.body.commands[0].type, "export_node");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: exportPoll.body.commands[0].commandId,
    result: {
      node: { id: "55:10", name: "npay_asset_08_reconstruction" },
      mimeType: "image/png"
    }
  });

  const response = await request;
  assert.equal(response.status, 422);
  assert.equal(response.body.code, "selected_image_export_failed");
  assert.match(response.body.error, /선택한 이미지/u);
  assert.equal(response.body.details.imageLayoutQuality.targetNodeId, "55:10");
  assert.equal(response.body.details.imageLayoutQuality.reason, "missing_data_base64");
});
