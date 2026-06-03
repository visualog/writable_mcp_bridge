import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

import {
  buildDesignerWorkflowReleaseAudit,
  buildDesignerWorkflowReleaseAuditMarkdown,
  buildReleaseRequiredCaseIds
} from "../src/designer-workflow-release-audit.js";

function makeEvidenceCases() {
  return buildReleaseRequiredCaseIds().map((id) => ({
    id,
    status: "pass",
    area: id === "DS01" ? "Design System Component Evidence" : "Designer Workflow",
    readbackEvidence: {
      nodeId: `${id}:node`,
      checked: true
    }
  }));
}

function makeRagEvidence() {
  return {
    ok: true,
    status: 200,
    intentKind: "restructure_layout",
    aiBackend: "codex_cli",
    codexStatus: "completed",
    fallbackUsed: false,
    knowledgeReferenceCount: 2,
    knowledgeReferences: [
      {
        id: "buddy-operational-contract#2-read-strategy-contract-3",
        title: "Buddy-style evidence-first response contract",
        sourcePath: "docs/buddy/06-operational-contract.md",
        sourceKind: "document_chunk"
      },
      {
        id: "designer-workflow-qa#l-designer-workflow-editing-6",
        title: "Designer workflow editing QA matrix",
        sourcePath: "docs/qa/figma-designer-workflow-test-plan-20260601.ko.md",
        sourceKind: "document_chunk"
      }
    ]
  };
}

function makeReleaseEvidenceCases() {
  return makeEvidenceCases().map((entry) =>
    entry.id === "RAG01"
      ? {
          ...entry,
          readbackEvidence: makeRagEvidence()
        }
      : entry
  );
}

function makeReadyHealth() {
  return {
    ok: true,
    serverVersion: "0.5.65",
    transportHealth: { grade: "healthy" },
    commandReadiness: { status: "ready" },
    writeReadiness: { status: "ready" },
    activeSessionResolution: {
      status: "single",
      reason: "single_live_session",
      livePluginIds: ["page:test-live"],
      primaryPluginId: "page:test-live"
    }
  };
}

function makeAssistantUiSnapshot() {
  return {
    generatedAt: "2026-06-02T00:00:00.000Z",
    checks: {
      requiredSectionsPresent: true,
      knowledgeCardRendered: true,
      issueCardRendered: true,
      actionCardRendered: true,
      knowledgeFilterRendered: true,
      referenceTextNotSplitIntoFakeSections: true
    }
  };
}

test("release audit is blocked when no live Figma plugin session exists", () => {
  const audit = buildDesignerWorkflowReleaseAudit({
    health: {
      ok: true,
      serverVersion: "0.5.65",
      transportHealth: { grade: "standby" },
      commandReadiness: { status: "unavailable" },
      writeReadiness: { status: "unavailable" },
      activeSessionResolution: {
        status: "unavailable",
        reason: "no_live_session",
        livePluginIds: []
      }
    },
    sessions: { sessions: [] },
    readiness: { reason: "no_live_session" },
    results: null,
    verification: {
      npmTest: { status: "pass", detail: "574 tests, 562 pass, 12 skipped" }
    }
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.status, "blocked");
  assert.equal(audit.reason, "no_live_session");
  assert.equal(audit.gates.liveFigmaSession.status, "blocked");
  assert.match(audit.summary, /활성 Figma plugin session/u);
});

test("release audit ignores older no-live readiness when current health has a live session", () => {
  const audit = buildDesignerWorkflowReleaseAudit({
    health: makeReadyHealth(),
    sessions: { sessions: [{ pluginId: "page:test-live", state: "live" }] },
    readiness: {
      reason: "no_live_session",
      activeSessionResolution: {
        reason: "no_live_session",
        livePluginIds: []
      }
    },
    results: {
      summary: { pluginId: "page:test-live" },
      cases: makeReleaseEvidenceCases()
    },
    verification: {
      npmTest: { status: "pass", detail: "574 tests, 562 pass, 12 skipped" },
      assistantUi: { status: "pass", detail: "renderer snapshot pass" },
      ragEvidence: { status: "pass", detail: "knowledgeReferences present" }
    },
    assistantUiSnapshot: makeAssistantUiSnapshot(),
    artifactSources: {
      resultsMtimeMs: Date.parse("2026-06-02T12:45:58.000Z"),
      readinessMtimeMs: Date.parse("2026-06-02T12:21:55.000Z")
    }
  });

  assert.equal(audit.gates.liveFigmaSession.status, "pass");
  assert.equal(audit.status, "pass");
});

test("release audit fails when required Designer Workflow evidence is missing", () => {
  const cases = makeEvidenceCases().filter((entry) => entry.id !== "DS01" && entry.id !== "L31");
  const audit = buildDesignerWorkflowReleaseAudit({
    health: makeReadyHealth(),
    sessions: { sessions: [{ pluginId: "page:test-live", state: "live" }] },
    results: { summary: { pluginId: "page:test-live" }, cases },
    verification: {
      npmTest: { status: "pass", detail: "574 tests, 562 pass, 12 skipped" },
      assistantUi: { status: "pass", detail: "renderer snapshot pass" },
      ragEvidence: { status: "pass", detail: "knowledgeReferences present" }
    }
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.status, "fail");
  assert.equal(audit.gates.designerWorkflowRelease.status, "fail");
  assert.deepEqual(
    audit.gates.designerWorkflowRelease.missingRequiredCases,
    ["DS01", "L31"]
  );
});

test("release audit blocks stale run results when a newer readiness artifact says no live session", () => {
  const audit = buildDesignerWorkflowReleaseAudit({
    health: makeReadyHealth(),
    sessions: { sessions: [{ pluginId: "page:test-live", state: "live" }] },
    results: {
      summary: {
        pluginId: "page:test-live",
        runStamp: "2026-06-02T00:00:00.000Z"
      },
      cases: makeEvidenceCases()
    },
    readiness: {
      reason: "no_live_session",
      runStamp: "2026-06-02T00:05:00.000Z"
    },
    artifactSources: {
      resultsPath: "docs/qa/runs/designer-workflow-old/results.json",
      resultsMtimeMs: Date.parse("2026-06-02T00:00:00.000Z"),
      readinessPath: "docs/qa/runs/designer-workflow-new/live-readiness.json",
      readinessMtimeMs: Date.parse("2026-06-02T00:05:00.000Z")
    },
    verification: {
      npmTest: { status: "pass", detail: "574 tests, 562 pass, 12 skipped" },
      assistantUi: { status: "pass", detail: "assistant UI snapshot pass" },
      ragEvidence: { status: "pass", detail: "RAG01 document_chunk references pass" }
    }
  });
  audit.sources = {
    resultsPath: "docs/qa/runs/designer-workflow-old/results.json",
    readinessPath: "docs/qa/runs/designer-workflow-new/live-readiness.json",
    assistantUiSnapshotPath: "docs/qa/runs/assistant-response-ui-new/snapshot.json",
    resultsMtimeMs: Date.parse("2026-06-02T00:00:00.000Z"),
    readinessMtimeMs: Date.parse("2026-06-02T00:05:00.000Z"),
    assistantUiSnapshotMtimeMs: Date.parse("2026-06-02T00:06:00.000Z")
  };
  const markdown = buildDesignerWorkflowReleaseAuditMarkdown(audit);

  assert.equal(audit.ok, false);
  assert.equal(audit.status, "blocked");
  assert.equal(audit.reason, "newer_readiness_blocks_results");
  assert.equal(audit.gates.artifactFreshness.status, "blocked");
  assert.match(audit.gates.artifactFreshness.detail, /newer live-readiness/u);
  assert.match(markdown, /artifactFreshness/u);
  assert.match(markdown, /designer-workflow-old\/results\.json/u);
  assert.match(markdown, /Next Live Validation Steps/u);
  assert.match(markdown, /curl -s http:\/\/127\.0\.0\.1:3846\/health/u);
  assert.match(markdown, /XBRIDGE_QA_PLUGIN_ID=<pluginId>/u);
  assert.match(markdown, /run-figma-designer-workflow-live-qa\.mjs/u);
  assert.match(markdown, /Already Proven/u);
  assert.match(markdown, /Evidence Sources/u);
  assert.match(markdown, /designerWorkflowResults/u);
  assert.match(markdown, /liveReadiness/u);
  assert.match(markdown, /assistantUiSnapshot/u);
  assert.match(markdown, /2026-06-02T00:05:00.000Z/u);
});

test("release audit does not present stale incomplete results as current Designer Workflow failure", () => {
  const staleIncompleteCases = makeEvidenceCases().filter(
    (entry) => entry.id !== "DS01" && entry.id !== "L31"
  );
  const audit = buildDesignerWorkflowReleaseAudit({
    health: makeReadyHealth(),
    sessions: { sessions: [{ pluginId: "page:test-live", state: "live" }] },
    results: {
      summary: {
        pluginId: "page:test-live",
        runStamp: "2026-06-02T00:00:00.000Z"
      },
      cases: staleIncompleteCases
    },
    readiness: {
      reason: "no_live_session",
      runStamp: "2026-06-02T00:05:00.000Z"
    },
    artifactSources: {
      resultsPath: "docs/qa/runs/designer-workflow-old/results.json",
      resultsMtimeMs: Date.parse("2026-06-02T00:00:00.000Z"),
      readinessPath: "docs/qa/runs/designer-workflow-new/live-readiness.json",
      readinessMtimeMs: Date.parse("2026-06-02T00:05:00.000Z")
    },
    assistantUiSnapshot: makeAssistantUiSnapshot(),
    verification: {
      npmTest: { status: "pass", detail: "574 tests, 562 pass, 12 skipped" },
      assistantUi: { status: "pass", detail: "assistant UI snapshot pass" },
      ragEvidence: { status: "pass", detail: "RAG01 document_chunk references pass" }
    }
  });
  const markdown = buildDesignerWorkflowReleaseAuditMarkdown(audit);

  assert.equal(audit.status, "blocked");
  assert.equal(audit.gates.artifactFreshness.status, "blocked");
  assert.equal(audit.gates.designerWorkflowRelease.status, "blocked");
  assert.match(audit.gates.designerWorkflowRelease.detail, /not current release evidence/u);
  assert.doesNotMatch(markdown, /missingRequiredCases: DS01, L31/u);
  assert.match(markdown, /Required Case Findings are unavailable because Designer Workflow evidence is not current/u);
});

test("release audit blocks results captured from a plugin id that is not currently live", () => {
  const audit = buildDesignerWorkflowReleaseAudit({
    health: makeReadyHealth(),
    sessions: { sessions: [{ pluginId: "page:test-live", state: "live" }] },
    results: {
      summary: {
        pluginId: "page:stale-file",
        runStamp: "2026-06-02T00:00:00.000Z"
      },
      cases: makeReleaseEvidenceCases()
    },
    artifactSources: {
      resultsPath: "docs/qa/runs/designer-workflow-stale-file/results.json",
      resultsMtimeMs: Date.parse("2026-06-02T00:00:00.000Z")
    },
    verification: {
      npmTest: { status: "pass", detail: "574 tests, 562 pass, 12 skipped" },
      assistantUi: { status: "pass", detail: "assistant UI snapshot pass" },
      ragEvidence: { status: "pass", detail: "RAG01 document_chunk references pass" }
    }
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.status, "blocked");
  assert.equal(audit.reason, "results_plugin_not_live");
  assert.equal(audit.gates.artifactFreshness.status, "blocked");
  assert.match(audit.gates.artifactFreshness.detail, /page:stale-file/u);
  assert.match(audit.gates.artifactFreshness.detail, /page:test-live/u);
});

test("release audit requires concrete assistant UI snapshot evidence", () => {
  const audit = buildDesignerWorkflowReleaseAudit({
    health: makeReadyHealth(),
    sessions: { sessions: [{ pluginId: "page:test-live", state: "live" }] },
    results: {
      summary: {
        pluginId: "page:test-live",
        runStamp: "2026-06-02T00:00:00.000Z"
      },
      cases: makeReleaseEvidenceCases()
    },
    verification: {
      npmTest: { status: "pass", detail: "574 tests, 562 pass, 12 skipped" },
      assistantUi: { status: "pass", detail: "manual note only" },
      ragEvidence: { status: "pass", detail: "RAG01 document_chunk references pass" }
    }
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.status, "fail");
  assert.equal(audit.gates.assistantResponseUx.status, "missing");
  assert.match(audit.gates.assistantResponseUx.detail, /qa:assistant-ui-snapshot/u);
});

test("release audit requires concrete RAG01 document chunk references", () => {
  const audit = buildDesignerWorkflowReleaseAudit({
    health: makeReadyHealth(),
    sessions: { sessions: [{ pluginId: "page:test-live", state: "live" }] },
    results: {
      summary: {
        pluginId: "page:test-live",
        runStamp: "2026-06-02T00:00:00.000Z"
      },
      cases: makeEvidenceCases()
    },
    assistantUiSnapshot: makeAssistantUiSnapshot(),
    verification: {
      npmTest: { status: "pass", detail: "574 tests, 562 pass, 12 skipped" },
      assistantUi: { status: "pass", detail: "assistant UI snapshot pass" },
      ragEvidence: { status: "pass", detail: "manual note only" }
    }
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.status, "fail");
  assert.equal(audit.gates.ragEvidence.status, "missing");
  assert.match(audit.gates.ragEvidence.detail, /RAG01/u);
  assert.match(audit.gates.ragEvidence.detail, /knowledgeReferences/u);
});

test("release audit ignores stale manual RAG verification text when RAG01 evidence is concrete", () => {
  const audit = buildDesignerWorkflowReleaseAudit({
    health: makeReadyHealth(),
    sessions: { sessions: [{ pluginId: "page:test-live", state: "live" }] },
    results: {
      summary: {
        pluginId: "page:test-live",
        runStamp: "2026-06-02T00:00:00.000Z"
      },
      cases: makeReleaseEvidenceCases()
    },
    assistantUiSnapshot: makeAssistantUiSnapshot(),
    verification: {
      npmTest: { status: "pass", detail: "574 tests, 562 pass, 12 skipped" },
      assistantUi: { status: "pass", detail: "assistant UI snapshot pass" },
      ragEvidence: {
        status: "missing",
        detail: "Current live RAG01 evidence requires an active Figma plugin session"
      }
    }
  });

  assert.equal(audit.gates.ragEvidence.status, "pass");
  assert.match(audit.gates.ragEvidence.detail, /RAG01 document_chunk references=2/u);
  assert.doesNotMatch(audit.gates.ragEvidence.detail, /requires an active Figma plugin session/u);
});

test("release audit passes only when live session, UX/RAG checks, and all evidence gates pass", () => {
  const audit = buildDesignerWorkflowReleaseAudit({
    health: makeReadyHealth(),
    sessions: { sessions: [{ pluginId: "page:test-live", state: "live" }] },
    results: {
      summary: {
        pluginId: "page:test-live",
        healthAfter: { transport: "healthy", commandReadiness: "ready", writeReadiness: "ready" },
        runtimeAfter: { pendingTotal: 0, pendingResultsTotal: 0, recentFailedTotal: 0 }
      },
      cases: makeReleaseEvidenceCases()
    },
    verification: {
      npmTest: { status: "pass", detail: "574 tests, 562 pass, 12 skipped" },
      assistantUi: { status: "pass", detail: "assistant response UI snapshot pass" },
      ragEvidence: { status: "pass", detail: "RAG01 document_chunk references pass" }
    },
    assistantUiSnapshot: makeAssistantUiSnapshot()
  });
  const markdown = buildDesignerWorkflowReleaseAuditMarkdown(audit);

  assert.equal(audit.ok, true);
  assert.equal(audit.status, "pass");
  assert.equal(audit.gates.assistantResponseUx.status, "pass");
  assert.equal(audit.gates.ragEvidence.status, "pass");
  assert.match(markdown, /Release readiness: PASS/u);
  assert.match(markdown, /DS01/u);
  assert.match(markdown, /L31/u);
});

test("release audit CLI writes JSON and Markdown readiness artifacts", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "xbridge-release-audit-"));
  try {
    const healthPath = path.join(tmpDir, "health.json");
    const sessionsPath = path.join(tmpDir, "sessions.json");
    const resultsPath = path.join(tmpDir, "results.json");
    const assistantUiSnapshotPath = path.join(tmpDir, "assistant-ui-snapshot.json");
    const verificationPath = path.join(tmpDir, "verification.json");
    const outputJsonPath = path.join(tmpDir, "release-readiness.json");
    const outputMarkdownPath = path.join(tmpDir, "release-readiness.md");

    await writeFile(healthPath, JSON.stringify(makeReadyHealth()), "utf8");
    await writeFile(
      sessionsPath,
      JSON.stringify({ sessions: [{ pluginId: "page:test-live", state: "live" }] }),
      "utf8"
    );
    await writeFile(
      resultsPath,
      JSON.stringify({ summary: { pluginId: "page:test-live" }, cases: makeReleaseEvidenceCases() }),
      "utf8"
    );
    await writeFile(
      assistantUiSnapshotPath,
      JSON.stringify(makeAssistantUiSnapshot()),
      "utf8"
    );
    await writeFile(
      verificationPath,
      JSON.stringify({
        npmTest: { status: "pass", detail: "574 tests, 562 pass, 12 skipped" },
        assistantUi: { status: "pass", detail: "assistant UI snapshot pass" },
        ragEvidence: { status: "pass", detail: "RAG01 document_chunk references pass" }
      }),
      "utf8"
    );

    const result = spawnSync(
      process.execPath,
      [
        "scripts/audit-designer-workflow-release-readiness.mjs",
        "--health-json",
        healthPath,
        "--sessions-json",
        sessionsPath,
        "--results",
        resultsPath,
        "--assistant-ui-snapshot",
        assistantUiSnapshotPath,
        "--verification-json",
        verificationPath,
        "--output-json",
        outputJsonPath,
        "--output-md",
        outputMarkdownPath
      ],
      {
        cwd: path.join(import.meta.dirname, ".."),
        encoding: "utf8"
      }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const audit = JSON.parse(await readFile(outputJsonPath, "utf8"));
    const markdown = await readFile(outputMarkdownPath, "utf8");
    assert.equal(audit.status, "pass");
    assert.match(markdown, /Release readiness: PASS/u);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
