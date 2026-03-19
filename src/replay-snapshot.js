const TARGET_TYPE_MAP = {
  FRAME: "FRAME",
  GROUP: "FRAME",
  RECTANGLE: "RECTANGLE",
  TEXT: "TEXT",
  INSTANCE: "FRAME",
  COMPONENT: "FRAME",
  COMPONENT_SET: "FRAME"
};

function buildReplayNode(snapshot, parentRef, refPrefix, index = 0) {
  const ref = `${refPrefix}.${index}`;
  const targetNodeType = TARGET_TYPE_MAP[snapshot.type];
  const node = {
    ref,
    parentRef,
    name: snapshot.name,
    sourceType: snapshot.type,
    targetNodeType,
    x: snapshot.x || 0,
    y: snapshot.y || 0,
    width: snapshot.width,
    height: snapshot.height,
    visible: snapshot.visible,
    opacity: snapshot.opacity,
    cornerRadius: snapshot.cornerRadius,
    fillColor: snapshot.fillColor,
    characters: snapshot.characters,
    placeholderFor:
      snapshot.type === "INSTANCE" ||
      snapshot.type === "COMPONENT" ||
      snapshot.type === "COMPONENT_SET"
        ? snapshot.type
        : undefined,
    children: []
  };

  for (let childIndex = 0; childIndex < (snapshot.children || []).length; childIndex += 1) {
    node.children.push(
      buildReplayNode(snapshot.children[childIndex], ref, ref, childIndex)
    );
  }

  return node;
}

export function buildReplayPlan(snapshot, input = {}) {
  const targetParentId = String(input.targetParentId || "").trim();
  if (!targetParentId) {
    throw new Error("targetParentId is required");
  }

  return {
    targetParentId,
    root: buildReplayNode(snapshot, targetParentId, "root", 0)
  };
}

export function flattenReplayOperations(plan) {
  const operations = [];

  function visit(node) {
    operations.push({
      ref: node.ref,
      parentRef: node.parentRef,
      name: node.name,
      targetNodeType: node.targetNodeType,
      sourceType: node.sourceType,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      visible: node.visible,
      opacity: node.opacity,
      cornerRadius: node.cornerRadius,
      fillColor: node.fillColor,
      characters: node.characters,
      placeholderFor: node.placeholderFor
    });

    for (const child of node.children || []) {
      visit(child);
    }
  }

  visit(plan.root);
  return operations;
}
