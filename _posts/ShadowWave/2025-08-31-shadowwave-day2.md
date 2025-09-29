---
title: "개발일지 #02 - SyncEnum 제네릭 상태 동기화 구현"
description: FishNet 커스텀 제네릭 상태 동기화(SyncEnum) 구현
date: 2025-08-31 12:01:00 +0900
categories: [개발일지, 게임개발]
tags: [Unity, FishNet, 네트워크, 멀티플레이, ShadowWave]
pin: false
---

## 오늘의 작업 내용

원래는 플레이어 움직임 동기화 작업을 진행할 예정이었으나, **상태 기반으로 시스템을 구성하는 것이 더 효율적**일 것 같아서 우선순위를 변경했다.
커스텀 제네릭 상태 동기화 타입 `SyncEnum<TEnum>`을 구현하고 프로젝트에 적용했다. 이후 모든 시스템에서 범용적으로 사용할 수 있는 기반 클래스를 만들었다.

## 구현 배경

- 과거 멀티플레이 프로젝트에서 플레이어/적/스테이지 등 여러 시스템들에 대해서 **각 상태별 클래스**를 만들어 관리했었다.
- Photon Fusion에서는 유사 목적의 상위 수준 유틸이 제공되지만, FishNet은 **로우 레벨 커스터마이징**을 권장한다.
- 동일한 패턴의 상태 동기화를 개별 클래스로 반복 구현하는 대신, **열거형을 제네릭으로 받는 공통 SyncType**으로 정규화했다.

## 설계 요점

- **ICustomSync 상속**: FishNet 커스텀 동기화 타입으로 인식되도록 `SyncBase, ICustomSync`를 기반으로 설계.
- **서버 권한 모델**: 값 변경은 서버에서만 허용. 비서버에서 시도 시 경고 후 중단.
- **직렬화 전략**: 열거형을 `int`로 직렬화(`WriteInt32`/`ReadInt32`).
- **동기화 흐름**:
  - 변경 시 `Dirty()` -> 틱에 `WriteDelta`로 전송
  - 초기 동기화 시 `WriteFull` 전송(변경 이력이 있을 때)
  - 수신 측은 `Read`에서 `canModifyValues`와 `newChangeId`로 적용/이벤트 제어

## 공개 API 요약

- **SyncEnum<TEnum>**: `where TEnum : struct, System.Enum`
  - `TEnum Value` : 현재 값
  - `void ServerSetValue(TEnum next)` : 서버 전용 값 변경(Dirty 포함)
  - `event EnumChanged OnChange` : `(prev, next, asServer)` 콜백

## 사용 예시

```csharp
private readonly SyncEnum<E_PlayerState> _playerState = new();

public override void OnStartServer()
{
    base.OnStartServer();
    _playerState.OnChange += (prev, next, asServer) =>
    {
        // 중요 분기만 간단 처리
    };
}

public void SetPlayerState(E_PlayerState state)
{
    if (IsServerStarted == true)
    {
        _playerState.ServerSetValue(state);
    }
}
```

## 적용 효과

- **재사용성**: 플레이어/적/스테이지 등 다양한 열거형 상태를 **단일 타입**으로 동기화.
- **일관성**: 서버 권한/델타·풀 전송/이벤트 패턴을 표준화.
- **확장성**: 새 열거형이 추가되어도 타입 인자만 바꾸면 즉시 적용 가능.

## 다음 단계

- **플레이어 움직임 동기화**: `SyncEnum<E_PlayerState>`를 활용한 상태 기반 이동/애니메이션 처리
- **적 AI 상태 관리**: `SyncEnum<E_EnemyState>`로 적 행동 패턴 동기화
- **게임 스테이지 로직**: `SyncEnum<E_GamePhase>`를 통한 라운드/페이즈 관리


