---
title: ShadowWave 개발일지 10일차
description: 멀티플레이 친화 HitStop 설계와 가이드(전역 TimeScale 미사용)
date: 2025-09-17 22:30:00 +0900
categories: [개발일지, 게임개발]
tags: [Unity, FishNet, HitStop, 카메라, 애니메이션]
pin: false
---

## 오늘의 작업 내용

- HitStop 개념 정리: 전역 `Time.timeScale` 대신 로컬 표현 정지
- `HitStopManager` 작성: `Request(seconds)` 함수를 이벤트 브로드캐스터로 사용(시작/종료)
- 구독자 설계 가이드: 애니메이션/물리/FSM/입력/카메라가 로컬로 정지·복귀

## 설계/가이드

### 1) 범위/정책
- 공격자/피격자/관측자 범위 선택, 중첩 정책(갱신/최대/합산) 정의
- 서버는 표현에 개입하지 않음(결정만 서버: 치명타/리액션 수치 확정)

### 2) 이벤트 소스
- 서버 확정 후 `ObserversRpc/TargetRpc` → SO 이벤트 채널로 분배
- `HitResult.HitStopSeconds`를 근거로 로컬 `Request` 호출

### 3) 구독자
- Animator: `speed = 0` / 복구
- Rigidbody: `linearVelocity` 백업/0/복구
- AI/FSM: `IsHitStopped` 차단(리액션 차단과 유사)
- 카메라: 짧은 셰이크/임펄스 동반

## 리액션 정책 업데이트(하이브리드)

– 배경: 초기에는 `HitReactionHandler`의 플래그(`IsInReaction`)만으로 경직/넉백을 처리했으나, 로직 복잡도 상승과 무거운 반응의 명시적 전환이 필요해져 하이브리드로 전환.
- 정책:
  - Light: 기존과 동일하게 플래그 기반 차단(짧은 스턴/히트스탑)으로 처리
  - Heavy: 서버에서 전용 상태로 전환 → `E_EnemyState.Stagger`
  - 종료: `HitReactionHandler.IsInReaction == false`가 되는 시점에 `Chasing/Idle`로 복귀
- 구현 포인트:
  - `E_EnemyState`에 `Stagger` 추가
  - `EnemyStaggerState` 신설: 진입 시 `ResetVelocity()`, 체력 0 시 `Dead` 우선, 종료 시 탐지 여부에 따라 복귀 상태 결정
  - `HitReactionHandler`: Heavy 수신 시 서버에서 `EnemyFSM.SetState(E_EnemyState.Stagger)` 호출

```csharp
// HitReactionHandler (Heavy 수신 시)
_netAnim.SetTrigger(_heavyTrigger);
StartReaction(result.StunSeconds);
if (IsServerInitialized)
{
    _context.FSM.SetState(E_EnemyState.Stagger);
}
```

```csharp
// EnemyStaggerState: 종료 조건은 HitReactionHandler의 IsInReaction 해제
public override void UpdateState()
{
    if (handler.IsInReaction == false)
    {
        bool detected = _owner.IsPlayerInDetectionRange(out float distance);
        _context.FSM.SetState(detected ? E_EnemyState.Chasing : E_EnemyState.Idle);
    }
}
```


