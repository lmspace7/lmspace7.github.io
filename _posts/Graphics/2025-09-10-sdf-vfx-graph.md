---
title: 눈내리는 효과 구현 - SDF의 원리
description: VFX Graph에서 SDF로 파티클 충돌 처리 원리
date: 2025-09-10 23:00:00 +0900
categories: [Graphics]
tags: [SDF, VFX Graph, Unity, TextMeshPro]
pin: false
---

## 완성된 모습

<img width="447" height="431" alt="Unity VFX Grahp Collision Sample 사진" src="https://github.com/user-attachments/assets/c4d4b6e2-a7ee-4d19-a3d2-5641792e3909" />

## 눈 내리는 효과

프로젝트를 진행하다가 눈이 내리는 효과가 있고, 이게 특정 물체에 부딪히는 효과까지 자연스럽게 나와야 했다.

일단 눈은 작은 입자가 흩날리는 것이었기 때문에 구현 수단으로 제일 먼저 생각했던 것은 ParticleSystem 또는 VisualEffect 두 가지였다.
그런데 바로 걸리는 게 충돌이었다. 파티클이 월드의 물체랑 어떻게 부딪히게 만들 것인지가 고민이었다. 

그러다가 예전에 본 유니티 공식 VFX 튜토리얼에서 파티클 충돌 샘플이 있었던 게 떠올랐다. 바로 설치해서 확인해 봤더니, 내가 원하는 목적과 거의 일치하는 샘플이 있었다!

![image](https://github.com/user-attachments/assets/c4d4b6e2-a7ee-4d19-a3d2-5641792e3909)

색만 하얗게 바꾸고, 충돌체를 내가 원하는 물체로 바꾸면 바로 내가 원하는 효과를 구현할 수 있을 것 같았다.

그래서 VFX에서 충돌 관련 노드들을 살펴보았는데 두 가지가 있었다. Mesh / SDF

<p>
  <img src="https://github.com/user-attachments/assets/0b7d6bb7-2497-4073-84aa-a1ae3fb299a5" alt="Unity VFX Sample Mesh 노드 할당" width="48%">
  <img src="https://github.com/user-attachments/assets/b8d691f0-56d6-4468-9159-cd55934f6e59" alt="Unity VFX Sample SDF 노드 할당" width="48%">
</p>

Mesh는 이미 준비돼 있어서 큰 문제가 없었지만, SDF는 처음 들어본 용어라 먼저 개념부터 정리했다.
자료를 조사해 보니 대부분 TextMeshPro와 관련된 SDF 자료가 주를 이루었다. 처음에는 VFX에서 쓰이는 SDF와 TextMeshPro의 SDF가 용어만 같고 전혀 다른 매커니즘인 줄 알았다. 조금 더 조사해 보니, 둘 다 같은 원리를 사용하며 2D로 표현되느냐 3D로 표현되느냐의 차이만 있을 뿐이었다.

## SDF (Signed Distance Field)

컴퓨터 그래픽스에서 형태를 표현하는 방식은 크게 둘이다.
- 명시적 표현: Vertex/Edge/Polygon으로 표면을 직접 정의한다. - 폴리곤 메시.
- 암시적 표현: 어떤 조건을 만족하는 점들의 집합으로 형태를 정의한다. 예를 들어 원점으로부터 거리가 R인 3차원 점들의 집합은 반지름 R인 구를 암시적으로 정의한다.

SDF는 이 암시적 표현의 정중앙에 있는 기술이다. 공간상의 모든 점 P에 대해, 그 점에서 가장 가까운 표면까지의 최단 거리 값을 저장하고, 여기에 부호를 붙인다. 내부면은 음수, 외부면은 양수. 그래서 내부/외부 판정이 한 번에 된다.

이게 왜 좋냐면, 기존 명시적 표현(삼각형 단위 계산)으로 풀면 비싸고 복잡한 문제들이 SDF에서는 아주 단순한 거리 비교로 바뀐다.

- 예시: 어떤 점 P에서 SDF를 샘플링했더니 −0.2가 나왔다면, 그 점은 표면 안쪽으로 0.2만큼 들어와 있다는 뜻이다. 이 단순한 부호/크기 비교가 GPU 대량 병렬 처리에 너무 잘 맞는다.

## 해석적 SDF vs 이산적 SDF(베이킹)

- 해석적 SDF: 구, 상자, 원기둥 같은 기본 도형은 간결한 수식으로 SDF를 직접 계산할 수 있다. 셰이더에서 즉석 계산이 가능하고, 빠르고 메모리도 거의 안 든다.
- 이산적 SDF: 캐릭터나 복잡한 지형처럼 해석적 수식이 어려운 메시들은 격자(Grid)를 만들고 각 격자점에서의 SDF 값을 미리 계산해 저장한다. 이 과정을 베이킹(Baking)이라고 부른다. 결과물은 3D 텍스처 에셋이고, VFX Graph는 런타임에 이 3D 텍스처를 샘플링한다. 하드웨어 보간으로 자연스럽게 거리 필드가 재구성된다.

결국 한 줄 요약하면: “복잡한 메시가 정의하는 암시적 거리 함수를 샘플링해, GPU가 빠르게 읽을 수 있는 3D 텍스처로 바꾼 것”이 이산적 SDF다. 해상도가 오를수록 정확도는 올라가지만 메모리와 베이킹 시간이 더 든다.

## GPU 파티클 충돌에 SDF가 효율적인 이유

전통적인 게임 물리는 CPU에 맞춰져 있다. 개별 객체끼리의 정밀한 상호작용엔 강하지만, VFX Graph처럼 수십만~수백만 파티클을 초당 처리하는 GPU 워크로드에는 안 맞는다. 핵심 문제는 CPU <-> GPU 왕복 비용이다. 파티클 위치를 매 프레임 CPU로 보내 충돌을 검사하고, 다시 결과를 GPU로 돌려보내는 건 실시간에 맞추기 어렵다.

그래서 답은 “처음부터 끝까지 GPU 안에서 끝내는 것”이다. SDF는 읽기 전용 3D 텍스처라서, 수천 개 스레드가 동시에 빠르게 샘플링할 수 있다. 충돌 판정도 단순하다.

```text
distance = sdfTexture.Sample(particle_position)
```

- distance ≤ 0이면 콜라이더 내부 -> 충돌로 간주
- distance > 0이면 외부 -> 통과

이걸 파티클마다 병렬로 돌리면 끝이다. 삼각형-삼각형 같은 무거운 기하 연산 없이, 텍스처 읽기 + 비교만으로 충돌 처리가 된다.

## 장단점 비교

| 항목 | SDF 기반 충돌 (VFX Graph) | 전통적 Mesh Collider (CPU 물리) |
|---|---|---|
| 성능 (GPU) | 매우 높음. 파티클당 텍스처 1회 읽기로 끝. 대규모 병렬에 이상적. | 낮음. GPU 워크로드에 직접 사용 불가, CPU 왕복 비용 큼. |
| 메모리 | 중간~높음. 3D 텍스처 해상도에 비례. | 낮음~중간. 삼각형 수에 비례. |
| 정확도 | 근사치. 해상도 한계, 얇은 형상 누락/모서리 둥글어짐, 터널링 가능. | 폴리곤 정확도. 메시 기반 정밀 충돌. |
| 설정 비용 | 베이킹 필요. 고해상도는 시간/디스크 비용 큼. | 낮음. 콜라이더에 메시만 할당. |
| 동적 유연성 | 제한적. 정적 지오메트리에 적합. 실시간 생성은 비용 큼. | 높음. 동적/변형 리지드바디에도 적용 쉬움. |

## 언제 무엇을 쓸까

- 정적 지오메트리에 맞는 대량 파티클 충돌: SDF 추천.
- 얇은 형상, 정밀 접촉, 터널링 방지가 중요: 메시/CPU 물리 고려.
- 하이파이 시각 효과지만 성능이 더 중요한 경우: SDF 해상도(메모리)와 결과 정확도 사이 트레이드오프를 잡으면 된다.

## SDF 베이킹 및 적용

유니티에서는 SDF Baking 툴을 제공해서 딸깍만 8번 하면 3D 텍스처 SDF 파일을 얻을 수 있다.
Window -> Visual Effects -> Utilities -> SDF Baking Tool을 통해서 에디터 윈도우를 열 수 있다.

<img width="357" height="426" alt="Unity SDF Bake Tool 사진" src="https://github.com/user-attachments/assets/425210d5-85a0-4acf-94a0-22d8526716c9" />
<br>
<img width="401" height="337" alt="Unity Collision Shape 노드 SDF 할당 사진" src="https://github.com/user-attachments/assets/406a93dd-e6a0-4a05-8d2d-946b07943412" />

내가 만들고자 하는 충돌체의 Mesh를 인스펙터에 할당하고, Bake mesh 버튼과 Save SDF 버튼을 차례대로 누른 다음에 어디에 저장할 것인지 설정해 주면 된다. 그리고 이렇게 생성된 SDF 에셋을 VFX의 노드 부분에다가 할당만 해 주면 된다!

## 마치면서

이번에 눈 충돌 효과를 구현하면서, 메시 콜라이더 대신 SDF를 사용했을 때 GPU 워크로드와 얼마나 잘 맞는지 직접 체감할 수 있었다. 원리는 단순하지만 효과는 확실하다. 필요한 정확도, 메모리, 베이킹 시간을 적절히 저울질한 뒤 상황에 맞게 SDF 해상도만 잘 설정하면 된다.

현재 프로젝트에서는 정적인 Mesh를 대상으로 입자가 부딪히는 효과를 구현해야 했기 때문에, 사전 Baking을 통해 만든 SDF를 사용했다. 참고로, 런타임에서 동적으로 Baking을 처리하는 패키지도 존재한다.
지금 당장은 런타임 Baking이 필요하지 않으므로 굳이 설치해서 사용하지는 않겠지만, 앞으로 필요해질 경우에는 한 번 사용해볼 생각이다.

[https://github.com/Unity-Technologies/com.unity.demoteam.mesh-to-sdf](https://github.com/Unity-Technologies/com.unity.demoteam.mesh-to-sdf)
