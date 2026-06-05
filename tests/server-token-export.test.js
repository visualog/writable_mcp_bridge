import test from "node:test";
import assert from "node:assert/strict";

import { createTokenExportArtifactName } from "../src/server-token-export.js";

test("createTokenExportArtifactName creates stable json artifact names", () => {
  const name = createTokenExportArtifactName({
    pluginId: "page:2631:43",
    startedAt: Date.parse("2026-05-27T00:00:00.000Z")
  });

  assert.match(name, /^xbridge-design-tokens-page-2631-43-2026-05-27T00-00-00-000Z\.json$/);
});
