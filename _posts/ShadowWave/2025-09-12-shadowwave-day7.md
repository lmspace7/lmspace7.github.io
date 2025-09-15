---
title: ShadowWave 개발일지 7일차
description: 데미지/히트박스 통합, 서버 권위 처리, 콤보 타이밍 윈도우
date: 2025-09-12 23:10:00 +0900
categories: [개발일지, 게임개발]
tags: [Unity, FishNet, 무기, 전투, 히트박스, 데미지, ScriptableObject, InputSystem]
pin: false
---

## 오늘의 작업 내용

- 데이터 Model: `DamageInfo`, `HitResult`, `E_Damage`, `E_HitReaction` + `IDamageable`, `ITeamOwner`
- 수신: `DamageHit`에 서버 권위 `ApplyDamage` 구현(팀 판정, 사망, RPC 통지)
- 발신: `WeaponHitBox`에 소유자/템플릿 주입, 서버 전용 트리거 판정, 팀/자기 자신 필터, 스윙당 1회 히트 캐시
- 타이밍 윈도우: `MeleeComboAction`에서 스텝의 `ComboTimingStart/End` 구간에 `Activate/Deactivate`
- 무기 로직: `MeleeWeaponLogic.CreateAction`에서 액션 생성 직후 히트박스 주입
- 플레이어 팀 판정: `PlayerController`가 `ITeamOwner` 구현(팀/자기 자신 필터)

무기-히트박스-데미지로 이어지는 공격과 피격에 대한 부분을 서버 권위기반으로 작성했다. 콤보 타이밍에 맞춰 히트박스가 켜지고 꺼지며, 팀/자기 자신 필터와 중복 히트 방지가 안정적으로 작동해 한 번의 스윙은 단 한 번만 맞는다. 공격의 행동(MeleeAction)이 생성되는 순간 히트박스가 주입이 되도록 로직을 수정했고, 공격의 결과는 `옵저버 RPC`로 관측자에게만 전송되도록했다.

## 설계/구현

### 1) 데미지 모델/계약
- 구조체 `DamageInfo`(공격자/팀/수치/공간/부가효과), `HitResult`(최종 데미지/리액션)를 정의
- `IDamageable`(CanReceive/Apply)와 `ITeamOwner`(TeamId/소유자/동일팀 판정)로 결합도 축소
```csharp
  /// <summary>
  /// 데미지의 성격(근접/원거리/마법/...)을 구분
  /// </summary>
  public enum E_Damage {...}

  /// <summary>
  /// 피격 시 리액션 강도
  /// </summary>
  public enum E_HitReaction {...}

  /// <summary>
  /// 공격 한 번에 대한 입력 데이터 집합
  /// - 서버가 이를 기반으로 최종 데미지를 계산하고 적용
  /// </summary>
  [Serializable]
  public struct DamageInfo {...}

  /// <summary>
  /// 데미지 적용 결과
  /// - 서버에서 산출 후 옵저버에 통지
  /// </summary>
  [Serializable]
  public struct HitResult {...}
```

### 2) 서버 권위 수신 코어
- `DamageHit.ApplyDamage`는 서버에서만 체력 가감/무적/사망 판정 수행 후 `ObserversRpc`/`TargetRpc`로 결과 전파

> ### **왜 ObserversRPC/TargetRPC인가?**
> - 현재 게임은 플레이어 활동 범위가 넓게 분리되지 않아 ClientRPC만 사용해도 동작은 가능하다. 다만 학습과 효율을 위해 전파 범위를 최적화했다.
> - ObserversRPC: 해당 오브젝트를 실제로 관측 중인 클라이언트에게만 보낸다. 화면 밖/관심 영역 밖 클라이언트에는 전송하지 않아 대역을 절약한다. 관측자 판정은 FishNet이 자동으로 처리한다.
> - TargetRPC: 특정 클라이언트에게만 보낸다. 공격 결과의 강한 피드백(카메라/히트스탑 등)은 소유자에게만 필요하므로, 전체 브로드캐스트(ClientRPC) 대신 타겟 전송으로 트래픽을 줄인다.
{: .important style="--q-border-width: 8px; --q-border-color: #0d6efd; --q-bg: rgba(13,110,253,.08); --q-padding-left: 1.25rem;"}

### 3) 히트박스 컴포넌트/주입/타이밍 윈도우
- `WeaponHitBox`는 무기 오브젝트에 부착
- 장착 시 `SetOwner(ITeamOwner, NetworkObject)`/`SetTemplate(DamageInfo)`/`SetFriendlyFire(false)`로 초기화, 기본 비활성화
- 서버 전용 트리거 판정 경로에서 팀/자기 자신 필터와 스윙 중복 히트 방지(HashSet) 적용
- `MeleeComboAction.UpdateCombo`가 각 스텝의 `ComboTimingStart/End`에 맞춰 `Activate/Deactivate` 호출 → 유효 타격 구간 제어
- 종료/리셋 시점에 `Deactivate` 
- `MeleeWeaponLogic.CreateAction`에서 액션 생성 직후 현재 무기 프리팹의 `WeaponHitBox` 주입
- `WeaponController`는 Equip 시 히트박스 필수 확인 및 초기화만 수행(액션 구동은 FSM 전담)


## 메모
- 서버 권위로 히트 판정/데미지 적용 → `HitResult`만 전송, VFX/SFX/카메라/숫자 표시는 클라 로컬 처리
- `NetworkAnimator`로 콤보 파라미터(Trigger/Integer) 동기화 유지
- 플레이어에 `ITeamOwner`를 추가한 뒤 팀/자기 자신 필터가 정상 동작
- `WeaponController`의 액션 Tick 제거로 상태·타이밍 불일치 위험 해소(FSM 단일 경로)
- 런타임 히트박스 교체 여지를 고려해 `MeleeComboAction.SetHitBox`는 유지(장착/재바인딩 이벤트에서 재주입 가능)

## 다음 단계
- 피격 반응 정책: 경직/히트스턴/넉백 
- VFX/SFX/카메라 연동 + UI
- 원거리 로직/프로젝트일: Muzzle, Ray/Projectile

## 마무리
공격 애니메이션이 재생되어 스윙이 발생하면, 근처의 적에 대한 임시 로그가 정상적으로 출력된다. 서버가 판정을 수행하고 관측자에게만 결과를 전달하는 흐름도 시각화를 통해 명확히 정리했다. 오늘은 전투의 뼈대를 구축했고, 다음작업으로는 UI 연동과 간단한 피드백(카메라, 히트스턴, 넉백)을 적용해 볼 계획이다.


