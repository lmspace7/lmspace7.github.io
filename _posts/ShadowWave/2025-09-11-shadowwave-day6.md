---
title: ShadowWave 개발일지 6일차
description: 무기 생성기 통합, 장착/교체 RPC, 근접 콤보 액션, 네트워크 애니메이션 동기화
date: 2025-09-11 17:50:00 +0900
categories: [개발일지, 게임개발]
tags: [Unity, FishNet, 무기, ScriptableObject, OdinInspector, InputSystem, 네트워크, 멀티플레이, ShadowWave]
pin: false
---

## 오늘의 작업 내용
- 에디터: `WeaponCreatorEditorWindow`에 "근접 무기 생성" 버튼 추가
  - Logic / Recorder / Sequence 에셋 자동 생성 및 바인딩
  - 원거리 무기 생성은 추후 작업 예정
- 무기 장착: `WeaponController`의 서버 권한 장착 요청 + 옵저버 동기화(RPC)
  - 반경 탐색 → 소켓 부착(`WeaponObject`) → `AnimatorOverrideController` 적용
  - 기즈모로 탐색 반경 시각화
- 근접 전투: `SO_WeaponSequence` + `MeleeWeaponLogic` + `MeleeComboAction`
  - 콤보 인덱스와 애니메이션 파라미터(NetworkAnimator) 동기화
- 플레이어 상태: `PlayerAttackState`에서 무기 로직 생성/수명주기 관리 및 상태 전환
- 카메라: `PlayerCamera`로 소유자 기준 `CinemachineCamera` 스폰 및 Follow 설정

에디터에서 근접 무기 데이터 세트를 한 번에 만들 수 있게 했다. 런타임에서는 RPC 기반 서버 권한 + ObserversRpc로 장착/교체가 효율적으로 클라이언트에 동기화되도록 했다.
또한 플레이어 공격 애니메이션이 네트워크 상에서 동기화되도록 했다.

**무기 시각화 자료**
<img width="1164" height="327" alt="Image" src="https://github.com/user-attachments/assets/9111e781-5c36-4167-a42d-f35f992dc4d4" />

## 설계/구현

### 1) 에디터: 무기 세트 자동 생성(Logic/Recorder/Sequence)

`WeaponCreatorEditorWindow`에서 근접 무기 버튼을 누르면 Logic/Recorder/Sequence를 생성하고 서로 연결한다. 시퀀스 타입은 메타데이터로 지정된다.
<img width="965" height="513" alt="Image" src="https://github.com/user-attachments/assets/82b5e3d0-7b12-4c06-9772-39499642f3f4" />


### 2) 장착/교체: 서버 권한 + 옵저버 동기화

클라이언트 입력은 서버에 `ServerRpc`로 장착을 요청하고, 서버가 처리 후 `ObserversRpc`로 전파한다. 소켓 부착 시 `SO_WeaponRecorder`의 기록값을 우선 적용한다.

```csharp
[ServerRpc]
private void RPC_RequestEquip(WeaponObject target)
{
    Internal_Equip(target);
    RPC_Equip(target);
}

[ObserversRpc]
private void RPC_Equip(WeaponObject weaponObject)
{
    Internal_Equip(weaponObject);
}
```

### 3) 근접 콤보: 입력 버퍼/타이밍/애니 동기화

[https://www.youtube.com/watch?v=egnQTod1Vyk](https://www.youtube.com/watch?v=egnQTod1Vyk)
이 영상의 도움을 많이 받았다.

`SO_WeaponSequence`의 `AttackStep`으로 타이밍 윈도우를 정의한다. `MeleeComboAction`은 입력 버퍼와 타이밍을 평가해 다음 스텝을 큐잉하고, `NetworkAnimator` 트리거/정수 파라미터로 콤보를 동기화한다.

```csharp
if (_queuedNextCombo == true && _queuedAppliedInState == false && elapsedTime >= step.ComboTimingEnd)
{
    int nextIndex = Mathf.Min(_curCombo + 1, lastIndex);
    _targetComboIndex = nextIndex;
    _netAnim.Animator.SetInteger(PlayerAnim.Param.ComboCount, _targetComboIndex);
    _queuedAppliedInState = true;
}
```

### 4) 플레이어 상태 연동: 액션 수명주기와 상태 전환

`PlayerAttackState`는 현재 무기의 `IWeaponLogic`에서 액션을 생성해 Tick/Cancel을 관리한다. 액션이 종료되면 이동 입력 유무로 Move/Idle로 전환한다.

```csharp
// 생성
if (weapon.WeaponLogic is IWeaponLogic logic)
    _action = logic.CreateAction(_context);

// 루프
_action.Tick(Time.deltaTime);
if (_action.IsRunning || _action.IsNextStepBuffered)
{
    return;
}
else if (_context.Input.HasMoveInput())
{
    _context.FSM.SetState(E_PlayerState.Move);
    return;
}
_context.FSM.SetState(E_PlayerState.Idle);
```


## 네트워크/애니메이션 동기화
- Host/Client 환경에서 장착/교체가 서버 권한으로 일관되게 반영됨을 확인
- 공격 트리거와 `ComboCount` 정수 파라미터가 관측자에게 동일하게 복제됨을 확인
- 콤보 타이밍 윈도우 종료 시점의 파라미터 적용이 프레임 경합 없이 안정적으로 동작

## 메모
- 장착/교체: 반경 탐색 → 장착 요청(ServerRpc) → 적용(서버) → 동기화(ObserversRpc) 정상 동작
- 콤보: 입력 버퍼/홀드 체인/타이밍 윈도우 평가에 따라 단계적 상태 전환이 기대대로 작동
- 애니메이션: NetworkAnimator 기반 트리거/정수 파라미터 동기화 정상
- 카메라: 소유자 전용 시점 생성 및 추적 정상
- 에셋/프리팹: `SO_Weapon`의 링크 버튼으로 `WeaponObject`/`WeaponRecorder` 누락 상태를 즉시 보정
- 상태 해제 타이밍: 콤보 종료 조건을 "큐 없음 + 애니메이션 종료" 또는 "태그 이탈"로 분리해 조기 종료/지연 종료 이슈 완화
- 입력 기록: 진행 중에도 입력 시간을 갱신해 버퍼 판정 누락을 방지

## 다음 단계
- 원거리 무기 로직/액션 구현 및 시퀀스 확장
- 히트 판정/데미지 서버 권한 처리(레이캐스트/지연 보정 포함)
- 무기 스탯(공속/리치 등) 정의 및 FSM 연동


## 마무리
개인적인 일로 좀 바빠서 오랜만에 작업에 들어갔다. 오랜만에 하다 보니 이전보다 규모가 많이 커졌음을 체감했다. 어디서 무엇을 작업 중인지 헤매기 시작했고, 이곳저곳을 오가고 있으며, 외부 에셋도 점점 늘고 있다.
특히 콤보 공격이나 SO 기반 자동화 툴 작업은 이제는 예전처럼 머릿속으로 바로 처리할 수가 없었고, 구조가 복잡해진 만큼 오히려 고민하는 시간이 더 많아졌다. 그래서 이제는 간단한 작업이라도 시각화와 문서화를 조금씩 병행하며 진행해야 할 것 같다.


