import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBulkCreateNodesPlan,
  buildCreateNodePlan,
  listSupportedCreateNodeTypes
} from '../src/create-node.js';

test('listSupportedCreateNodeTypes exposes first-slice node types', () => {
  assert.deepEqual(listSupportedCreateNodeTypes(), ['FRAME', 'TEXT', 'RECTANGLE']);
});

test('buildCreateNodePlan normalizes text defaults', () => {
  const plan = buildCreateNodePlan({ parentId: 'parent', nodeType: 'TEXT' });

  assert.equal(plan.parentId, 'parent');
  assert.equal(plan.nodeType, 'TEXT');
  assert.equal(plan.name, 'text');
  assert.equal(plan.width, 160);
  assert.equal(plan.height, 24);
  assert.equal(plan.characters, 'New text');
});

test('buildCreateNodePlan keeps optional style and placement fields', () => {
  const plan = buildCreateNodePlan({
    parentId: 'parent',
    nodeType: 'RECTANGLE',
    name: 'promo-card',
    width: 240,
    height: 120,
    x: 40,
    y: 20,
    index: 2,
    fillColor: '#7553C4',
    cornerRadius: 16,
    opacity: 0.8
  });

  assert.equal(plan.name, 'promo-card');
  assert.equal(plan.width, 240);
  assert.equal(plan.height, 120);
  assert.equal(plan.x, 40);
  assert.equal(plan.y, 20);
  assert.equal(plan.index, 2);
  assert.equal(plan.fillColor, '#7553C4');
  assert.equal(plan.cornerRadius, 16);
  assert.equal(plan.opacity, 0.8);
});

test('buildCreateNodePlan rejects unsupported node types', () => {
  assert.throws(
    () => buildCreateNodePlan({ parentId: 'parent', nodeType: 'ELLIPSE' }),
    /Unsupported create node type/
  );
});

test('buildBulkCreateNodesPlan normalizes multiple create requests', () => {
  const plan = buildBulkCreateNodesPlan({
    nodes: [
      { parentId: 'parent', nodeType: 'FRAME', name: 'frame-a' },
      { parentId: 'parent', nodeType: 'TEXT', characters: 'Hello' }
    ]
  });

  assert.equal(plan.nodes.length, 2);
  assert.equal(plan.nodes[0].name, 'frame-a');
  assert.equal(plan.nodes[1].nodeType, 'TEXT');
  assert.equal(plan.nodes[1].characters, 'Hello');
});

test('buildBulkCreateNodesPlan rejects empty nodes', () => {
  assert.throws(
    () => buildBulkCreateNodesPlan({ nodes: [] }),
    /nodes is required/
  );
});
