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

test("buildLayoutPlan expands media-row helper into a richer reusable row pattern", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    tree: {
      helper: "media-row",
      name: "book-result",
      title: "미라클 베드타임",
      subtitle: "아이의 미래가 달라지는...",
      meta: "뮤직멘토 김연수",
      trailing: "완료"
    }
  });

  assert.equal(plan.root.helper, "row");
  assert.equal(plan.root.widthMode, "fill");
  assert.equal(plan.root.justify, "space-between");
  assert.equal(plan.root.children[0].helper, "card");
  assert.equal(plan.root.children[0].width, 56);
  assert.equal(plan.root.children[1].helper, "column");
  assert.equal(plan.root.children[1].children[0].characters, "미라클 베드타임");
  assert.equal(plan.root.children[1].children[1].characters, "아이의 미래가 달라지는...");
  assert.equal(plan.root.children[1].children[2].characters, "뮤직멘토 김연수");
  assert.equal(plan.root.children[2].characters, "완료");
});

test("buildLayoutPlan expands search-result-row helper with larger leading media and stacked copy", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    tree: {
      helper: "search-result-row",
      name: "book-search-result",
      title: "미라클 베드타임",
      subtitle: "아이의 미래가 달라지는...",
      meta: "뮤직멘토 김연수"
    }
  });

  assert.equal(plan.root.helper, "row");
  assert.equal(plan.root.widthMode, "fill");
  assert.equal(plan.root.children[0].helper, "card");
  assert.equal(plan.root.children[0].width, 72);
  assert.equal(plan.root.children[1].helper, "column");
  assert.equal(plan.root.children[1].children[0].characters, "미라클 베드타임");
  assert.equal(plan.root.children[1].children[1].characters, "아이의 미래가 달라지는...");
  assert.equal(plan.root.children[1].children[2].characters, "뮤직멘토 김연수");
  assert.equal(plan.root.children.length, 2);
});

test("buildLayoutPlan expands status-chip helper with tone-aware label styling", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    tree: {
      helper: "status-chip",
      name: "priority-chip",
      tone: "urgent",
      icon: "⚑",
      label: "Urgent"
    }
  });

  assert.equal(plan.root.helper, "row");
  assert.equal(plan.root.widthMode, "hug");
  assert.equal(plan.root.fill, "#FFF1F1");
  assert.equal(plan.root.children[0].characters, "⚑");
  assert.equal(plan.root.children[1].characters, "Urgent");
});

test("buildLayoutPlan expands avatar-stack helper into avatar cards and labels", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    tree: {
      helper: "avatar-stack",
      name: "assignees",
      avatars: [
        { initials: "GY", fill: "#8B80F9" },
        { initials: "HG", fill: "#B8B0FF" }
      ]
    }
  });

  assert.equal(plan.root.helper, "row");
  assert.equal(plan.root.widthMode, "hug");
  assert.equal(plan.root.children[0].helper, "card");
  assert.equal(plan.root.children[0].width, 20);
  assert.equal(plan.root.children[1].characters, "GY");
  assert.equal(plan.root.children[2].helper, "card");
  assert.equal(plan.root.children[3].characters, "HG");
});

test("buildLayoutPlan expands progress-bar helper into track fill and percent label", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    tree: {
      helper: "progress-bar",
      name: "task-progress",
      value: 85,
      trackWidth: 100
    }
  });

  assert.equal(plan.root.helper, "row");
  assert.equal(plan.root.children[0].helper, "row");
  assert.equal(plan.root.children[0].children[0].helper, "card");
  assert.equal(plan.root.children[0].children[0].width, 85);
  assert.equal(plan.root.children[1].characters, "85%");
});

test("buildLayoutPlan expands toolbar helper into spaced left and right groups", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    tree: {
      helper: "toolbar",
      name: "board-toolbar",
      title: "Projects",
      rightItems: [
        { helper: "status-chip", name: "share-chip", label: "Share", tone: "normal" }
      ]
    }
  });

  assert.equal(plan.root.helper, "row");
  assert.equal(plan.root.widthMode, "fill");
  assert.equal(plan.root.justify, "space-between");
  assert.equal(plan.root.children[0].helper, "row");
  assert.equal(plan.root.children[0].children[0].characters, "Projects");
  assert.equal(plan.root.children[1].helper, "row");
});

test("buildLayoutPlan expands tabbar helper into reusable tab chips", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    tree: {
      helper: "tabbar",
      name: "views",
      activeIndex: 0,
      tabs: [
        { label: "Spreadsheet", icon: "▦" },
        { label: "Timeline" }
      ]
    }
  });

  assert.equal(plan.root.helper, "row");
  assert.equal(plan.root.widthMode, "fill");
  assert.equal(plan.root.children[0].helper, "card");
  assert.equal(plan.root.children[0].children[1].characters, "Spreadsheet");
  assert.equal(plan.root.children[1].helper, "card");
});

test("buildLayoutPlan expands data-table helper into header and row list", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    tree: {
      helper: "data-table",
      name: "tasks-table",
      title: "In Progress",
      columns: ["Task", "Due Date", "Priority"],
      rows: [
        ["Wireframing", "February 12, 2024", "Urgent"],
        ["Hi-Fi Design", "February 14, 2024", "Low"]
      ]
    }
  });

  assert.equal(plan.root.helper, "section");
  assert.equal(plan.root.children[0].characters, "In Progress");
  assert.equal(plan.root.children[1].helper, "row");
  assert.equal(plan.root.children[1].children[0].characters, "Task");
  assert.equal(plan.root.children[2].helper, "list");
  assert.equal(plan.root.children[2].children[0].helper, "row");
  assert.equal(plan.root.children[2].children[0].children[0].characters, "Wireframing");
});

test("buildLayoutPlan requires a parent source", () => {
  assert.throws(() => buildLayoutPlan({}), /parentId is required/);
});

test("buildLayoutPlan can generate a timestamped root name for test screens", () => {
  const plan = buildLayoutPlan({
    parentId: "33023:62",
    generatedNamePrefix: "build-layout-review",
    generatedAt: "2026-04-06T16:30:45+09:00",
    tree: {
      helper: "screen",
      preset: "iphone-17-pro"
    }
  });

  assert.equal(plan.root.name, "build-layout-review-20260406-163045");
});
