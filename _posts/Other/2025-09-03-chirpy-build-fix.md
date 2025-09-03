---
title: Chirpy 빌드 오류 해결
description: Jekyll SCSS 변환 에러와 Actions에서 npm 빌드 누락 추적기
date: 2025-09-03 09:42:00 +0900
categories: [기록, 블로그]
tags: [Jekyll, GitHub Actions, Chirpy, Sass, npm]
pin: false
---

예전에 블로그를 시도해보려다가 저장소만 만들고 포스트는 하나도 안 올리고 방치했었다 ㅎㅎ. 오랜만에 다시 켜보니까 빌드가 안 됐다. 이번에는 삽질 기록 남겨둔다.

## 증상

- GitHub Pages로 배포를 시도하면 빌드가 실패하거나 사이트가 안 뜸
- 로컬에서도 `bundle exec jekyll serve` 실행 중 아래와 같은 에러 발생

```
Conversion error: Jekyll::Converters::Scss encountered an error while converting
```

## 처음 시도한 해결들(실패)

1. GitHub Settings → Pages → Build and deployment에서 Source를 GitHub Actions로 변경
2. `bundle lock --add-platform x86_64-linux` 실행(원격 빌드용 플랫폼 추가)

두 가지 다 시도했지만 증상은 그대로였다. 혹시 예전에 설치했던 흔적이나 버전 꼬임인가 싶어서 로컬 루비/젬, 블로그 관련 파일들을 싹 정리 후 재설치를 했는데, 이번에는 로컬에서도 `SCSS` 변환 에러가 계속 났다.

## 원인 가설

- Chirpy 테마는 자바스크립트/스타일 자산을 npm 빌드로 생성한다.
- 원격(GitHub Actions) 빌드 과정에서 npm 의존성 설치 및 빌드 단계가 빠지면, Jekyll이 참조해야 할 전처리 산출물이 비어있어 SCSS 변환 단계에서 오류가 날 수 있다.
- 로컬에서도 기존 산출물/의존성 상태가 애매하게 꼬여 있으면 비슷한 증상이 재현된다.

관련 논의: <https://github.com/cotes2020/jekyll-theme-chirpy/discussions/1809>

## 최종 해결

GitHub Actions 워크플로에서 Jekyll 빌드 전에 npm 설치/빌드 단계를 추가하니 해결됐다. 나는 `.github/workflows/jekyll.yml`의 Ruby 설정 전에 다음 스텝을 넣었다.

```yaml
- name: Install and build (npm)
  run: npm install && npm run build
```

## 왜 이것으로 해결됐나(추측)

- Chirpy는 Rollup 등으로 번들링된 자산을 사용한다. 원격 빌드에서 이 과정을 건너뛰면, 테마가 기대하는 CSS/JS 파일이 생성되지 않아 Jekyll의 SCSS 변환기가 중간에 실패한다.
- `bundle lock --add-platform x86_64-linux`는 GitHub Actions의 리눅스 환경에서 루비 젬 호환성 문제를 줄여주지만, 근본적으로 자산 빌드 누락 문제는 해결하지 못한다.

## 회고

처음엔 루비/젬 문제로만 봤는데, 테마의 프런트엔드 빌드가 빠져 있었다는 게 핵심이었다. 워크플로 한 줄로 해결되니 허탈하지만, 덕분에 GitHub Actions도 처음 만져봤다. 다음엔 테마 문서와 워크플로를 먼저 확인하자!


