# Naming Rule Expansion 설계

## 목표
Extend `apply_naming_rule` with a more durable naming model that combines generic screen scaffolding with domain-specific semantic blocks.

## 새 rule set
- `content-screen-basic`
- `ai-chat-screen`

## 네이밍 모델
### 화면 스캐폴드ing
Use generic information-architecture layers for the top level:
- `screen/header`
- `screen/body`
- `screen/footer`
- `screen/primary-cta`
- `screen/secondary-cta`

### Domain semantics
Inside the generic skeleton, use domain names only where the block semantics are stable.
For AI chat-like screens:
- `screen/header/title`
- `screen/body/ai-default`
- `screen/body/question`
- `screen/body/answer`
- `screen/body/reference-list`
- `screen/footer/input`

## 이 모델을 쓰는 이유
Purely domain-specific naming becomes brittle across screens. Purely structural naming becomes too vague for implementation and review. This hybrid keeps the outer scaffold reusable and the inner content meaningful.

## 안전 규칙 rules
- keep pattern-mapped behavior only
- unmatched nodes remain unchanged
- duplicate target names still skip
- preview remains default

## 범위 of v2 expansion
- `content-screen-basic`: identifies generic header/body/footer groupings for vertically stacked app screens
- `ai-chat-screen`: specializes the body/footer blocks for AI question/answer flows
