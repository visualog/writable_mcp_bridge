import { buildComposeToolDefinitions } from "./constants/server-tool-definitions-compose.js";
import { buildCoreToolDefinitions } from "./constants/server-tool-definitions-core.js";
import { buildDiscoveryToolDefinitions } from "./constants/server-tool-definitions-discovery.js";
import { buildMutationToolDefinitions } from "./constants/server-tool-definitions-mutation.js";
import { buildNodeToolDefinitions } from "./constants/server-tool-definitions-node.js";
import { buildOperationToolDefinitions } from "./constants/server-tool-definitions-operations.js";
import { buildReadToolDefinitions } from "./constants/server-tool-definitions-read.js";

export function buildToolDefinitions() {
  return [
  ...buildCoreToolDefinitions(),
  ...buildReadToolDefinitions(),
  ...buildDiscoveryToolDefinitions(),
  ...buildMutationToolDefinitions(),
  ...buildNodeToolDefinitions(),
  ...buildComposeToolDefinitions(),
  ...buildOperationToolDefinitions()
];
}
