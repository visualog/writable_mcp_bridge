import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchNodesPlan,
  searchNodeTree
} from '../src/node-discovery.js';

function makeTree() {
  return {
    id: 'root',
    name: 'app',
    type: 'SECTION',
    children: [
      {
        id: 'screen',
        name: 'iOS & iPadOS 26',
        type: 'FRAME',
        children: [
          { id: 'hero', name: 'Today Hero', type: 'FRAME', children: [] },
          { id: 'title', name: 'Today', type: 'TEXT', characters: 'Today', children: [] },
          { id: 'badge', name: 'Games', type: 'TEXT', characters: 'Games', children: [] }
        ]
      },
      {
        id: 'components',
        name: 'Components',
        type: 'FRAME',
        children: [
          { id: 'tab', name: 'Tab Bar', type: 'FRAME', children: [] }
        ]
      }
    ]
  };
}

test('buildSearchNodesPlan normalizes defaults and trims query', () => {
  const plan = buildSearchNodesPlan({ query: '  today  ' });

  assert.equal(plan.query, 'today');
  assert.equal(plan.maxDepth, 2);
  assert.equal(plan.maxResults, 50);
  assert.equal(plan.includeText, false);
  assert.equal(plan.targetNodeId, undefined);
});

test('buildSearchNodesPlan keeps unique node types and clamps limits', () => {
  const plan = buildSearchNodesPlan({
    nodeTypes: ['TEXT', 'FRAME', 'TEXT'],
    maxDepth: 99,
    maxResults: 0,
    includeText: true
  });

  assert.deepEqual(plan.nodeTypes, ['TEXT', 'FRAME']);
  assert.equal(plan.maxDepth, 8);
  assert.equal(plan.maxResults, 1);
  assert.equal(plan.includeText, true);
});

test('searchNodeTree finds matching descendants without including the root', () => {
  const result = searchNodeTree(makeTree(), {
    query: 'today',
    maxDepth: 3,
    maxResults: 10
  });

  assert.equal(result.root.id, 'root');
  assert.deepEqual(
    result.matches.map((item) => item.id),
    ['hero', 'title']
  );
});

test('searchNodeTree filters by node type and limits depth', () => {
  const result = searchNodeTree(makeTree(), {
    nodeTypes: ['FRAME'],
    maxDepth: 1,
    maxResults: 10
  });

  assert.deepEqual(
    result.matches.map((item) => item.id),
    ['screen', 'components']
  );
});

test('searchNodeTree truncates results at maxResults', () => {
  const result = searchNodeTree(makeTree(), {
    maxDepth: 3,
    maxResults: 2
  });

  assert.equal(result.matches.length, 2);
  assert.equal(result.truncated, true);
});
