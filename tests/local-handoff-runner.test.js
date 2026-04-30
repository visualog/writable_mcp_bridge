import test from "node:test";
import assert from "node:assert/strict";
import { inferLocalExecutionPlan } from "../src/local-handoff-runner.js";

test("inferLocalExecutionPlan prefers a manual exec command", () => {
  const plan = inferLocalExecutionPlan(
    {
      intent: {
        mode: "implement_selection"
      }
    },
    {
      execCommand: "npm test -- Hero"
    }
  );

  assert.equal(plan.executable, true);
  assert.equal(plan.command, "npm test -- Hero");
  assert.equal(plan.source, "manual");
});

test("inferLocalExecutionPlan resolves a mode-specific auto command from env", () => {
  const plan = inferLocalExecutionPlan(
    {
      intent: {
        mode: "implement_selection"
      }
    },
    {
      auto: true,
      env: {
        XBRIDGE_HANDOFF_CMD_IMPLEMENT_SELECTION: "npm run build:hero"
      }
    }
  );

  assert.equal(plan.executable, true);
  assert.equal(plan.command, "npm run build:hero");
  assert.equal(plan.source, "env:XBRIDGE_HANDOFF_CMD_IMPLEMENT_SELECTION");
});

test("inferLocalExecutionPlan falls back to default auto command", () => {
  const plan = inferLocalExecutionPlan(
    {
      intent: {
        mode: "update_existing_code"
      }
    },
    {
      auto: true,
      env: {
        XBRIDGE_HANDOFF_CMD_DEFAULT: "npm test"
      }
    }
  );

  assert.equal(plan.executable, true);
  assert.equal(plan.command, "npm test");
  assert.equal(plan.source, "env:XBRIDGE_HANDOFF_CMD_DEFAULT");
});

test("inferLocalExecutionPlan reports unconfigured auto mode when no command exists", () => {
  const plan = inferLocalExecutionPlan(
    {
      intent: {
        mode: "generate_component"
      }
    },
    {
      auto: true,
      env: {}
    }
  );

  assert.equal(plan.executable, false);
  assert.equal(plan.reason, "no_auto_command_configured");
  assert.equal(plan.source, "unconfigured");
});
