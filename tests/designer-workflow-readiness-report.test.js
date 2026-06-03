import test from "node:test";
import assert from "node:assert/strict";

import { buildDesignerWorkflowReadinessReport } from "../src/designer-workflow-readiness-report.js";

test("designer workflow readiness report explains no live Figma session", () => {
  const report = buildDesignerWorkflowReadinessReport({
    health: {
      status: 200,
      durationMs: 12,
      body: {
        ok: true,
        serverVersion: "0.5.65",
        transportHealth: { grade: "standby" },
        commandReadiness: { status: "unavailable", reason: "no_active_plugin" },
        writeReadiness: { status: "unavailable", reason: "no_active_plugin" },
        activeSessionResolution: {
          status: "unavailable",
          reason: "no_live_session",
          livePluginIds: [],
          requiresExplicitPluginId: false
        }
      }
    },
    explicitPluginId: ""
  });

  assert.equal(report.ok, false);
  assert.equal(report.reason, "no_live_session");
  assert.equal(report.serverVersion, "0.5.65");
  assert.equal(report.transport, "standby");
  assert.equal(report.commandReadiness, "unavailable");
  assert.equal(report.writeReadiness, "unavailable");
  assert.deepEqual(report.livePluginIds, []);
  assert.match(report.summary, /활성 Figma plugin session이 없어 live workflow runner를 실행할 수 없습니다/);
  assert.ok(report.nextActions.some((item) => item.includes("Figma에서 Xbridge")));
  assert.ok(report.nextActions.some((item) => item.includes("/health")));
});

test("designer workflow readiness report explains ambiguous sessions require plugin id", () => {
  const report = buildDesignerWorkflowReadinessReport({
    health: {
      status: 200,
      durationMs: 8,
      body: {
        ok: true,
        activeSessionResolution: {
          status: "ambiguous",
          reason: "multiple_live_sessions",
          livePluginIds: ["page:1", "page:2"],
          requiresExplicitPluginId: true
        },
        commandReadiness: { status: "ready" },
        writeReadiness: { status: "ready" },
        transportHealth: { grade: "healthy" }
      }
    },
    explicitPluginId: ""
  });

  assert.equal(report.ok, false);
  assert.equal(report.reason, "multiple_live_sessions");
  assert.deepEqual(report.livePluginIds, ["page:1", "page:2"]);
  assert.ok(report.nextActions.some((item) => item.includes("XBRIDGE_QA_PLUGIN_ID")));
});
