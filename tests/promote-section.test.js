import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPromoteSectionPlan } from '../src/section-commands.js';

function makeTree() {
  return {
    id: 'parent',
    type: 'FRAME',
    name: 'stack',
    supportsAutoLayout: true,
    children: [
      { id: 'hero', type: 'FRAME', name: 'hero-banner' },
      { id: 'recent', type: 'FRAME', name: 'recent-section' },
      { id: 'recommend', type: 'FRAME', name: 'recommendation-section' }
    ]
  };
}

test('buildPromoteSectionPlan promotes a section to index 0 in the same parent by default', () => {
  const plan = buildPromoteSectionPlan(makeTree(), { sectionId: 'recommend' });
  assert.equal(plan.operation, 'reorder');
  assert.equal(plan.destinationParentId, 'parent');
  assert.equal(plan.movePlan.index, 0);
  assert.equal(plan.previewOnly, true);
});

test('buildPromoteSectionPlan returns noop when the section is already primary', () => {
  const plan = buildPromoteSectionPlan(makeTree(), { sectionId: 'hero' });
  assert.equal(plan.operation, 'noop');
  assert.equal(plan.movePlan, null);
});

test('buildPromoteSectionPlan creates spacing plan only when destination supports auto layout', () => {
  const plan = buildPromoteSectionPlan(makeTree(), {
    sectionId: 'recent',
    normalizeSpacing: { spacing: 12, mode: 'both', recursive: true }
  });

  assert.deepEqual(plan.spacingPlan, {
    containerId: 'parent',
    spacing: 12,
    mode: 'both',
    recursive: true
  });
});

test('buildPromoteSectionPlan supports destination parent overrides', () => {
  const tree = makeTree();
  tree.children.push({
    id: 'secondary-parent',
    type: 'FRAME',
    name: 'secondary',
    supportsAutoLayout: false,
    children: []
  });

  const plan = buildPromoteSectionPlan(tree, {
    sectionId: 'recommend',
    destinationParentId: 'secondary-parent',
    index: 1,
    previewOnly: false
  });

  assert.equal(plan.operation, 'move');
  assert.equal(plan.destinationParentId, 'secondary-parent');
  assert.equal(plan.movePlan.index, 1);
  assert.equal(plan.previewOnly, false);
  assert.equal(plan.spacingPlan, null);
});
