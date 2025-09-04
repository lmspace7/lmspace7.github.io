---
title: ShadowWave 개발일지 5일차
description: 무기 파이프라인(SO/프리팹/리코더), 장착 로직, 에디터 툴(Odin), 서버 스폰 정리
date: 2025-09-04 17:58:00 +0900
categories: [개발일지, 게임개발]
tags: [Unity, FishNet, 무기, ScriptableObject, OdinInspector, 에디터툴]
pin: false
---

## 오늘의 작업 내용

- 무기 데이터 구조(`SO_Weapon`) 정리 및 프리팹 링크 버튼 구현
- 위치/회전 기록용 `SO_WeaponRecorder` + 씬 도우미 `WeaponRecorder` 제작
- `WeaponPresenter`(네트워크 오브젝트)와 `WeaponController`(플레이어 장착) 구현
- 서버 전용 `WeaponSpawner`로 무기 스폰 파이프라인 구성(FishNet)
- Odin 기반 `WeaponCreatorEditorWindow`로 무기/로직/리코더 에셋 생성 자동화

## 구현 배경

플레이어/적 FSM이 어느 정도 형태를 갖춰서, 오늘은 전투의 기반이 될 **무기 파이프라인**을 만들었다. 데이터(SO) → 프리팹(View) → 기록(리코더) → 장착(컨트롤러) → 스폰(서버)의 흐름을 표준화해 이후 근접/원거리 무기를 확장해도 일관된 작업 경로로 붙일 수 있도록 했다.

## 설계/구현 요점

### 1) SO_Weapon: 데이터 단일화 + 프리팹 링크 버튼

- 아이콘/이름/표시이름/ID, View 프리팹, 애니메이터 오버라이드, 손잡이/기본 소켓, 카테고리(근접/원거리)와 하위 스탯을 한곳에 모았다.
- 프리팹에 `WeaponPresenter`/`WeaponRecorder`가 누락되었거나 다른 SO에 연결되어 있으면, 에디터 버튼으로 즉시 정합성을 맞춘다.

```csharp
// 프리팹 링크 초기화 버튼
[Button("프리팹 링크 연결 초기화", ButtonSizes.Large)]
public void SetLinkPrefab()
{
    if (this.ViewPrefab == null)
    {
        Debug.LogError("프리팹 링크 연결 실패");
        return;
    }

    var presenter = this.ViewPrefab.GetOrAddComponent<WeaponPresenter>();
    var viewRecorder = this.ViewPrefab.GetOrAddComponent<WeaponRecorder>();

    presenter.Weapon = this;
    viewRecorder.Weapon = this;
}
```

### 2) 위치/회전 기록: SO_WeaponRecorder + WeaponRecorder

- 씬에서 소켓(`Socket`)을 기준으로 현재 무기 프리팹의 `localPosition/Rotation`을 기록/적용한다.
- 프리팹 에셋 상태에서는 실행되지 않도록 가드

```csharp
// 씬 인스턴스에서만 허용, 소켓 기준으로 기록/적용
[Button("소켓기준 현재위치 저장", ButtonSizes.Large)]
public void Record()
{
    if (Weapon == null)
    {
        Debug.LogError("Weapon 참조가 없습니다.");
        return;
    }

    var socket = FindAnyObjectByType<Socket>();
    if (socket == null)
    {
        Debug.LogError("씬에서 Socket 객체를 찾지 못했습니다.");
        return;
    }

    Weapon.WeaponRecorder.RecordFrom(transform, socket.transform);
}
```

### 3) WeaponPresenter: 소켓 부착 시 기록값 재현

- 네트워크 오브젝트로서 플레이어나 월드에 배치될 수 있다.
- 장착 시 `SO_WeaponRecorder`에 기록된 위치/회전을 우선 적용하고, 없으면 기본값(0, identity)을 쓴다.

```csharp
public void SetTransform(Transform socket)
{
    if (socket == null)
        return;

    transform.SetParent(socket);
    if (Weapon != null && Weapon.WeaponRecorder != null && Weapon.WeaponRecorder.IsRecorded == true)
    {
        transform.localPosition = Weapon.WeaponRecorder.LocalPosition;
        transform.localRotation = Weapon.WeaponRecorder.LocalRotation;
    }
    else
    {
        transform.localPosition = Vector3.zero;
        transform.localRotation = Quaternion.identity;
    }
}
```

### 4) WeaponController: 근접 탐색 → 장착 → 애니메이터 교체

- 오너에서만 입력을 받아 장착을 시도한다.
- 일정 반경에서 `Weapon` 태그를 가진 무기를 찾아 현재 무기를 해제하고 새 무기를 소켓에 부착한다.
- `AnimatorOverrideController`를 교체해 캐릭터 애니메이션을 무기에 맞게 갱신한다.

```csharp
public void Equip(WeaponPresenter target)
{
    if (target == null || target.Weapon == null || target.Weapon.AnimatorOverride == null)
    {
        Debug.LogError("무기 장착을 수행할수 없습니다.");
        return;
    }

    if (_curWeapon != null)
        _curWeapon.transform.SetParent(null);

    _curWeapon = target;
    _curWeapon.SetTransform(_weaponSocket.transform);
    _context.NetAnim.SetController(target.Weapon.AnimatorOverride);
}
```

### 5) 임시 WeaponSpawner(서버)
```csharp
public override void OnStartServer()
{
    for (int i = 0; i < _spawnWeaponPrefabs.Count; i++)
    {
        var weapon = _spawnWeaponPrefabs[i].gameObject;
        var spawnPoint = _spawnPoints[i];
        GameObject instance = Instantiate(weapon, spawnPoint.position, spawnPoint.rotation);
        ServerManager.Spawn(instance);
    }
}
```

### 6) 에디터 툴: WeaponCreatorEditorWindow

- `SO_Weapon` 생성 시, 같은 이름의 `SO_WeaponLogic`/`SO_WeaponRecorder`를 자동 생성하고 연결한다.
- Odin 메뉴에서 카테고리별로 에셋을 탐색/선택할 수 있게 구성했다.

```csharp
if (SirenixEditorGUI.ToolbarButton(new GUIContent("무기 생성")))
{
    ScriptableObjectCreator.ShowDialog<SO_Weapon>(WEAPON_DIR, obj =>
    {
        obj.Name = obj.name;

        SO_WeaponLogic newLogic = ScriptableObject.CreateInstance<SO_WeaponLogic>();
        SO_WeaponRecorder newRecorder = ScriptableObject.CreateInstance<SO_WeaponRecorder>();
        
        ...

        // 에셋 생성 및 저장 후 연결
        AssetDatabase.CreateAsset(newLogic, logicPath);
        AssetDatabase.CreateAsset(newRecorder, recorderPath);
        obj.OnInit(newLogic, newRecorder);

        ...
    });
}
```

## 파이프라인 요약(에디터 → 런타임)

1. 에디터 창에서 `SO_Weapon` 생성 시 `SO_WeaponLogic`/`SO_WeaponRecorder`를 자동 생성·연결
2. 무기 View 프리팹에 프리팹 링크 버튼으로 `WeaponPresenter`/`WeaponRecorder` 연결
3. 씬에서 `Socket` 기준으로 무기 위치/회전을 기록(Record) → SO에 저장
4. 서버가 `WeaponSpawner`로 무기를 스폰 → 클라가 관측
5. 플레이어(오너)가 근접 무기를 장착 → 소켓 부착 + 애니메이터 오버라이드 교체

## 테스트 결과

- Host-Client 환경에서 서버 스폰된 무기가 정상 관측되었다.
- 기록된 좌표/회전값이 장착 시 정확히 재현되었다.
- 장착 시 애니메이터 오버라이드가 교체되어 무기별 애니메이션이 적용되었다.
- 기즈모로 탐색 반경을 시각화하여 장착 트리거 범위를 빠르게 확인했다.

## 트러블슈팅 메모

- 프리팹 에셋 상태에서 `Record/Apply`를 누르지 못하도록 씬 인스턴스 가드를 추가했다.
- `Socket` 검색에 `FindAnyObjectByType<T>()`를 사용해 에디터 경고를 줄이고 의도를 명시했다.
- 동일 무기를 다시 장착하지 않도록 현재 무기와의 참조 비교를 통해 필터링했다.
- 서버 스폰 시 리스트 길이 불일치로 인한 예외 가능성이 있어, 실제 제작 단계에서는 방어 코드(길이/널 체크)를 추가할 계획이다.

## 다음 단계

- 장착 로직의 **서버 권한화**: 클라 입력 → 서버 검증 → 적용(Observers 동기화)
- `SO_WeaponLogic` 설계 확장(근접/원거리 타이밍, 히트 판정 훅)
- `Melee/Ranged` 스탯 실제 필드 정의 및 FSM 연동(공격 속도/리치 등)
- 드랍/버리기, 슬롯 간 교체, 입력 라우팅 정리(InputSystem)


