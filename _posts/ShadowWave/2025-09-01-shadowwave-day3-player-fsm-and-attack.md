---
title: ShadowWave 개발일지 3일차
description: 플레이어 FSM 구축, 이동/회피/공격 구현 및 상태 동기화 검증
date: 2025-09-01 10:29:00 +0900
categories: [개발일지, 게임개발]
tags: [Unity, FishNet, 네트워크, 멀티플레이, ShadowWave]
pin: false
---

## 오늘의 작업 내용

- 플레이어 FSM 구축: Idle / Move / Roll / Attack 상태 컴포넌트화
- 공통 상태 베이스 `BaseState<TEnum, TOwner>` 설계 및 적용
- `PlayerFSM`에 `SyncEnum<E_PlayerState>` 적용, 서버 권한 기반 상태 전이
- `PlayerController`에서 초기화/입력 연동 및 애니메이터 Speed 갱신
- `PlayerInputHandler`로 InputSystem 연동(이동/달리기/회피/공격)
- `PlayerStats` + `SO_PlayerStat`로 이동·회전·회피·공격 파라미터 외부화
- 호스트/클라이언트 환경에서 상태·애니메이션 동기화 테스트 완료.

## 구현 배경

- 2일차에 만든 `SyncEnum<TEnum>`을 실제 플레이어 FSM에 적용해 **상태 중심 설계**로 전환.
- 이동/회피/공격을 각각의 상태로 나누어 **책임 분리**와 **전이 제어의 명확성**을 확보.

## 설계/구현 요점

### 1) BaseState 공통 베이스

- 상태 공통 의존성(소유자, FSM, NetworkAnimator, CharacterController, Input, Stats)을 **초기화/해제**로 표준화.
- 각 상태는 `Enter/Exit/Update/FixedUpdate/Cancle` 생명주기를 동일하게 가짐.

### 2) PlayerFSM

- `GetComponentsInChildren<BaseState<...>>()`로 상태를 수집해 **딕셔너리 등록**.
- 서버 권한 모델: 서버에서만 `_syncPlayerState.ServerSetValue(next)`로 값 변경.
- 클라이언트는 `ServerRpc`로 전이 요청. 서버 적용 후 동기화.

```csharp
[Button]
public void SetState(E_PlayerState nextState)
{
    if (IsServerInitialized)
    {
        _stateDict[CurState].ExitState();
        _syncPlayerState.ServerSetValue(nextState);
        _stateDict[nextState].EnterState();
    }
    else
    {
        _stateDict[CurState].ExitState();
        RPC_RequestSetState(nextState);
        _stateDict[nextState].EnterState();
    }
}
```

### 3) PlayerController

- `OnStartClient`에서 FSM/입력 초기화. Owner에서만 입력 Tick과 FSM Tick 수행.
- 매 프레임 애니메이터 `Speed`를 입력/이동 속도로 갱신해 **상태와 무관한 가독성 있는 속도 표현** 유지.

### 4) 상태별 핵심 로직

- Idle: 이동 입력/회피/공격 입력에 따라 Move/Roll/Attack으로 전이.
- Move: 이동/회전 처리, 달리기 시 속도 상승. 입력 해제 시 Idle. 회피/공격 입력 시 전이.
- Roll: 애니메이션 진입 여부 플래그와 경과 시간 기반으로 이동/감쇠/종료 제어. 쿨다운, 거리, 시간으로 속도 계산.
- Attack: 애니메이션 태깅과 경과 시간을 기준으로 공격 중/종료 판정. 종료 후 입력 유무에 따라 Idle/Move로 전이.

```csharp
// Roll 진입 시 설정 예시
_rollDirection = _owner.GetForwardDirection();
_rollTime = _stat.GetRollTime();
_rollDistance = _stat.GetRollDistance();
_rollSpeed = _rollDistance / _rollTime;
_netAnim.SetTrigger("Roll");
```

```csharp
// Attack 종료 전이 예시
if (isEndAttack && _input.HasMoveInput())
{
    _fsm.SetState(E_PlayerState.Move);
}
else if (isEndAttack && _input.HasMoveInput() == false)
{
    _fsm.SetState(E_PlayerState.Idle);
}
```

### 5) 입력/스탯

- InputSystem `InputActionReference`로 이동/달리기/회피/공격 입력을 Polling.
- `SO_PlayerStat`에 이동속도/회전속도/회피 시간·거리·쿨다운, 공격 시간·쿨다운을 매개변수화.

## 상태 전이 흐름(요약)

- Idle → Move: 이동 입력 발생
- Idle/Move → Roll: 회피 입력 + 쿨다운 완료
- Idle/Move → Attack: 공격 입력 + 쿨다운 완료
- Roll → Idle: 애니메이션 종료 + 롤 시간 경과
- Attack → Idle/Move: 애니메이션 종료 후 이동 입력 유무에 따라 분기

## 네트워크/애니메이션 동기화

- `SyncEnum<E_PlayerState>`의 OnChange 이벤트로 전이 로그 및 추가 처리 여지 확보.
- `NetworkAnimator` 트리거(`Roll`, `Attack`)로 애니메이션 상태가 관측자에게 복제되어 **시각적 일관성** 유지.

## 테스트 결과

- Host-Client 1:1 환경에서 전이, 이동, 회피, 공격 모두 정상 동작 확인.
- 애니메이션 전이 구간(Transition)에서의 이동/감쇠/종료 조건이 기대대로 평가됨.
- 쿨다운(회피/공격) 재입력 방지 동작 확인.

## 트러블슈팅 메모

- 애니메이션 전이 초기에 태그 미일치로 인한 조건 혼선을 방지하기 위해
  진입 플래그(`_enterRollAnimation`, `_enteredAttackAnim`)로 **최초 진입 시점**을 명확히 구분.
- 롤 종료 직전 감쇠 구간을 분리해 시각적 끊김을 줄임.

## 다음 단계

- 콤보/차지 등 **공격 확장**(하위 상태 또는 복합 상태)
- **피해 판정/피격 상태** 및 무적 프레임 적용
- 적 AI FSM에 `SyncEnum<E_EnemyState>` 적용
- 카메라 연출(Cinemachine 3.x) 및 입력 UX 개선


