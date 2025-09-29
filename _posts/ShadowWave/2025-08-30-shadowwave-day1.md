---
title: "개발일지 #01 - FishNet 튜토리얼 학습"
description: FishNet 공식문서의 튜토리얼 학습
date: 2025-08-30 23:30:00 +0900
categories: [개발일지, 게임개발]
tags: [Unity, FishNet, 네트워크, 멀티플레이, ShadowWave]
pin: false
---

## 오늘의 작업 내용

FishNet 공식문서의 튜토리얼 학습

## 구현 과정

### 1. 권한, 함수

```csharp
// 서버/클라이언트 시작 여부 확인
if (IsServerStarted)
{
    // 서버 전용 코드 실행
}

if (IsClientStarted)
{
    // 클라이언트 전용 코드 실행
}

// 서버/클라이언트 초기화 여부 확인
if (IsServerInitialized)
{
    // 서버 초기화 이후 로직
}

if (IsClientInitialized)
{
    // 클라이언트 초기화 이후 로직
}
```

```csharp
[Server]
private void RecalculateScores()
{
    // 서버에서만 실행
}

[Client]
private void UpdateHUD()
{
    // 클라이언트에서만 실행
}
```

* `IsOwner`  : 현재 로컬 플레이어가 오브젝트의 소유자인지 확인
* `IsServerStarted` : 서버가 시작되었는지 확인
* `IsClientStarted` : 클라이언트가 시작되었는지 확인
* `IsServerInitialized` : 서버 역할의 오브젝트가 초기화되었는지 확인
* `IsClientInitialized` : 클라이언트 역할의 오브젝트가 초기화되었는지 확인
* `[Server]` / `[Client]` : 각각 서버/클라이언트에서만 실행되도록 제한


* `OnStartServer()` : 서버에서만 호출
* `OnStartClient()` : 클라이언트에서만 호출
* `OnStartNetwork()` : 서버/클라이언트 모두에서 네트워크 오브젝트가 활성화될 때 호출

좀 색다른 경험을 했던 부분은 아예 네트워크 시작 신호에 대해서 OnStartServer / OnStartClient / OnStartNetwork 3가지 함수를 제공한다는 것이었다.

여기에 더해, 개인적으로는 보통 하나의 스폰/초기화 함수에서 실행 환경을 분기하던 익숙한 방식과 달리, 실행 환경에 따라 메서드를 아예 분리하는 접근이 신선했다. `[Server]`, `[Client]`로 명확히 제한할 수 있고, Pro 버전에서는 해당 환경이 아닌 코드는 빌드에서 자동 제외되어 최적화 이점도 있다. 나중에 프로젝트에서도 잘 활용해보고 싶다.

### 2. RPC

```csharp
[ServerRpc]
void CreateCubeServerRpc()
{
    // 클라이언트가 호출하면 서버에서 실행됨
}
```

FishNet은 다양한 RPC 타입을 제공한다:

* \[ServerRpc]: 클라이언트에서 서버로 호출
* \[ClientRpc]: 서버에서 클라이언트로 호출
* \[ObserversRpc]: 해당 오브젝트를 관찰하는 클라이언트들에게 호출

ObserversRpc는 FishNet의 ObservableManager랑 관련이 있는거 아닐까 추측해본다.
다음에 더 심화적으로 학습해봐야겠다.

### 3. 상태 동기화 시스템

`SyncVar<Color>` 기능을 활용해 상태 동기화를 편하게 구현할 수 있도록 기반이 다 마련되어있었다. OnChange 콜백을 통해 상태 변경 시점을 감지하고 추가 로직을 실행할 수 있다.

```csharp
public SyncVar<Color> color = new SyncVar<Color>();

void Awake()
{
    color.OnChange += OnColorChanged;
}

private void OnColorChanged(Color previous, Color next, bool asServer)
{
    GetComponent<MeshRenderer>().material.color = color.Value;
}
```

## 기술적 학습 내용

공식문서의 튜토리얼을 따라하면서 FishNet에서 제공하는 기본적인 네트워크 문법에 대해서 알아봤다.

## 다음 단계

- **플레이어 움직임 동기화**: 기본 이동과 애니메이션을 네트워크로 동기화

