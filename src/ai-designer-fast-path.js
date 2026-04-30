function normalizeText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeTopicLabel(value) {
  return normalizeText(value).replace(
    /^(선택한|선택된|텍스트|텍스트를|텍스트 내용|텍스트 내용을|내용|내용을)\s+/,
    ""
  );
}

function uniqById(items = []) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const id = normalizeText(item?.id);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    output.push(item);
  }
  return output;
}

export function matchSelectionTextRewriteFastPath(message = "", figmaContext = {}, intentEnvelope = null) {
  const prompt = normalizeText(message);
  const selection = Array.isArray(figmaContext?.selection) ? figmaContext.selection : [];
  const kind = intentEnvelope?.intents?.[0]?.kind || null;
  const topicLabelMatches = prompt.match(/([A-Za-z0-9가-힣]+(?:\s+[A-Za-z0-9가-힣]+)?\s*동호회)/g);
  const topicLabel = Array.isArray(topicLabelMatches) && topicLabelMatches.length > 0
    ? normalizeTopicLabel(topicLabelMatches[topicLabelMatches.length - 1])
    : "";
  const looksLikeSelectionTextRewrite =
    /(선택한|선택된)/.test(prompt) &&
    /(텍스트|문구|카피)/.test(prompt) &&
    /(변경|바꿔|바꿔줘|수정|고쳐)/.test(prompt);

  if (!topicLabel) {
    return null;
  }
  if (
    kind &&
    kind !== "revise_copy" &&
    kind !== "refine_typography" &&
    kind !== "improve_hierarchy" &&
    kind !== "analyze"
  ) {
    return null;
  }
  if (!looksLikeSelectionTextRewrite) {
    return null;
  }

  return {
    type: "selection_text_rewrite",
    topicLabel,
    selectionIds: uniqById(selection).map((item) => item.id).filter(Boolean)
  };
}

export function buildClubTopicTextUpdates(topicLabel, textNodes = []) {
  const clubLabel = normalizeText(topicLabel);
  const activityLabel = clubLabel.replace(/동호회$/u, "") || clubLabel;
  const templates = [
    `${clubLabel} 5월 정기모임 안내`,
    `이번 주 ${activityLabel} 모임 참석 가능하신 분 모집합니다.`,
    `${clubLabel} 신규 회원 환영 및 첫 오프라인 모임 공지`,
    `${activityLabel} 관련 추천 장소와 준비물을 자유롭게 공유해요.`,
    `${clubLabel} 상반기 일정 조율을 위한 참석 여부 조사`,
    `이번 달 ${activityLabel} 번개 모임 후보 날짜를 확인해 주세요.`,
    `${clubLabel} 후기 공유 스레드와 다음 모임 아이디어 모집`,
    `${activityLabel} 초보 참여자를 위한 입문 가이드와 준비 팁`,
    `${clubLabel} 운영 공지 및 소규모 모임 리더 모집`,
    `다음 ${activityLabel} 모임에서 다루고 싶은 주제를 댓글로 남겨 주세요.`
  ];

  return uniqById(textNodes).map((node, index) => ({
    nodeId: node.id,
    text: templates[index % templates.length]
  }));
}
