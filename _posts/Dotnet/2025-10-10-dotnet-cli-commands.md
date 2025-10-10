---
title: dotnet CLI 명령어 모음
description: User Secrets, 빌드, 실행 등 자주 사용하는 dotnet CLI 명령어 정리
date: 2025-10-10 16:20:00 +0900
categories: [.NET, CLI]
tags: [dotnet, User Secrets, CLI, 명령어]
pin: false
---

## dotnet 명령어 목록

### User Secrets 관련

```bash
# User Secrets 초기화 (프로젝트에 UserSecretsId 추가)
dotnet user-secrets init

# 비밀 정보 설정
dotnet user-secrets set "키:이름" "값"
# 예시:
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost;Database=user_db;Uid=root;Pwd=YOUR_PASSWORD"
dotnet user-secrets set "Jwt:Key" "YOUR_SECRET_KEY"
dotnet user-secrets set "Jwt:Issuer" "DataService"
dotnet user-secrets set "Jwt:Audience" "DataService"

# 저장된 User Secrets 목록 보기
dotnet user-secrets list

# 특정 키의 값 확인
dotnet user-secrets get "키:이름"
# 예시:
dotnet user-secrets get "ConnectionStrings:DefaultConnection"

# 특정 키 삭제
dotnet user-secrets remove "키:이름"
# 예시:
dotnet user-secrets remove "Jwt:Key"

# 모든 User Secrets 삭제
dotnet user-secrets clear
```

---

### 프로젝트 빌드 및 실행

```bash
# 프로젝트 빌드
dotnet build

# 프로젝트 실행
dotnet run

# 복원 (패키지 복원)
dotnet restore
```

---

## User Secrets 파일 직접 확인 (Windows)

```bash
# secrets.json 파일 내용 출력
type %APPDATA%\Microsoft\UserSecrets\{프로젝트ID}\secrets.json

# 이 프로젝트의 경우:
type %APPDATA%\Microsoft\UserSecrets\3792ca4e-1fc1-48b5-9a8c-4d5df59cbebb\secrets.json

# 파일 탐색기로 폴더 열기
explorer %APPDATA%\Microsoft\UserSecrets\3792ca4e-1fc1-48b5-9a8c-4d5df59cbebb
```

---

### 새 프로젝트에서 User Secrets 설정

```bash
# 1. 초기화
dotnet user-secrets init

# 2. 비밀 정보 추가 - 나중에 값 수정시 동일하게 사용하면 덮어쓰기 됨
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "연결문자열"
dotnet user-secrets set "Jwt:Key" "비밀키"

# 3. 확인
dotnet user-secrets list

# 4. 실행
dotnet run
```

### 다른 PC에서 프로젝트 클론 후

```bash
# 1. 저장소 클론
git clone <repository-url>
cd DataService

# 2. User Secrets 설정 (초기화는 이미 .csproj에 있음)
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "해당PC의_연결문자열"
dotnet user-secrets set "Jwt:Key" "JWT키"
dotnet user-secrets set "Jwt:Issuer" "DataService"
dotnet user-secrets set "Jwt:Audience" "DataService"

# 3. 실행
dotnet run
```

---