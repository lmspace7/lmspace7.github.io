---
title: ShadowWave 개발일지 8일차
description: HitReactionHandler 도입, 넉백/경직 표현, FSM 연동 개선
date: 2025-09-13 22:30:00 +0900
categories: [개발일지, 게임개발]
tags: [Unity, FishNet, 전투, 넉백, 경직, FSM]
pin: false
---

## 오늘의 작업 내용

- HitReactionHandler 추가: `DamageHit.OnDamaged(HitResult)`를 구독해 경직/넉백 표현
- 서버 권위: 넉백은 서버에서만 적용, 클라에서는 애니메이션 트리거만 재생
- FSM/이동 차단: 리액션 중 `EnemyController`의 FSM Tick/이동/속도 리셋 중지
- 넉백 방향 고정: `WeaponHitBox`에서 공격자 -> 대상 방향으로 `DamageInfo.Direction` 설정

HitReaction 역할을 하는 별도의 컴포넌트를 만들었다. 이 컴포넌트가 존재하지 않는다면 적 컴포넌트는 HitReaction을 처리하지 않고 HP만 감소한다. 또한 넉백이나 짧은 경직에 대해서 별도의 상태 컴포넌트로 만들지 않고 HitReactionHandler 컴포넌트에서 모두 처리하도록 했고, 이 시간 동안 FSM은 아예 동작하지 않도록 했다.


## 설계/구현

### 1) HitReactionHandler
- 입력: `HitResult`(FinalDamage, AppliedImpulse, Reaction, StunSeconds)
- 처리:
  - 애니: Light/Heavy 트리거 재생
  - 경직: `StunSeconds` 동안 내부 타이머로 입력·이동 잠금
  - 넉백: 서버에서 `Rigidbody.AddForce(ForceMode.VelocityChange)` 적용

### 2) EnemyController 연동
- 리액션 중에는 다음을 수행하지 않음:
  - `UpdateAI()`, `FSM.Tick()/TickFixed()`
  - `MoveTowardsPlayer()` 및 순찰 이동/회전
  - `ResetVelocity()`(속도 초기화)

### 3) 히트박스/방향
- `WeaponHitBox`: `info.Direction = (target - attacker).normalized`
- `HitResult.AppliedImpulse`가 명확한 전방 넉백으로 계산되도록 일관화

## 메모
- 로그로 히트/임펄스 확인: `[HitBox] 타격 성공 ... impulse ...`
- 리액션 쿨다운으로 과도한 경직 연속 발생 방지

## 다음 단계
- 경직 정책(슈퍼아머/방어) 최소 규칙 추가
- 원거리(프로젝트일) 리액션 파라미터 전달

## 마무리
일단 지금은 넉백이나 경직의 규모가 크지 않다고 판단해 아예 FSM과 분리된 컴포넌트 형태로 가볍게 운용했다. 다만 넉백 관련 로직이 늘어나거나 기획의 범위가 늘어나게 된다면 별도의 FSM 상태 클래스로 분리해 다룰 생각이다.

