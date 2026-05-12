import test from "node:test";
import assert from "node:assert/strict";

import {
  discoverLocalDesignerProviders,
  getDesignerAiConfig,
  runDesignerAiChat,
  runDesignerTextRewritePreview
} from "../src/ai-designer-api.js";
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

test("getDesignerAiConfig treats Ollama as keyless local provider with local defaults", () => {
  const config = getDesignerAiConfig({
    XBRIDGE_AI_PROVIDER: "ollama"
  });

  assert.equal(config.provider, "ollama");
  assert.equal(config.configured, true);
  assert.equal(config.apiKey, "ollama");
  assert.equal(config.model, "llama3.2:3b");
  assert.equal(config.baseUrl, "http://127.0.0.1:11434/v1");
});

test("getDesignerAiConfig treats custom provider as keyless when model and base URL are present", () => {
  const config = getDesignerAiConfig({
    XBRIDGE_AI_PROVIDER: "custom",
    XBRIDGE_AI_MODEL: "my-local-model",
    XBRIDGE_AI_BASE_URL: "http://127.0.0.1:1234/v1"
  });

  assert.equal(config.provider, "custom");
  assert.equal(config.configured, true);
  assert.equal(config.model, "my-local-model");
  assert.equal(config.baseUrl, "http://127.0.0.1:1234/v1");
});

test("getDesignerAiConfig treats LM Studio as keyless local provider with local defaults", () => {
  const config = getDesignerAiConfig({
    XBRIDGE_AI_PROVIDER: "lmstudio"
  });

  assert.equal(config.provider, "lmstudio");
  assert.equal(config.configured, true);
  assert.equal(config.apiKey, "lmstudio");
  assert.equal(config.model, "local-model");
  assert.equal(config.baseUrl, "http://127.0.0.1:1234/v1");
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

test("runDesignerTextRewritePreview parses line-based local model output", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택 텍스트 한글로 번역 적용",
      textNodes: [
        { id: "1", name: "title-1", characters: "Create wireframe for Dashboard page" },
        { id: "2", name: "title-2", characters: "Create hi-fi design for messages page" }
      ]
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            response:
              "1\t대시보드 페이지 와이어프레임 생성\n2\t메시지 페이지 하이파이 디자인 생성"
          };
        }
      }),
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3:8b"
      }
    }
  );

  assert.equal(ai.status, "completed");
  assert.equal(ai.response.updates.length, 2);
  assert.deepEqual(ai.response.updates[0], {
    id: "1",
    text: "대시보드 페이지 와이어프레임 생성"
  });
  assert.deepEqual(ai.response.updates[1], {
    id: "2",
    text: "메시지 페이지 하이파이 디자인 생성"
  });
});

test("runDesignerTextRewritePreview sends the original user request to local providers", async () => {
  const calls = [];
  await runDesignerTextRewritePreview(
    {
      message: "선택 텍스트를 한글로 번역 적용",
      textNodes: [
        { id: "1", name: "title-1", characters: "Create wireframe for Dashboard page" }
      ]
    },
    {
      fetchImpl: async (url, init) => {
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
              response: "1\t대시보드 페이지 와이어프레임 생성"
            };
          }
        };
      },
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3:8b"
      }
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:11434/api/generate");
  assert.equal(
    calls[0].body.prompt?.includes("REQUEST\t선택 텍스트를 한글로 번역 적용"),
    true
  );
  assert.equal(calls[0].body.prompt?.includes("MODE\ttranslate"), true);
  assert.equal(calls[0].body.prompt?.includes("NODE\t1\tCreate wireframe for Dashboard page"), true);
  assert.equal(calls[0].body.options?.num_predict, 160);
});

test("runDesignerTextRewritePreview gives title generation enough local generation budget", async () => {
  const calls = [];
  await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트 내용을 ai 기술 트렌드 분석 관련 게시물 제목으로 변경해줘",
      textNodes: [
        { id: "1", name: "title-1", characters: "Cell text" },
        { id: "2", name: "title-2", characters: "Cell text" },
        { id: "3", name: "title-3", characters: "Cell text" }
      ]
    },
    {
      fetchImpl: async (url, init) => {
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
              response: "1\tAI 기술 트렌드 분석\n2\tAI 기술 트렌드 분석\n3\tAI 기술 트렌드 분석"
            };
          }
        };
      },
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3.5:9b"
      }
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.prompt?.includes("MODE\ttitle_generate"), true);
  assert.equal(calls[0].body.options?.num_predict, 280);
});

test("runDesignerTextRewritePreview strips leaked node ids from JSON rewrite updates", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트 내용을 2026년 ai 기술 트렌드 게시물 제목으로 변경해줘",
      textNodes: [
        { id: "id26567:21", name: "title-1", characters: "Cell text" },
        { id: "id26567:22", name: "title-2", characters: "Cell text" }
      ]
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            response: JSON.stringify({
              reply: "제목 초안을 만들었습니다.",
              updates: [
                { id: "id26567:21", text: "id26567:21 2026년 AI 기술 트렌드 전망 3가지" },
                { id: "id26567:22", text: "id26567:22 주목해야 할 2026 AI 기술 트렌드" }
              ],
              safety: {
                canApply: false,
                reason: "Preview only until the user confirms the write."
              }
            })
          };
        }
      }),
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "gemma4:e4b"
      }
    }
  );

  assert.equal(ai.status, "completed");
  assert.deepEqual(ai.response.updates, [
    { id: "id26567:21", text: "2026년 AI 기술 트렌드 전망 3가지" },
    { id: "id26567:22", text: "주목해야 할 2026 AI 기술 트렌드" }
  ]);
});

test("runDesignerTextRewritePreview replaces bad local translation artifacts with deterministic UI translations", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트를 한글로 번역 적용해줘",
      textNodes: [
        { id: "1", name: "title-1", characters: "Create wireframe for Dashboard page" },
        { id: "2", name: "title-2", characters: "Create hi-fi design for messages page" },
        { id: "3", name: "title-3", characters: "Wireframing" }
      ]
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            response: "1\t/thinking\n2\tCreate hi-fi design for messages page\n3\t/think"
          };
        }
      }),
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3:8b"
      }
    }
  );

  assert.equal(ai.status, "completed");
  assert.deepEqual(ai.response.updates, [
    { id: "1", text: "대시보드 페이지 와이어프레임 생성" },
    { id: "2", text: "메시지 페이지 하이파이 디자인 생성" },
    { id: "3", text: "와이어프레임" }
  ]);
});

test("runDesignerTextRewritePreview falls back to deterministic translations when local translation times out", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트를 한글로 번역 적용해줘",
      textNodes: [
        { id: "1", name: "title-1", characters: "Create wireframe for Dashboard page" },
        { id: "2", name: "title-2", characters: "Wireframing" }
      ]
    },
    {
      fetchImpl: async () => {
        const error = new Error("fetch failed");
        error.name = "AbortError";
        throw error;
      },
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3.5:9b"
      }
    }
  );

  assert.equal(ai.status, "completed");
  assert.equal(ai.fallbackMode, "deterministic_translation_timeout");
  assert.deepEqual(ai.response.updates, [
    { id: "1", text: "대시보드 페이지 와이어프레임 생성" },
    { id: "2", text: "와이어프레임" }
  ]);
});

test("runDesignerTextRewritePreview treats numeric DOM timeout codes as abort-like failures", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트를 한글로 번역 적용해줘",
      textNodes: [
        { id: "1", name: "title-1", characters: "Create wireframe for Dashboard page" }
      ]
    },
    {
      fetchImpl: async () => {
        const error = new Error("The operation was aborted due to timeout");
        error.name = "TimeoutError";
        error.code = 23;
        throw error;
      },
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3.5:9b"
      }
    }
  );

  assert.equal(ai.status, "completed");
  assert.equal(ai.fallbackMode, "deterministic_translation_timeout");
  assert.deepEqual(ai.response.updates, [
    { id: "1", text: "대시보드 페이지 와이어프레임 생성" }
  ]);
});

test("runDesignerTextRewritePreview drops English-only local translation results and replaces common system phrases", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트를 한글로 번역 적용해줘",
      textNodes: [
        { id: "1", name: "body-1", characters: "I couldn't reach the server" },
        { id: "2", name: "body-2", characters: "In a few minutes, try again." },
        { id: "3", name: "body-3", characters: "Cell text" }
      ]
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            response: "1\tCould not reach the server\n2\tTry again in a few minutes.\n3\tCell text"
          };
        }
      }),
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3.5:9b"
      }
    }
  );

  assert.equal(ai.status, "completed");
  assert.deepEqual(ai.response.updates, [
    { id: "1", text: "서버에 연결할 수 없습니다" },
    { id: "2", text: "잠시 후 다시 시도해 주세요." },
    { id: "3", text: "셀 텍스트" }
  ]);
});

test("runDesignerTextRewritePreview recovers local translation lines without node ids by selection order", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트를 한글로 번역 적용해줘",
      textNodes: [
        { id: "1", name: "body-1", characters: "Dashboard" },
        { id: "2", name: "body-2", characters: "Messages" }
      ]
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            response: "<think>translate carefully</think>\n1. 대시보드\n2. 메시지"
          };
        }
      }),
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3.5:9b"
      }
    }
  );

  assert.equal(ai.status, "completed");
  assert.deepEqual(ai.response.updates, [
    { id: "1", text: "대시보드" },
    { id: "2", text: "메시지" }
  ]);
});

test("runDesignerTextRewritePreview recovers a single local translation line without node id", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트를 한글로 번역 적용해줘",
      textNodes: [
        { id: "1", name: "body-1", characters: "In progress" }
      ]
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            response: "<think>korean ui label</think>\n진행 중"
          };
        }
      }),
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3.5:9b"
      }
    }
  );

  assert.equal(ai.status, "completed");
  assert.deepEqual(ai.response.updates, [
    { id: "1", text: "진행 중" }
  ]);
});

test("runDesignerTextRewritePreview deterministic fallback translates direct UI labels", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트를 한글로 번역 적용해줘",
      textNodes: [
        { id: "1", name: "body-1", characters: "In progress" }
      ]
    },
    {
      fetchImpl: async () => {
        const error = new Error("fetch failed");
        error.name = "AbortError";
        throw error;
      },
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3.5:9b"
      }
    }
  );

  assert.equal(ai.status, "completed");
  assert.deepEqual(ai.response.updates, [
    { id: "1", text: "진행 중" }
  ]);
});

test("runDesignerTextRewritePreview fails when translation output stays as untranslated English prose", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트를 한글로 번역 적용해줘",
      textNodes: [
        { id: "1", name: "body-1", characters: "The request could not be completed because the server is unavailable." }
      ]
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            response:
              "1\tThe request could not be completed because the server is unavailable."
          };
        }
      }),
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3.5:9b"
      }
    }
  );

  assert.equal(ai.status, "failed");
  assert.equal(ai.failureCode, "invalid_model_output");
  assert.equal(ai.outputValidation.valid, false);
  assert.equal(ai.response.updates.length, 0);
});

test("runDesignerTextRewritePreview fails when title generation returns unchanged source text", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트 내용을 ai 기술 트렌드 분석 관련 게시물 제목으로 변경해줘",
      textNodes: [
        { id: "1", name: "title-1", characters: "AI 기술 트렌드 분석" },
        { id: "2", name: "title-2", characters: "AI 기술 트렌드 분석" }
      ]
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            response: "1\tAI 기술 트렌드 분석\n2\tAI 기술 트렌드 분석"
          };
        }
      }),
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3.5:9b"
      }
    }
  );

  assert.equal(ai.status, "failed");
  assert.equal(ai.failureCode, "invalid_model_output");
  assert.equal(ai.outputValidation.valid, false);
  assert.equal(ai.outputValidation.invalidReasons.includes("unchanged_rewrite"), true);
  assert.equal(ai.response.updates.length, 0);
});

test("runDesignerTextRewritePreview strips leaked node ids from local title-generation output", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트 내용을 ai 기술 트렌드 관련 게시물 제목으로 변경해줘",
      textNodes: [
        { id: "id26539:74", name: "title-1", characters: "Cell text" },
        { id: "id26539:77", name: "title-2", characters: "Cell text" }
      ]
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            response: "id26539:74 AI 기술 트렌드 최신 동향\nid26539:77 주목해야 할 AI 기술 트렌드"
          };
        }
      }),
      config: {
        provider: "ollama",
        configured: true,
        valid: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3.5:9b"
      }
    }
  );

  assert.equal(ai.status, "completed");
  assert.deepEqual(ai.response.updates, [
    { id: "id26539:74", text: "AI 기술 트렌드 최신 동향" },
    { id: "id26539:77", text: "주목해야 할 AI 기술 트렌드" }
  ]);
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

test("runDesignerTextRewritePreview normalizes common design terms in Korean output", async () => {
  const ai = await runDesignerTextRewritePreview(
    {
      message: "선택한 텍스트를 한글로 번역 적용해줘",
      textNodes: [
        { id: "20:1", name: "title-1", characters: "Create wireframe for Dashboard page" },
        { id: "20:2", name: "title-2", characters: "Create hi-fi design for messages page" }
      ]
    },
    {
      config: {
        provider: "custom",
        configured: true,
        valid: true,
        apiKey: "",
        baseUrl: "http://127.0.0.1:9999/v1",
        model: "local-test-model"
      },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    reply: "선택한 텍스트를 hi-fi 중심으로 번역했어요.",
                    updates: [
                      { id: "20:1", text: "Dashboard 와이어 프레임 만들기" },
                      { id: "20:2", text: "Messages 히피 디자인 만들기" }
                    ],
                    safety: {
                      canApply: false,
                      reason: "Preview before confirm"
                    }
                  })
                }
              }
            ]
          };
        }
      })
    }
  );

  assert.equal(ai.status, "completed");
  assert.equal(ai.response.reply.includes("하이파이"), true);
  assert.equal(ai.response.updates[0].text, "대시보드 와이어프레임 만들기");
  assert.equal(ai.response.updates[1].text, "Messages 하이파이 디자인 만들기");
});

test("runDesignerAiChat calls Ollama via OpenAI-compatible chat completions without requiring a paid API key", async () => {
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
          id: "resp_ollama_test",
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({
                  reply: "로컬 모델이 현재 선택 구조를 읽고 다음 단계를 준비했어요.",
                  intent: {
                    kind: "inspect_selection",
                    confidence: "medium",
                    targetSummary: "선택 프레임"
                  },
                  readRequests: [],
                  actionPlan: [],
                  safety: {
                    canApply: false,
                    reason: "읽기 결과를 먼저 확인해야 합니다."
                  }
                })
              }
            }
          ]
        };
      }
    };
  };

  const ai = await runDesignerAiChat(
    {
      message: "선택한 프레임 구조를 알려줘"
    },
    {
      fetchImpl,
      config: {
        provider: "ollama",
        configured: true,
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "llama3.2:3b"
      }
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:11434/v1/chat/completions");
  assert.equal(calls[0].body.model, "llama3.2:3b");
  assert.equal(ai.provider, "ollama");
  assert.equal(ai.status, "completed");
  assert.equal(ai.response.reply.includes("로컬 모델"), true);
});

test("discoverLocalDesignerProviders reports available Ollama and LM Studio endpoints", async () => {
  const fetchImpl = async (url) => {
    if (String(url) === "http://127.0.0.1:11434/api/tags") {
      return {
        ok: true,
        async json() {
          return {
            models: [{ name: "llama3.2:3b" }, { name: "gpt-oss:20b" }]
          };
        }
      };
    }
    if (String(url) === "http://127.0.0.1:1234/v1/models") {
      return {
        ok: true,
        async json() {
          return {
            data: [{ id: "qwen-local" }]
          };
        }
      };
    }
    throw new Error(`unexpected url ${String(url)}`);
  };

  const discovery = await discoverLocalDesignerProviders({ fetchImpl });
  assert.equal(discovery.providers.length, 2);
  assert.equal(discovery.providers[0].provider, "ollama");
  assert.equal(discovery.providers[0].available, true);
  assert.deepEqual(discovery.providers[0].models, ["llama3.2:3b", "gpt-oss:20b"]);
  assert.equal(discovery.providers[1].provider, "lmstudio");
  assert.equal(discovery.providers[1].available, true);
  assert.deepEqual(discovery.providers[1].models, ["qwen-local"]);
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

test("runDesignerAiChat sanitizes Hanja from user-facing Korean reply text", async () => {
  const ai = await runDesignerAiChat(
    {
      message: "선택한 프레임에 대한 정보를 알려줘"
    },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            id: "resp_hanja",
            choices: [
              {
                message: {
                  role: "assistant",
                  content: JSON.stringify({
                    reply: "일반 게시물 제목 내용이 어느 텍스트에서 來由한지 확인해 주세요.",
                    intent: {
                      kind: "inspect_selection",
                      confidence: "medium",
                      targetSummary: "선택 프레임"
                    },
                    readRequests: [],
                    actionPlan: [],
                    safety: {
                      canApply: false,
                      reason: "read only"
                    }
                  })
                }
              }
            ]
          };
        }
      }),
      config: {
        provider: "nvidia",
        configured: true,
        apiKey: "nvapi-test",
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: "nvidia/nemotron-3-nano-30b-a3b"
      }
    }
  );

  assert.equal(ai.response.reply.includes("來由"), false);
  assert.equal(ai.response.reply, "일반 게시물 제목 내용이 어느 텍스트에서 왔는지 확인해 주세요.");
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
