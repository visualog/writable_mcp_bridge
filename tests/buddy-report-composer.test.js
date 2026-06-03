import test from "node:test";
import assert from "node:assert/strict";

import {
  BUDDY_PROGRESS_STATES,
  buildBuddyProgressTimeline,
  composeBuddyStyleAuditReport
} from "../src/buddy-report-composer.js";

test("composeBuddyStyleAuditReport keeps evidence before limitations", () => {
  const report = composeBuddyStyleAuditReport({
    title: "컴포넌트 분석 결과",
    completionClaim: "선택 컴포넌트 속성을 기준으로 QA를 진행했습니다.",
    evidence: ["variant 3개", "override 2개"],
    strengths: ["속성명이 역할 중심으로 구성되어 있습니다."],
    issues: [
      {
        severity: "high",
        subject: "disabled variant",
        detail: "비활성 상태가 정의되어 있지 않습니다."
      }
    ],
    priorities: [
      {
        severity: "high",
        title: "상태 variant 추가",
        subject: "disabled variant"
      }
    ],
    recommendations: ["disabled, hover, pressed 상태를 컴포넌트 set에 추가하세요."],
    limits: ["원격 라이브러리 publish 상태는 확인하지 못했습니다."]
  });

  assert.equal(report.includes("컴포넌트 분석 결과"), true);
  assert.equal(report.indexOf("근거") < report.indexOf("판단 제한"), true);
  assert.equal(report.includes("[높음] disabled variant"), true);
  assert.equal(report.includes("요약 우선순위"), true);
  assert.equal(report.includes("다음 액션"), true);
});

test("buildBuddyProgressTimeline exposes stable user-visible action labels", () => {
  const timeline = buildBuddyProgressTimeline(["reading", "analyzing", "validating", "completed"]);

  assert.deepEqual(
    timeline.map((item) => item.actionLabel),
    ["Read Figma frame", "Analyze evidence", "Validate result", "Complete report"]
  );
  assert.equal(BUDDY_PROGRESS_STATES.partial.label, "부분 완료");
  assert.equal(BUDDY_PROGRESS_STATES.failed.actionLabel, "Explain failure");
});
