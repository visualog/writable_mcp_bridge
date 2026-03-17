import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNamingRulePlan, listSupportedNamingRuleSets } from '../src/naming-rules.js';

function makeAppScreenTree() {
  return {
    id: 'root',
    name: 'Screen',
    type: 'FRAME',
    children: [
      {
        id: 'hdr',
        type: 'FRAME',
        name: 'unnamed',
        features: { layoutMode: 'HORIZONTAL', hasTextChild: true, iconChildCount: 2, atTop: true },
        children: [
          { id: 'title', type: 'TEXT', name: 'March 9', features: { textRole: 'title' }, children: [] },
          { id: 'actions', type: 'FRAME', name: 'icons', features: { iconChildCount: 2, horizontalIcons: true }, children: [] }
        ]
      },
      {
        id: 'query',
        type: 'FRAME',
        name: 'input frame',
        features: { inputLike: true },
        children: [
          { id: 'query-text', type: 'TEXT', name: 'placeholder', features: { textRole: 'field' }, children: [] }
        ]
      },
      {
        id: 'recent',
        type: 'FRAME',
        name: 'cards',
        features: { sectionKind: 'card-list', childCardCount: 3 },
        children: [
          {
            id: 'card-1',
            type: 'FRAME',
            name: 'card',
            features: { cardLike: true },
            children: [
              { id: 'card-1-title', type: 'TEXT', name: 'title', features: { textRole: 'title' }, children: [] }
            ]
          }
        ]
      },
      {
        id: 'floating-action',
        type: 'FRAME',
        name: 'plus',
        features: { fabLike: true },
        children: []
      }
    ]
  };
}

test('listSupportedNamingRuleSets exposes app-screen presets', () => {
  assert.ok(listSupportedNamingRuleSets().includes('app-screen'));
});

test('buildNamingRulePlan rejects unsupported rule sets', () => {
  assert.throws(
    () => buildNamingRulePlan(makeAppScreenTree(), { ruleSet: 'unknown-rule' }),
    /Unsupported naming rule set/
  );
});

test('buildNamingRulePlan returns deterministic app-screen updates', () => {
  const plan = buildNamingRulePlan(makeAppScreenTree(), { ruleSet: 'app-screen' });
  const namesByNode = new Map(plan.updates.map((item) => [item.nodeId, item.name]));

  assert.equal(plan.previewOnly, true);
  assert.equal(namesByNode.get('root'), 'app-screen');
  assert.equal(namesByNode.get('hdr'), 'header/container');
  assert.equal(namesByNode.get('title'), 'header/title');
  assert.equal(namesByNode.get('actions'), 'header/actions');
  assert.equal(namesByNode.get('query'), 'ai-query/input');
  assert.equal(namesByNode.get('query-text'), 'ai-query/field');
  assert.equal(namesByNode.get('recent'), 'card-list-basic');
  assert.equal(namesByNode.get('card-1-title'), 'recent-card/title');
  assert.equal(namesByNode.get('floating-action'), 'fab/trigger');
});

test('buildNamingRulePlan skips duplicate target names', () => {
  const tree = makeAppScreenTree();
  tree.children.push({
    id: 'floating-action-2',
    type: 'FRAME',
    name: 'plus 2',
    features: { fabLike: true },
    children: []
  });

  const plan = buildNamingRulePlan(tree, { ruleSet: 'app-screen' });
  const skipped = plan.skipped.find((item) => item.nodeId === 'floating-action-2');

  assert.ok(skipped);
  assert.match(skipped.reason, /Duplicate target name/);
});


function makeAiChatScreenTree() {
  return {
    id: 'chat-root',
    name: 'AI Chat',
    type: 'FRAME',
    children: [
      {
        id: 'chat-header',
        type: 'FRAME',
        name: 'header',
        features: { layoutMode: 'HORIZONTAL', hasTextChild: true, iconChildCount: 2, atTop: true },
        children: [
          { id: 'chat-header-title', type: 'TEXT', name: 'title', features: { textRole: 'title' }, children: [] },
          { id: 'chat-header-actions', type: 'FRAME', name: 'actions', features: { horizontalIcons: true, iconChildCount: 2 }, children: [] }
        ]
      },
      {
        id: 'chat-default',
        type: 'FRAME',
        name: 'ai-default',
        features: { sectionKind: 'ai-default' },
        children: [
          { id: 'chat-default-message', type: 'TEXT', name: 'message', features: { textRole: 'body' }, children: [] }
        ]
      },
      {
        id: 'chat-question',
        type: 'FRAME',
        name: 'question',
        features: { sectionKind: 'question' },
        children: []
      },
      {
        id: 'chat-answer',
        type: 'FRAME',
        name: 'answer',
        features: { sectionKind: 'answer' },
        children: []
      },
      {
        id: 'chat-reference',
        type: 'FRAME',
        name: 'reference',
        features: { sectionKind: 'reference-list' },
        children: []
      },
      {
        id: 'chat-input',
        type: 'FRAME',
        name: 'input',
        features: { sectionKind: 'input-footer', inputLike: true },
        children: [
          { id: 'chat-input-field', type: 'TEXT', name: 'placeholder', features: { textRole: 'field' }, children: [] }
        ]
      }
    ]
  };
}

test('buildNamingRulePlan supports content-screen-basic scaffolding', () => {
  const plan = buildNamingRulePlan(makeAiChatScreenTree(), { ruleSet: 'content-screen-basic' });
  const namesByNode = new Map(plan.updates.map((item) => [item.nodeId, item.name]));

  assert.equal(namesByNode.get('chat-root'), 'screen');
  assert.equal(namesByNode.get('chat-header'), 'screen/header');
  assert.equal(namesByNode.get('chat-header-title'), 'screen/header/title');
  assert.equal(namesByNode.get('chat-answer'), 'screen/body');
  assert.equal(namesByNode.get('chat-input'), 'screen/footer');
});

test('buildNamingRulePlan supports ai-chat-screen semantic blocks', () => {
  const plan = buildNamingRulePlan(makeAiChatScreenTree(), { ruleSet: 'ai-chat-screen' });
  const namesByNode = new Map(plan.updates.map((item) => [item.nodeId, item.name]));

  assert.equal(namesByNode.get('chat-root'), 'screen');
  assert.equal(namesByNode.get('chat-header'), 'screen/header');
  assert.equal(namesByNode.get('chat-header-title'), 'screen/header/title');
  assert.equal(namesByNode.get('chat-default'), 'screen/body/ai-default');
  assert.equal(namesByNode.get('chat-question'), 'screen/body/question');
  assert.equal(namesByNode.get('chat-answer'), 'screen/body/answer');
  assert.equal(namesByNode.get('chat-reference'), 'screen/body/reference-list');
  assert.equal(namesByNode.get('chat-input'), 'screen/footer/input');
  assert.equal(namesByNode.get('chat-input-field'), 'screen/footer/input-field');
});
