---
title: Git 대규모 충돌을 폴더별로 일괄 정리하기
description: ours/theirs를 폴더 단위로 적용해 2000+ 충돌을 빠르게 정리한 기록
date: 2025-09-04 09:35:00 +0900
categories: [기록, Git]
tags: [Git, Merge, 충돌, ours, theirs, 팁]
pin: false
---

대규모 머지/리베이스에서 충돌이 수천 개 발생했을 때, 폴더별로 ours/theirs를 적용해 일괄 정리했다.

```bash
git checkout --ours Assets/MyCode/
git checkout --theirs Assets/ThirdParty/@Other/ @ShadowWave/
```

 - `--ours`: 현재 브랜치(내 변경) 쪽 버전을 선택
 - `--theirs`: 병합 대상(상대 브랜치) 쪽 버전을 선택


