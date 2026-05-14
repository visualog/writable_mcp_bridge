import { register } from "node:module";

const target = new URL("./ai-designer-suggestions-v2.js", import.meta.url).href;

const source = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "./ai-designer-suggestions.js" || specifier.endsWith("/ai-designer-suggestions.js")) {
    return { url: ${JSON.stringify(target)}, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(source)}`, import.meta.url);
