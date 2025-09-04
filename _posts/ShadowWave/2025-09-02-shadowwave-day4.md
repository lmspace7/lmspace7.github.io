---
title: ShadowWave 개발일지 4일차
description: 적 FSM/AI 구축, 서버 권한 전이, 스포너, 컨텍스트 도입
date: 2025-09-02 12:41:00 +0900
categories: [개발일지, 게임개발]
tags: [Unity, FishNet, 네트워크, 멀티플레이, ShadowWave]
pin: false
---

## 오늘의 작업 내용

- 적 FSM 구축: `Idle / Patrol / Chasing / Dead` 상태 컴포넌트화 및 등록
- `SyncEnum<E_EnemyState>` 적용으로 서버 권한 기반 상태 전이 동기화
- `EnemyController`와 `EnemyContext`로 의존성 표준화, 서버 전용 Tick 구성
- `Spawner`로 서버 주기 스폰 구현(UniTask 사용)
- `PlayerContext`와 `EnemyContext` 도입으로 의존성 표준화


## 구현 배경

- 2일차에 만든 `SyncEnum<TEnum>`을 플레이어에 이어 적 AI에도 적용해 **상태 중심 아키텍처**를 확장.
- 3일차의 FSM/애니메이션 동기화 패턴을 그대로 적에도 재사용해 **일관성**과 **확장성** 확보.
- 서버 권한 모델을 고수해 판단/전이를 서버에서만 수행, 클라이언트는 **관측과 재생산**에 집중.

## 설계/구현 요점

### 1) EnemyFSM + SyncEnum<E_EnemyState>

- 상태 수집을 `GetComponentsInChildren<...>()`로 표준화하고 딕셔너리 등록.
- 서버에서만 `_syncEnemyState.ServerSetValue(next)`로 값 변경. 비서버는 `ServerRpc`로 요청.
- 서버에서만 `Tick/FixedTick` 수행해 AI 판단의 단일 권한 보장.

```csharp
// 상태 전이(서버 권한)
public void SetState(E_EnemyState nextState)
{
    if (IsServerInitialized)
    {
        _stateDict[CurState].ExitState();
        _syncEnemyState.ServerSetValue(nextState);
        _stateDict[nextState].EnterState();
    }
    else
    {
        _stateDict[CurState].ExitState();
        RPC_RequestSetState(nextState);
        _stateDict[nextState].EnterState();
    }
}

[ServerRpc]
private void RPC_RequestSetState(E_EnemyState nextState)
{
    _syncEnemyState.ServerSetValue(nextState);
}
```

#### 플레이어 FSM과 구조 유사점/차이점(서버 전용 실행)

EnemyFSM은 플레이어 FSM과 비슷하게 상태를 컴포넌트로 쪼개서 딕셔너리에 등록했고, 전이는 항상 `Exit → Set → Enter` 순서를 지켰다. 상태 동기화는 `SyncEnum<T>`로 처리했다.

다만 적 FSM은 설계 철학을 다르게 가져가서, 주요 로직을 전부 서버에서 돌아가게했다.

`Tick/FixedTick`, 플레이어 탐지, 순찰/추격 판단 같은 결정은 서버에서만 돌리고, 클라이언트는 동기화된 상태 값과 애니메이션만 받아서 재생한다. AI의 결정권을 서버로 모아두니 예측 불일치나 치트 리스크를 꽤 줄일 수 있었다.

#### 클라이언트 공격에 의한 상태 변경(예상 설계)

앞으로 클라이언트의 공격으로 적 상태가 바뀌어야 할 때는, 클라가 적중을 확정하지 않고 서버에 보고만 하도록 설계를 진행할것 같다.

서버에서 히트박스 교차, 레이캐스트, 지연 보정으로 유효성을 검증한 뒤 데미지를 적용. 체력이 임계치면 EnemyFSM을 `Dead`로 넘기고, 아니라면 상황에 따라 일시 경직(`Hit/Stagger`, 추후 추가)을 쓰거나 `Chasing`을 복귀.

핵심은 상태 변경의 최종 권한은 항상 서버에 있고, 클라는 ‘요청’과 ‘재생’에 집중한다는 점이다.

### 2) EnemyController + EnemyContext / Context 도입(Enemy/Player)


4일차에는 `EnemyContext`와 `PlayerContext`를 새로 도입했다. 그전까지는 FSM이나 상태에서 필요한 컴포넌트를 직접 찾는 방식이었는데, 컨텍스트로 묶어두니 초기화와 검증이 한 번에 끝나고, 상태 쪽에서는 오너와 컨텍스트만 받아서 의존성을 깔끔하게 쓸 수 있었다. 결과적으로 상태 코드가 더 읽기 쉬워졌고, 네트워크 애니메이터나 스탯처럼 공통으로 참조하는 것들의 접근이 일관됐다.

```csharp
// PlayerContext 예시
[System.Serializable]
public class PlayerContext
{
    [field: SerializeField] public CharacterController Controller { get; private set; }
    [field: SerializeField] public NetworkAnimator NetAnim { get; private set; }
    [field: SerializeField] public PlayerFSM FSM { get; private set; }
    [field: SerializeField] public PlayerStats Stat { get; private set; }

    public void OnInit(PlayerController owner)
    {
        ...
    }

    public bool ValidateComponents()
    {
        ...
    } 
}
```

```csharp
public override void EnterState()
{
    if (_context.ValidateComponents() == false)
        return;
}
```


- 컨텍스트에 `Rigidbody / NetworkAnimator / CapsuleCollider / EnemyFSM / EnemyStats / UI_Enemy`를 묶고 `ValidateComponents()`로 필수성 보장.
- `OnStartServer()`에서만 초기화/초기 상태 전이를 수행하고, `Update/FixedUpdate`도 서버에서만 Tick.

```csharp
public override void OnStartServer()
{
    if (_context.ValidateComponents() == false)
    {
        return;
    }

    _isInit = true;
    _context.FSM.OnInit(this, _context);
    _context.FSM.SetState(E_EnemyState.Idle);
}
```

### 3) 상태별 핵심 로직

- Idle: 플레이어 탐지 시 Chasing, 일정 시간 경과 시 Patrol로 전이.
- Patrol: 랜덤 워크 기반 목표점 이동, 탐지 시 Chasing으로 전이.
- Chasing: 탐지 범위 내 추격 이동, 범위 이탈 시 Patrol로 복귀.
- Dead: 후속 구현을 위한 자리만 확보.

### 4) 임시 Spawner - 서버전용 

```csharp
public override void OnStartServer()
{
    SpawnEnemy().Forget();
}

private async UniTask SpawnEnemy()
{
    while (true)
    {
        await UniTask.WaitForSeconds(_spawnInterval);
        var spawnPoint = _spawnPoints[Random.Range(0, _spawnPoints.Length)];
        var enemy = Instantiate(_enemyPrefab, spawnPoint.position, spawnPoint.rotation);
        ServerManager.Spawn(enemy);
    }
}
```

## 테스트 결과

- Host-Client 환경에서 Idle/Patrol/Chasing 전이와 애니메이션 Speed 재생산이 정상 동작.
- 스포너가 서버에서만 작동하며, 새로 스폰된 적도 FSM 초기화와 상태 동기화가 즉시 적용됨.
- 탐지 범위 진입/이탈에 따른 추격/순찰 전이 안정적.


## 트러블슈팅 메모

- 서버 전용 Tick을 강제하지 않으면 클라이언트에서도 AI가 실행돼 **권한 충돌** 발생. `IsServerInitialized` 가드로 해소.
- 추격 종료 시 관성으로 미세 이동이 남아 보여서 Chasing.Exit에서 `Rigidbody` 속도를 **초기화**.
- 애니메이터 Speed를 상태 로직과 분리해 매 프레임 갱신함으로써 전이 구간에서도 **시각적 부자연스러움**을 최소화.

## 다음 단계

- 무기 파이프라인 기반 확장: 근접/원거리 타이밍·히트 훅 설계
- 장착 로직 서버 권한화: 클라 입력 → 서버 검증 → 적용 동기화
- 무기 스탯 정의 및 FSM 연동(공격 속도·리치 등)

