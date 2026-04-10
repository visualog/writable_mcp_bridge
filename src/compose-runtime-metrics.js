function createInitialState() {
  return {
    startedAt: new Date().toISOString(),
    validation: {
      total: 0,
      pass: 0,
      warn: 0,
      fail: 0,
      strictBlocks: 0
    },
    compose: {
      total: 0,
      success: 0,
      failed: 0,
      blockedSectionsTotal: 0,
      fallbackSectionsTotal: 0,
      strictModeTotal: 0,
      strictModeFailures: 0
    },
    last: {
      validationReport: null,
      composeReport: null
    }
  };
}

function normalizeStatus(report = {}) {
  const status = String(report?.status || "").trim().toLowerCase();
  if (status === "pass" || status === "warn" || status === "fail") {
    return status;
  }
  if (report?.canCompose === false) {
    return "fail";
  }
  return "pass";
}

function countByStatus(composition = [], status) {
  if (!Array.isArray(composition)) {
    return 0;
  }
  return composition.filter((entry) => entry?.status === status).length;
}

function buildRatios(state) {
  const strictModeFailureRatio =
    state.compose.strictModeTotal > 0
      ? state.compose.strictModeFailures / state.compose.strictModeTotal
      : 0;
  return {
    strictModeFailureRatio: Number(strictModeFailureRatio.toFixed(4))
  };
}

export function createComposeRuntimeMetricsStore() {
  const state = createInitialState();

  return {
    recordValidation({
      report = {},
      validationMode = "lenient",
      blockedByStrict = false
    } = {}) {
      const status = normalizeStatus(report);
      state.validation.total += 1;
      state.validation[status] += 1;
      if (blockedByStrict && String(validationMode || "").trim().toLowerCase() === "strict") {
        state.validation.strictBlocks += 1;
      }
      state.last.validationReport = {
        ...report,
        status,
        validationMode,
        blockedByStrict,
        at: new Date().toISOString()
      };
    },

    recordCompose({
      validationMode = "lenient",
      validationReport = null,
      composition = [],
      ok = true,
      errorMessage = null
    } = {}) {
      const normalizedMode = String(validationMode || "").trim().toLowerCase() === "strict"
        ? "strict"
        : "lenient";

      state.compose.total += 1;
      if (normalizedMode === "strict") {
        state.compose.strictModeTotal += 1;
      }

      if (ok) {
        state.compose.success += 1;
      } else {
        state.compose.failed += 1;
        if (normalizedMode === "strict") {
          state.compose.strictModeFailures += 1;
        }
      }

      state.compose.blockedSectionsTotal += countByStatus(composition, "blocked");
      state.compose.fallbackSectionsTotal += countByStatus(composition, "fallback-helper");

      state.last.composeReport = {
        ok,
        validationMode: normalizedMode,
        errorMessage: errorMessage || undefined,
        blockedSections: countByStatus(composition, "blocked"),
        fallbackSections: countByStatus(composition, "fallback-helper"),
        compositionCount: Array.isArray(composition) ? composition.length : 0,
        validationReport: validationReport || undefined,
        at: new Date().toISOString()
      };
    },

    getReport() {
      return {
        ...state,
        ratios: buildRatios(state)
      };
    }
  };
}
