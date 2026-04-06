import test from "node:test";
import assert from "node:assert/strict";

import { buildLayoutPlan } from "../src/build-layout.js";

test("buildLayoutPlan normalizes screen preset defaults", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    tree: {
      helper: "screen",
      preset: "iphone-17-pro",
      name: "demo-screen"
    }
  });

  assert.equal(plan.parentId, "33023:62");
  assert.equal(plan.root.helper, "screen");
  assert.equal(plan.root.name, "demo-screen");
  assert.equal(plan.root.width, 402);
  assert.equal(plan.root.height, 874);
  assert.equal(plan.root.widthMode, "fixed");
  assert.equal(plan.root.heightMode, "fixed");
  assert.equal(plan.root.fill, "#FFFFFF");
});

test("buildLayoutPlan normalizes card and text children", () => {
  const plan = buildLayoutPlan({
    defaultParentId: "page:1",
    tree: {
      helper: "column",
      name: "content",
      children: [
        {
          helper: "card",
          name: "comment-card",
          children: [{ helper: "text", characters: "Hello world" }]
        }
      ]
    }
  });

  const card = plan.root.children[0];
  const text = card.children[0];

  assert.equal(plan.parentId, "page:1");
  assert.equal(card.helper, "card");
  assert.equal(card.gap, 12);
  assert.equal(card.radius, 18);
  assert.deepEqual(card.padding, { top: 16, right: 16, bottom: 16, left: 16 });
  assert.equal(text.helper, "text");
  assert.equal(text.characters, "Hello world");
  assert.equal(text.widthMode, "hug");
});

test("buildLayoutPlan supports row padding shorthands", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    tree: {
      helper: "row",
      padding: { x: 20, y: 16 }
    }
  });

  assert.deepEqual(plan.root.padding, {
    top: 16,
    right: 20,
    bottom: 16,
    left: 20
  });
});

test("buildLayoutPlan expands section helper with title text", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    tree: {
      helper: "section",
      name: "recent-books",
      title: "최근 읽은 문장의 책",
      children: [{ helper: "list", name: "book-list" }]
    }
  });

  assert.equal(plan.root.helper, "section");
  assert.equal(plan.root.layout, "column");
  assert.equal(plan.root.children[0].helper, "text");
  assert.equal(plan.root.children[0].characters, "최근 읽은 문장의 책");
  assert.equal(plan.root.children[1].helper, "list");
});

test("buildLayoutPlan expands list-item helper into a reusable row pattern", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    tree: {
      helper: "list-item",
      name: "finance-row",
      title: "Investments",
      meta: "12:44 AM",
      trailing: "+₹ 1,000.00"
    }
  });

  assert.equal(plan.root.helper, "row");
  assert.equal(plan.root.widthMode, "fill");
  assert.equal(plan.root.justify, "space-between");
  assert.equal(plan.root.children[0].helper, "card");
  assert.equal(plan.root.children[1].helper, "column");
  assert.equal(plan.root.children[1].children[0].characters, "Investments");
  assert.equal(plan.root.children[1].children[1].characters, "12:44 AM");
  assert.equal(plan.root.children[2].helper, "text");
  assert.equal(plan.root.children[2].characters, "+₹ 1,000.00");
});

test("buildLayoutPlan requires a parent source", () => {
  assert.throws(() => buildLayoutPlan({}), /parentId is required/);
});
