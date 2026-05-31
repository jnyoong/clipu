# Clipu 개발 노트

## 프로젝트 개요
링크 저장·분류 콘텐츠 아카이빙 앱 (Clip + you = Clipu)
다른 앱에서 링크를 공유받아 저장하고, 클립(폴더)으로 분류해 열람하는 앱

---

## 브랜치 / 버전 관리 원칙

| 브랜치 | 목적 | 병합 방침 |
|---|---|---|
| `main` | v1 — 버그 수정·안정화·정식 출시 | v2와 절대 병합 안 함 |
| `v2` | v2 — 탐색 탭·큐레이터 마켓플레이스 신규 기능 개발 | v2 자체 배포 예정 |

> **절대 규칙:** v1(main)과 v2는 공유하는 Supabase DB를 사용하므로, 스키마 변경은 **추가(add-only)** 원칙으로 진행. 기존 테이블 컬럼 수정/삭제 금지.

### 작업 전 항상 확인
```bash
git branch   # 현재 브랜치 확인
git checkout main   # v1 작업 시
git checkout v2     # v2 작업 시
```

---

## 현재 버전

| | v1 (main) | v2 (v2 브랜치) |
|---|---|---|
| 앱 버전 | **1.1.1** | **2.0.0** (미출시) |
| iOS buildNumber | 21 | 21 (v2 별도 빌드 시 증가 필요) |
| Android versionCode | 10 (로컬 build.gradle 기준) | — |
| 스토어 상태 | 내부 테스트 배포 중 | 미배포 |

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
| @react-navigation/bottom-tabs | (탭 네비게이션, v2에서 추가) |
| react-native-safe-area-context | 5.6.0 |

---

## 인프라
| 항목 | 값 |
|---|---|
| GitHub | https://github.com/jnyoong/clipu |
| Supabase URL | https://qzgohbxvpxtsquaygsmh.supabase.co |
| Expo 프로젝트 | https://expo.dev/accounts/j.nyoong/projects/clipu |
| 어드민 | https://jnyoong.github.io/clipu/admin.html |

---

## 배포 프로세스

### Android 빌드 (Windows에서)
```bash
# 1) android/app/build.gradle versionCode 1 증가
# 2) 빌드 실행
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="/c/Users/User/AppData/Local/Android/Sdk"
cd android && ./gradlew bundleRelease -x lint
```
- AAB 파일: `android/app/build/outputs/bundle/release/app-release.aab`
- 배포: Play Console → 내부 테스트 → 새 버전 → AAB 업로드

### iOS 빌드 (맥북에서 — Xcode 직접 빌드)
EAS 클라우드 빌드 한도 소진으로 로컬 Xcode 빌드 방식 사용 중.

| 상황 | 맥북 명령 |
|---|---|
| tsx 코드만 수정 | `git pull` → Xcode Archive |
| npm 패키지 추가 | `git pull` → `cd ios && pod install && cd ..` → Archive |
| app.json 플러그인 변경 | `git pull` → `npx expo prebuild --platform ios --clean` → `pod install` → Archive |
| 첫 빌드 / 흰화면 | 아래 전체 명령 |

```bash
cd ~/clipu && git pull
printf 'EXPO_PUBLIC_SUPABASE_URL=https://qzgohbxvpxtsquaygsmh.supabase.co\nEXPO_PUBLIC_SUPABASE_KEY=sb_publishable_YNvSkk_TQj9bPE4oqoaD3A_8Bx_5K0c\n' > .env
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
```
Xcode: `open ios/clipu.xcworkspace` → 각 타겟 Signing 설정 → Product → Archive → Upload

### 버전 업 체크리스트
- [ ] `app.json` ios.buildNumber 증가
- [ ] `android/app/build.gradle` versionCode 증가
- [ ] `DEV_NOTES.md` 버전 현황 업데이트

---

## Supabase 스키마

### 테이블 전체 목록

#### v1에서 존재하던 테이블
```
links               id, user_id, url, title, description, image_url, collection_id, created_at
                    + note text (v2에서 추가)
collections         id, user_id, name, is_shared, invite_code, created_at
                    + is_public bool (v2에서 추가)
                    + description text (v2에서 추가)
                    + category text (v2에서 추가)
                    + cover_url text (v2에서 추가)
collection_members  id, collection_id, user_id, role('owner'|'member'), created_at
link_reactions      link_id, user_id, created_at  (공유클립 하트)
push_tokens         user_id (PK), token, updated_at
collection_notification_cooldown  collection_id (PK), notified_at
```

#### v2에서 추가된 테이블
```
collection_likes         collection_id, user_id, created_at  (공개클립 하트)
collection_subscriptions collection_id, user_id, created_at  (공개클립 구독)
user_profiles            user_id (PK), blue_check bool, total_hearts int, bio text, avatar_url text
reports                  id, reporter_id, collection_id, reason, created_at  (신고)
```

### RPC 함수 전체 목록

| 함수 | 브랜치 | 설명 |
|---|---|---|
| `get_collection_by_invite(code)` | v1+v2 | 초대코드로 클립 조회 |
| `join_collection(code)` | v1+v2 | 초대코드로 클립 참여 (최대 30명) |
| `get_collection_members(coll_id)` | v1+v2 | 멤버 목록 (닉네임 포함, SECURITY DEFINER) |
| `get_collection_push_tokens(coll_id)` | v1+v2 | 공유클립 멤버 푸시 토큰 조회 |
| `delete_my_account()` | v1+v2 | 본인 계정+데이터 완전 삭제 |
| `admin_list_users()` | v1+v2 | 전체 유저 목록 (어드민 전용) |
| `admin_delete_user(target_id)` | v1+v2 | 유저 삭제 (어드민 전용) |
| `get_public_collections(p_category)` | v2 | 공개 클립 목록 (카테고리 필터, 통계 포함) |
| `get_curator_subscriber_tokens(p_owner_id)` | v2 | 큐레이터 구독자 푸시 토큰 조회 |
| `admin_list_public_collections()` | v2 | 어드민: 공개 클립 전체 조회 |
| `admin_set_collection_public(id, bool)` | v2 | 어드민: 공개 상태 변경 |

### RLS 정책 핵심 사항
- `links`: 본인 링크 + 공개 클립 링크 + 내가 속한 공유클립 링크 읽기 허용
- `collection_likes`: 본인 insert/delete만 허용, 조회는 모두 가능
- `collection_subscriptions`: 본인 insert/delete만 허용
- `user_profiles`: 본인 전체, 타인은 읽기만 허용
- `reports`: 본인 insert, 어드민만 읽기

### Trigger
- `on_auth_user_created` — 신규 가입 시 `user_profiles` row 자동 생성
- `auto_blue_check` — `collection_likes` insert/delete 시 큐레이터 총 하트 수 갱신 + 100개 이상이면 `blue_check = true` 자동 부여

---

## 파일 구조

```
clipu/
├── App.tsx                         # 진입점, 딥링크, ShareHandler, 탭 네비게이터(v2)
├── contexts/AuthContext.tsx         # 세션 상태 관리
├── lib/
│   ├── supabase.ts                  # Supabase 클라이언트
│   ├── og.ts                        # OG 메타데이터 추출
│   ├── saveLink.ts                  # 링크 저장 공통 함수 (note 파라미터 포함)
│   └── pushNotifications.ts         # 푸시 알림 헬퍼 (공유클립·공개클립 알림)
├── screens/
│   ├── LoginScreen.tsx              # 로그인
│   ├── SignupScreen.tsx             # 회원가입 (이메일 중복/비밀번호 검증)
│   ├── HomeScreen.tsx               # 링크 목록, 클립 탭, 구독탭(💫), 코멘트 편집
│   ├── AddLinkScreen.tsx            # 링크 저장 (큐레이터 코멘트 입력 포함)
│   ├── CollectionsScreen.tsx        # 클립 관리
│   ├── SharePickerScreen.tsx        # 외부 공유 수신 시 클립 선택
│   ├── JoinCollectionScreen.tsx     # 공유 클립 참여
│   ├── SettingsModal.tsx            # 닉네임 수정, 회원탈퇴
│   ├── PublicConvertModal.tsx       # 클립 전체공개 전환 모달 (v2)
│   ├── ExploreScreen.tsx            # 탐색 탭 — 공개 클립 목록, 정렬/필터 (v2)
│   ├── CollectionDetailScreen.tsx   # 공개 클립 상세 — 링크 잠금, 신고, 큐레이터 이동 (v2)
│   ├── CuratorProfileScreen.tsx     # 큐레이터 프로필 — 공개 클립 전체 목록 (v2)
│   └── MyScreen.tsx                 # 마이 탭 — 프로필, 공개 클립 통계, 구독 큐레이터 (v2)
├── docs/
│   ├── admin.html                   # 어드민 웹 (사용자 관리 + 공개 클립 관리 탭)
│   ├── join.html                    # 공유 클립 초대 중간 페이지
│   └── privacy.html                 # 개인정보처리방침
├── CLAUDE.md                        # Claude Code 작업 지침
├── DEV_NOTES.md                     # 이 파일 — 전체 개발 현황
└── PRODUCT_IDEAS.md                 # 차별화 기능 아이디어
```

---

## 네비게이션 구조 (v2)

```
MainTabs (BottomTabNavigator)
├── 홈 탭 (HomeStack)
│   ├── Home          HomeScreen
│   ├── AddLink       AddLinkScreen
│   └── Collections   CollectionsScreen
├── 탐색 탭 (ExploreStack)
│   ├── Explore           ExploreScreen
│   ├── CollectionDetail  CollectionDetailScreen
│   └── CuratorProfile    CuratorProfileScreen
└── 마이 탭
    └── MyScreen
```

---

## 완료된 기능

### v1 기능 (main 브랜치)
- 로그인 / 회원가입 (이메일+비밀번호, 검증 포함)
- 세션 자동 유지, 로그아웃, 회원탈퇴
- 링크 저장 (URL → OG 메타데이터 자동 추출 → Supabase 저장)
- 클립(폴더) 생성 / 이름 변경 / 삭제
- 클립 탭 필터 (전체 / 클립별 / 미분류)
- 스와이프 삭제, 편집 모드(다중 선택 삭제)
- 공유 클립 (최대 30명, 초대 링크)
- 클립 길게 누르기 ActionSheet
- 하트 반응 (공유클립 링크)
- 말풍선 툴팁 (앱 사용법)
- 닉네임 수정
- iOS Share Extension + Android 공유 인텐트 수신
- 푸시 알림 (공유클립 새 링크 추가 시, 3시간 쿨다운)
- 어드민 페이지 (사용자 관리)

### v2 추가 기능 (v2 브랜치)
- **3탭 구조:** 홈 / 탐색 / 마이
- **전체공개 클립:** 클립을 공개로 전환 (카테고리 + 소개글 + 링크 10개 이상 필수, 비가역)
- **탐색 탭:** 공개 클립 카드 목록, 카테고리 필터, 인기·구독·링크순 정렬
- **구독 탭(💫):** 홈에서 구독한 큐레이터 클립 링크 별도 탭으로 표시
- **클립 상세:** 링크 3개 미리보기 잠금(비구독자), 구독 버튼, 신고 기능
- **큐레이터 코멘트:** 링크 저장/편집 시 코멘트(note) 입력, 카드에 💬 표시
- **큐레이터 프로필:** @닉네임 탭 → 해당 큐레이터의 공개 클립 전체 목록
- **블루체크:** 총 하트 100개 이상 시 자동 부여 (Supabase trigger)
- **마이 탭:** 공개 클립 통계, 최근 알림(하트·구독), 구독 중인 큐레이터 목록 + 구독 취소
- **신규 공개 클립 알림:** 큐레이터가 클립을 전체공개하면 기존 구독자에게 푸시 알림
- **어드민 공개 클립 관리:** admin.html에 공개 클립 탭 추가 (숨김 처리 가능)

---

## 알려진 제약사항

| 항목 | 내용 |
|---|---|
| CollectionDetailScreen 링크 표시 | DB에서 최대 20개만 fetch. 실제 링크 수는 `collection.link_count`로 표시 |
| CuratorProfileScreen 데이터 조회 | `get_public_collections(null)` 전체 조회 후 클라이언트 필터링 — 클립이 많아지면 느려질 수 있음 |
| CuratorProfile 진입 경로 | 탐색탭(ExploreStack) 내에서만 접근 가능. MyScreen 구독 목록에서는 미지원 |
| 구독 클립 링크 코멘트 편집 | 타인 링크이므로 onLongPress 비활성화 (의도된 제약) |
| v2 배포 시 기존 v1 사용자 | 같은 Supabase DB 공유. v2 신규 컬럼/테이블은 v1 앱에서 무시됨 (호환 OK) |

---

## 버그 수정 이력 (v2)

| 날짜 | 내용 |
|---|---|
| 2026-05-31 | 자기 클립 구독 시 탭 2개 + 갯수 2배 버그 — `filteredSubIds` 필터링 추가 |
| 2026-05-31 | CollectionDetailScreen `get_public_collections` RPC 파라미터 누락 — `{ p_category: null }` 추가 |
| 2026-05-31 | hiddenCount 계산 오류 — `links.length`(max 20) 대신 `collection.link_count` 기준으로 수정 |
| 2026-05-31 | CollectionDetailScreen links fetch 에러 시 빈 배열 초기화 추가 |
| 2026-05-31 | HomeScreen 코멘트 저장 실패 시 Alert 피드백 없던 문제 수정 |
| 2026-05-31 | MyScreen 구독 취소 실패 시 state rollback 없던 문제 수정 |
| 2026-05-31 | ExploreScreen 카드에 구독자 수 미표시 — 정렬 기준과 불일치 수정 |

---

## 큐레이션 시드 데이터 (2026-06-01)

탐색 탭 초기 콘텐츠 확보를 위한 큐레이션 클립 시드 데이터 생성.

| 항목 | 내용 |
|---|---|
| 파일 위치 | `docs/seed_curations_FULL.sql` |
| 실행 방법 | Supabase 대시보드 → SQL Editor → 붙여넣기 → Run |
| 큐레이터 계정 | `editor@clipu.app` / `ClipuEditor2025!` (블루체크 자동 설정) |
| 컬렉션 수 | 50개 (카테고리별 5개 × 10개 카테고리) |
| 링크 수 | 480개 (모두 실제 웹 검색으로 수집한 URL) |
| 카테고리 | 맛집·마케팅·디자인·IT/개발·교육·여행·투자/금융·라이프·패션·기타 |

> 실행 전 `seed_curations_README.md` 참고.

---

## v2 미구현 항목 (Phase 2 예정)

- MyScreen 구독 큐레이터 목록에서 프로필 페이지 이동
- 탐색탭 검색 기능 (큐레이터명·클립명 키워드)
- 알림 집계 표시 ("오늘 ♥ 12개, 구독 3명 추가")
- 큐레이터 커버 이미지 업로드 (Supabase Storage + expo-image-picker)
- 신고 집계 어드민 알림
- 블루체크 조건 세분화 (현재: 하트 100개 단일 기준)

---

## 어드민 페이지
**URL:** https://jnyoong.github.io/clipu/admin.html

### 탭 구성
- **사용자 관리:** 전체 유저 목록, 이메일/링크수/가입일/삭제
- **공개 클립 관리 (v2 추가):** 공개 클립 목록, 숨김 처리

### 어드민 계정 설정
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
WHERE email = '본인이메일@gmail.com';
```

---

## 알아두면 좋은 것들

- **iOS 흰화면:** Xcode 직접 빌드 시 `.env` 없으면 Supabase 키 미포함 → 흰화면. 맥북에 `.env` 한 번만 생성하면 이후 유지됨
- **android/ gitignore:** `build.gradle` 수정은 로컬에서만. GitHub에 반영 안 됨
- **키스토어:** `android/app/clipu-release.keystore` + `_backup/` 절대 분실 금지
- **딥링크 파싱:** `ExpoLinking.parse('clipu://join/CODE')` → hostname='join', path='CODE'
- **ActionSheet + Share.share() 충돌:** onPress에 setTimeout 300ms 딜레이로 해결
- **Supabase DB 공유:** v1·v2가 같은 DB 사용. 스키마 변경은 항상 추가 원칙 (기존 컬럼 삭제 금지)
- **블루체크:** Supabase trigger로 자동 부여. 어드민이 수동으로 줄 필요 없음
- **공개 클립 비가역성:** `is_public = true` 로 바꾸면 앱에서 되돌릴 수 없음 (어드민은 `admin_set_collection_public`으로 숨김 가능)
