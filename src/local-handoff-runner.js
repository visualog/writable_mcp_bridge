function normalizeString(value) {
  return String(value || "").trim();
}

function toEnvKeySegment(value) {
  return normalizeString(value)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export function inferLocalExecutionPlan(handoff = {}, options = {}) {
  const mode = normalizeString(handoff?.intent?.mode) || "unknown";
  const manualCommand = normalizeString(options.execCommand);
  const auto = options.auto === true;
  const env = options.env && typeof options.env === "object" ? options.env : process.env;

  if (manualCommand) {
    return {
      mode,
      command: manualCommand,
      source: "manual",
      executable: true,
      reason: "manual_command_provided"
    };
  }

  if (!auto) {
    return {
      mode,
      command: "",
      source: "none",
      executable: false,
      reason: "auto_disabled"
    };
  }

  const modeKey = `XBRIDGE_HANDOFF_CMD_${toEnvKeySegment(mode)}`;
  const modeCommand = normalizeString(env[modeKey]);
  if (modeCommand) {
    return {
      mode,
      command: modeCommand,
      source: `env:${modeKey}`,
      executable: true,
      reason: "mode_specific_command"
    };
  }

  const defaultCommand = normalizeString(env.XBRIDGE_HANDOFF_CMD_DEFAULT);
  if (defaultCommand) {
    return {
      mode,
      command: defaultCommand,
      source: "env:XBRIDGE_HANDOFF_CMD_DEFAULT",
      executable: true,
      reason: "default_command"
    };
  }

  return {
    mode,
    command: "",
    source: "unconfigured",
    executable: false,
    reason: "no_auto_command_configured"
  };
}
