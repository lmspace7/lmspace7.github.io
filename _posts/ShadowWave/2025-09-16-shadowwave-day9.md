---
title: "개발일지 #10 - 원거리 투사체: 서버 스폰/이동/충돌/디스폰"
description: 원거리 투사체 구현(서버 권위 스폰/이동/충돌/데미지)
date: 2025-09-16 22:30:00 +0900
categories: [개발일지, 게임개발]
tags: [Unity, FishNet, 전투, 원거리, Projectile, Network]
pin: false
---

## 오늘의 작업 내용

- 발사 파이프라인 정리: 액션 -> 컨트롤러 RPC -> 서버 스폰
- `ProjectileDamage` 컴포넌트 추가: 직진 이동, SphereCast 충돌, 팀 필터링, 1회 히트 후 디스폰
- `WeaponController.SpawnProjectile()` 함수에서 소유자/팀/템플릿 전달

## 설계/구현

### 1) 액션/로직(클라 입력) -> 서버 스폰
- `RangedShootAction`이 발사 타이밍을 판정하고 머즐 위치/회전으로 `RequestFire()` 함수를 호출
- `WeaponController`가 `ServerRpc`로 서버에 요청, 서버에서 `SpawnProjectile()` 함수를 호출

```csharp
// RangedShootAction.FireOnce()
_context.Weapon.RequestFire(spawnPos, spawnRot);

// WeaponController
[ServerRpc] private void RPC_RequestFire(Vector3 pos, Quaternion rot) => SpawnProjectile(pos, rot);
[Server]    private void SpawnProjectile(...) { ServerManager.Spawn(no); proj.Initialize(owner, team, template); }
```

### 2) 서버 권위 투사체 `ProjectileDamage`
- 직진 이동(Transform 기반), 수명 타이머, SphereCast 충돌
- 충돌 시 `IDamageable.ApplyDamage(DamageInfo)` 호출, 1회 적용 후 디스폰
- 팀/자기 자신 필터링, 넉백/리액션은 템플릿을 사용

### 3) 데이터 용어 재사용
 - 기존 `DamageInfo/HitResult`를 그대로 사용, `Type = Ranged`로 지정

## 테스트
- 호스트/클라 환경에서 발사 -> 충돌 시 서버 로그로 데미지/HP 감소 확인
- 프리팹에 `NetworkObject`와 `ProjectileDamage` 부착 필요

## 마무리
근접에서 정리해 둔 서버 권위 데미지 흐름을 원거리에도 동일하게 확장했다. 


