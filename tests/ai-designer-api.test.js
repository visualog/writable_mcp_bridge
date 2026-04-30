import test from "node:test";
import assert from "node:assert/strict";

import { getDesignerAiConfig, runDesignerAiChat } from "../src/ai-designer-api.js";
import { createDesignerIntentEnvelope } from "../src/ai-designer-intents.js";

test("getDesignerAiConfig reads OpenAI-compatible environment", () => {
  const config = getDesignerAiConfig({
    XBRIDGE_AI_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
    XBRIDGE_AI_MODEL: "gpt-test",
    XBRIDGE_AI_BASE_URL: "https://example.test/v1/"
  });

  assert.equal(config.provider, "openai");
  assert.equal(config.configured, true);
  assert.equal(config.apiKey, "sk-test");
  assert.equal(config.model, "gpt-test");
  assert.equal(config.baseUrl, "https://example.test/v1");
});

test("getDesignerAiConfig defaults to NVIDIA Nemotron when provider is omitted", () => {
  const config = getDesignerAiConfig({
    XBRIDGE_AI_API_KEY: "nvapi-test"
  });

  assert.equal(config.provider, "nvidia");
  assert.equal(config.model, "nvidia/nemotron-3-nano-30b-a3b");
  assert.equal(config.baseUrl, "https://integrate.api.nvidia.com/v1");
});

test("getDesignerAiConfig reads NVIDIA-compatible environment", () => {
  const config = getDesignerAiConfig({
    XBRIDGE_AI_PROVIDER: "nvidia",
    XBRIDGE_AI_API_KEY: "nvapi-test",
    XBRIDGE_AI_MODEL: "meta/llama-3.3-70b-instruct"
  });

  assert.equal(config.provider, "nvidia");
  assert.equal(config.configured, true);
  assert.equal(config.apiKey, "nvapi-test");
  assert.equal(config.model, "meta/llama-3.3-70b-instruct");
  assert.equal(config.baseUrl, "https://integrate.api.nvidia.com/v1");
  assert.equal(config.valid, true);
});

test("getDesignerAiConfig detects shifted NVIDIA keychain values", () => {
  const config = getDesignerAiConfig({
    XBRIDGE_AI_PROVIDER: "openai",
    XBRIDGE_AI_API_KEY: "nvapi-test",
    XBRIDGE_AI_MODEL: "https://integrate.api.nvidia.com/v1",
    XBRIDGE_AI_BASE_URL: "nvidia"
  });

  assert.equal(config.valid, false);
  assert.deepEqual(config.validationIssues, ["invalid_base_url", "model_looks_like_url", "base_url_looks_like_provider"]);
});

test("runDesignerAiChat returns unconfigured fallback without an API key", async () => {
  const intentEnvelope = createDesignerIntentEnvelope({
    request: "선택한 카드의 정보 위계를 정리해줘",
    figmaContext: {
      pageName: "Dashboard",
      selection: [{ id: "1:2", name: "Revenue Card" }]
    }
  });
  const ai = await runDesignerAiChat(
    {
      message: "선택한 카드의 정보 위계를 정리해줘",
      intentEnvelope,
      designerSuggestionBundle: {
        recommendations: [{ title: "제목과 보조 정보를 분리" }]
      }
    },
    {
      env: {}
    }
  );

  assert.equal(ai.configured, false);
  assert.equal(ai.status, "unconfigured");
  assert.equal(ai.response.safety.canApply, false);
  assert.equal(ai.response.actionPlan.length, 1);
});

test("runDesignerAiChat calls OpenAI Responses API and parses JSON output", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({
      url,
      init,
      body: JSON.parse(init.body)
    });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: "resp_test",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    reply: "선택한 카드의 제목, 수치, 보조 설명을 분리해 위계를 높이겠습니다.",
                    intent: {
                      kind: "improve_hierarchy",
                      confidence: "high",
                      targetSummary: "Revenue Card"
                    },
                    readRequests: [
                      {
                        phase: "focused_detail",
                        reason: "카드 내부 레이아웃 확인 필요",
                        command: "get_node_details"
                      }
                    ],
                    actionPlan: [
                      {
                        title: "정보 위계 정리",
                        detail: "제목과 수치를 시각적으로 분리",
                        requiresConfirmation: true
                      }
                    ],
                    safety: {
                      canApply: false,
                      reason: "focused detail 확인 전"
                    }
                  })
                }
              ]
            }
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20
          }
        };
      }
    };
  };

  const ai = await runDesignerAiChat(
    {
      message: "선택한 카드의 정보 위계를 정리해줘",
      figmaContext: {
        pageName: "Dashboard",
        selection: [{ id: "1:2", name: "Revenue Card" }]
      }
    },
    {
      fetchImpl,
      config: {
        provider: "openai",
        configured: true,
        apiKey: "sk-test",
        baseUrl: "https://api.openai.test/v1",
        model: "gpt-test"
      }
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.openai.test/v1/responses");
  assert.equal(calls[0].init.headers.Authorization, "Bearer sk-test");
  assert.equal(calls[0].body.model, "gpt-test");
  assert.equal(calls[0].body.input[0].role, "user");
  assert.equal(calls[0].body.instructions.includes("Xbridge Nemotron"), true);
  assert.equal(ai.status, "completed");
  assert.equal(ai.response.intent.kind, "improve_hierarchy");
  assert.equal(ai.response.readRequests[0].command, "get_node_details");
  assert.equal(ai.response.actionPlan[0].title, "정보 위계 정리");
  assert.equal(ai.response.safety.canApply, false);
  assert.equal(ai.responseId, "resp_test");
});

test("runDesignerAiChat calls NVIDIA Chat Completions API and parses JSON output", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({
      url,
      init,
      body: JSON.parse(init.body)
    });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: "resp_nvidia_test",
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({
                  reply: "안녕하세요. 현재 화면을 기준으로 구조를 읽고 다음 디자인 제안을 준비할게요.",
                  intent: {
                    kind: "greet_and_analyze",
                    confidence: "medium",
                    targetSummary: "현재 선택 화면"
                  },
                  readRequests: [
                    {
                      phase: "fast_context",
                      reason: "현재 화면 개요 확인",
                      command: "get_metadata"
                    }
                  ],
                  actionPlan: [
                    {
                      title: "화면 구조 요약",
                      detail: "핵심 섹션과 우선순위를 정리",
                      requiresConfirmation: false
                    }
                  ],
                  safety: {
                    canApply: false,
                    reason: "아직 읽기 기반 제안 단계"
                  }
                })
              }
            }
          ],
          usage: {
            input_tokens: 12,
            output_tokens: 18
          }
        };
      }
    };
  };

  const ai = await runDesignerAiChat(
    {
      message: "안녕",
      figmaContext: {
        pageName: "Landing",
        selection: []
      }
    },
    {
      fetchImpl,
      config: {
        provider: "nvidia",
        configured: true,
        apiKey: "nvapi-test",
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: "meta/llama-3.3-70b-instruct"
      }
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://integrate.api.nvidia.com/v1/chat/completions");
  assert.equal(calls[0].init.headers.Authorization, "Bearer nvapi-test");
  assert.equal(calls[0].body.model, "meta/llama-3.3-70b-instruct");
  assert.equal(Array.isArray(calls[0].body.messages), true);
  assert.equal(calls[0].body.messages[0].role, "system");
  assert.equal(calls[0].body.messages[0].content.includes("Xbridge Nemotron"), true);
  assert.equal(calls[0].body.messages[1].role, "user");
  assert.equal(ai.provider, "nvidia");
  assert.equal(ai.status, "completed");
  assert.equal(ai.response.reply.includes("안녕하세요"), true);
  assert.equal(ai.response.intent.kind, "greet_and_analyze");
  assert.equal(ai.response.readRequests[0].command, "get_metadata");
  assert.equal(ai.response.actionPlan[0].title, "화면 구조 요약");
  assert.equal(ai.response.safety.canApply, false);
  assert.equal(ai.responseId, "resp_nvidia_test");
});

test("runDesignerAiChat respects explicit bridge system prompt override", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({
      url,
      init,
      body: JSON.parse(init.body)
    });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: "resp_override",
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({
                  reply: "override ok",
                  intent: {
                    kind: "analyze",
                    confidence: "medium",
                    targetSummary: "current selection"
                  },
                  readRequests: [],
                  actionPlan: [],
                  safety: {
                    canApply: false,
                    reason: "override test"
                  }
                })
              }
            }
          ]
        };
      }
    };
  };

  await runDesignerAiChat(
    {
      message: "테스트"
    },
    {
      env: {
        XBRIDGE_AI_SYSTEM_PROMPT: "CUSTOM BRIDGE SYSTEM PROMPT"
      },
      fetchImpl,
      config: {
        provider: "nvidia",
        configured: true,
        apiKey: "nvapi-test",
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: "nvidia/nemotron-3-nano-30b-a3b"
      }
    }
  );

  assert.equal(calls[0].body.messages[0].content, "CUSTOM BRIDGE SYSTEM PROMPT");
});

test("runDesignerAiChat returns misconfigured response before fetch when ai config is malformed", async () => {
  let called = false;
  const ai = await runDesignerAiChat(
    {
      message: "안녕"
    },
    {
      fetchImpl: async () => {
        called = true;
        throw new Error("should not be called");
      },
      config: {
        provider: "openai",
        configured: true,
        apiKey: "sk-test",
        baseUrl: "nvidia",
        model: "https://integrate.api.nvidia.com/v1",
        valid: false,
        validationIssues: ["invalid_base_url", "model_looks_like_url", "base_url_looks_like_provider"]
      }
    }
  );

  assert.equal(called, false);
  assert.equal(ai.status, "misconfigured");
  assert.equal(ai.response.reply.includes("AI 설정이 잘못되었습니다"), true);
});
