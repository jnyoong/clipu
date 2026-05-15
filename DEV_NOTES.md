# Clipu 개발 노트

## 프로젝트 개요
링크 저장·분류 콘텐츠 아카이빙 앱 (Clip + you = Clipu)
다른 앱에서 링크를 공유받아 저장하고, 클립(폴더)으로 분류해 열람하는 앱

---

## 현재 버전
| 항목 | 값 |
|---|---|
| 앱 버전 | **1.1.1** |
| iOS 빌드 번호 | 14 |
| Android versionCode | 8 |

---

## 기술 스택
| 항목 | 버전 |
|---|---|
| Expo SDK | 54.0.33 |
| React Native | 0.81.5 |
| React | 19.1.0 |
| TypeScript | 5.9.2 |
| @supabase/supabase-js | 2.105.4 |
| @react-navigation/native | 7.2.4 |
| react-native-safe-area-context | 5.6.0 |

---

## 인프라
| 항목 | 값 |
|---|---|
| GitHub | https://github.com/jnyoong/clipu |
| Supabase URL | https://qzgohbxvpxtsquaygsmh.supabase.co |
| Expo 프로젝트 | https://expo.dev/accounts/j.nyoong/projects/clipu |
| 브랜치 | main |

---

## 배포 현황

### iOS
- **배포 방식:** EAS Build (클라우드) → TestFlight → 내부 테스트
- **빌드 명령 (맥북에서):**
  ```bash
  git stash && git pull
  npx eas-cli build --platform ios
  npx eas-cli submit --platform ios
  ```
- **환경변수:** EAS 서버에 등록됨 (`eas env:create`로 등록, 매번 할 필요 없음)
- **Apple 계정:** kahn201130@gmail.com / Team: Y9Q88U5QG3
- **Bundle ID:** com.clipu.app
- **주의:** 빌드 전 반드시 `git stash && git pull` 먼저 할 것 (EAS가 app.json을 자동 수정하므로 충돌 발생함)

### Android
- **배포 방식:** 로컬 Gradle 빌드 → Play Console 내부 테스트
- **빌드 명령 (Windows에서):**
  ```bash
  export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
  export ANDROID_HOME="/c/Users/User/AppData/Local/Android/Sdk"
  cd android && ./gradlew bundleRelease -x lint
  ```
- **AAB 파일:** `android/app/build/outputs/bundle/release/app-release.aab`
- **새 버전 배포 시:** `android/app/build.gradle`의 `versionCode` 1 증가 필요

---

## 어드민 페이지
**URL:** https://jnyoong.github.io/clipu/admin.html

### 기능
- 전체 사용자 목록 (이메일, 기기 종류, 링크수, 최근 로그인, 가입일)
- 사용자 데이터 삭제
- 통계 (총 가입자 / 링크 / 클립 수)

### 어드민 계정 설정 방법
1. Supabase → Authentication → Users → 본인 계정 클릭
2. SQL Editor에서 실행:
```sql
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
WHERE email = '본인이메일@gmail.com';
```

---

## Supabase 스키마

### 테이블
```
links:              id, user_id, url, title, description, image_url, collection_id, created_at
collections:        id, user_id, name, is_shared, invite_code, created_at
collection_members: id, collection_id, user_id, role('owner'|'member'), created_at
```

### RPC 함수 (Supabase에 등록된 것들)
| 함수 | 설명 |
|---|---|
| `get_collection_by_invite(code)` | 초대 코드로 클립 정보 조회 |
| `join_collection(code)` | 초대 코드로 클립 참여 (최대 30명) |
| `get_collection_members(coll_id)` | 클립 멤버 목록 조회 (이메일 포함) |
| `delete_my_account()` | 본인 계정 + 데이터 완전 삭제 |
| `admin_list_users()` | 전체 유저 목록 (어드민 전용) |
| `admin_delete_user(target_user_id)` | 유저 삭제 (어드민 전용) |

---

## 파일 구조

```
clipu/
├── App.tsx                    # 진입점. SafeAreaProvider + ErrorBoundary + AuthProvider
├── contexts/AuthContext.tsx   # 세션 상태 관리
├── lib/
│   ├── supabase.ts            # Supabase 클라이언트
│   ├── og.ts                  # OG 메타데이터 추출
│   └── saveLink.ts            # 링크 저장 공통 함수
├── screens/
│   ├── LoginScreen.tsx        # 로그인
│   ├── SignupScreen.tsx       # 회원가입 (이메일 중복/비밀번호 검증, platform 저장)
│   ├── HomeScreen.tsx         # 링크 목록 + 클립 탭 + 설정 버튼 + 편집 모드
│   ├── SettingsModal.tsx      # 닉네임 수정 + 회원탈퇴
│   ├── AddLinkScreen.tsx      # 링크 저장
│   ├── CollectionsScreen.tsx  # 클립 관리
│   ├── SharePickerScreen.tsx  # Android 공유 인텐트 처리
│   └── JoinCollectionScreen.tsx # 공유 클립 참여
├── docs/
│   ├── admin.html             # 어드민 웹페이지
│   ├── join.html              # 초대 링크 중간 페이지
│   └── privacy.html           # 개인정보처리방침
├── eas.json                   # EAS 빌드 설정
└── app.json                   # Expo 앱 설정 (버전, 번들ID 등)
```

---

## 완료된 기능

### 인증
- 로그인 / 회원가입 (이메일+비밀번호)
- 회원가입 시 검증: 영문+숫자 8자 이상, 비밀번호 확인, 중복 이메일 처리
- 세션 자동 유지 (AsyncStorage)
- 로그아웃 / 회원탈퇴

### 홈 화면
- 링크 카드 목록 (이미지·제목·도메인·설명)
- 클립(저장소) 탭 필터 (전체 / 클립별 / 미분류)
- 탭 길게 누르기 → 초대 링크 공유 / 멤버 보기 / 전환 / 삭제
- **설정 버튼 (👤):** 편집 / 설정 / 로그아웃 메뉴
- **편집 모드:** 링크 체크박스 다중 선택 삭제 + 클립 탭 빨간 − 버튼 삭제
- **공유 멤버 보기:** 멤버 수(X명/30명) + 이메일 목록 모달

### 링크
- URL 입력 → OG 메타데이터 자동 추출 → Supabase 저장
- 클립에 분류 가능
- 카드 길게 누르기 → 삭제

### 공유 클립
- 클립 생성 시 공유 설정 토글
- 일반 클립 → 공유 클립 전환 가능
- 초대 링크 공유: `https://jnyoong.github.io/clipu/join?code=CODE`
- 최대 30명, owner/member 권한 구분

### 설정
- 닉네임 수정 (기본값: 이메일 @ 앞부분)
- 닉네임은 Supabase user_metadata에 저장

---

## v1.1.1 변경사항 (2026-05-15)

### 신규 기능
- **스와이프 삭제:** 링크카드 왼쪽 스와이프 → 삭제 확인 팝업 (개인/공유 모두)
- **하트 반응:** 공유클립 링크카드 꾹 누르면 하트 토글 (약한 햅틱, 멤버 간 공유)
  - Supabase `link_reactions` 테이블 추가 필요 (별도 SQL 실행)
- **Pull-to-Refresh:** 리스트 아래로 당기면 새로고침
- **로고 말풍선:** Clipu 로고 클릭 시 앱 내 커스텀 말풍선 (사용법 안내)
- **iOS Share Extension 재활성화:** app.json plugins에 expo-share-intent 추가
  - `androidIntentFilters: []` 로 Android는 로컬 AndroidManifest.xml 유지
- **커스텀 ActionSheet:** Alert.alert 대신 커스텀 모달 (Android 취소 버튼 문제 해결)
- **Android 링크카드 크기 조절:** Platform 조건부 스타일

### 버그 수정
- 공유클립 팝업 취소 버튼 Android에서 작동 안 하는 문제
- 공유 멤버 0명 표시 버그 (RPC 대신 직접 쿼리로 대체)
- 빈 링크 목록에서 Pull-to-Refresh 안 되는 문제

### 추가된 패키지
- `react-native-gesture-handler` (스와이프)
- `expo-haptics` (햅틱 진동)

---

## 알아두면 좋은 것들

- **iOS 빌드 충돌:** EAS가 app.json을 자동 수정함. 빌드 전 `git stash && git pull` 필수.
- **expo-share-intent 플러그인:** v1.1.1에서 재활성화. 이전 중복 충돌 원인은 extra.eas.build.experimental 중복 정의였음 (현재 제거됨).
- **환경변수:** `.env`는 gitignore. EAS 환경변수는 `eas env:create`로 등록 (1회만).
- **Android 빌드:** 로컬 Gradle로만 빌드. EAS Android 빌드는 키스토어 설정 필요.
- **키스토어:** `android/app/clipu-release.keystore` + `_backup/` 폴더 백업 (절대 분실 금지).
- **어드민 접근:** is_admin 메타데이터 없으면 로그인해도 접근 차단됨.
- **link_reactions RLS:** 공유클립 멤버끼리 하트를 볼 수 있도록 SELECT 정책 설정 필요.
