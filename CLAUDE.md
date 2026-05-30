# Clipu 프로젝트 가이드

---

## ⚠️ 브랜치 / 버전 구분

| 브랜치 | 버전 | 용도 |
|---|---|---|
| `main` | **v1** | 버그 수정, 기존 기능 안정화, 정식 출시 준비 |
| `v2` | **v2** | 탐색 탭·큐레이터 마켓플레이스 등 신규 기능 개발 |

### 작업 전 필수 확인
```bash
git branch   # 현재 브랜치 확인
```
- **v1 작업** (버그·기능 수정) → `git checkout main` 후 진행
- **v2 작업** (신규 기능) → `git checkout v2` 후 진행

> 현재 이 파일은 **v2 브랜치**입니다.
> v1(main)과 v2는 절대 합치지 않고 별도 관리합니다.

---

## 기본 규칙
- **항상 한국어**로만 응답
- 코드 수정 완료 시 **Android AAB 빌드까지 자동 실행** 후 완료 안내
- **배포 시마다 iOS buildNumber, Android versionCode 반드시 1씩 증가** (빠뜨리면 스토어 업로드 불가)
- iOS 배포 안내는 맥북 직접 빌드 방식으로 안내
- 중요한 결정은 사용자 확인 후 진행

---

## 프로젝트 개요
링크 저장·분류 앱 (Clip + you = Clipu)
- **GitHub:** https://github.com/jnyoong/clipu
- **Supabase:** https://qzgohbxvpxtsquaygsmh.supabase.co
- **어드민:** https://jnyoong.github.io/clipu/admin.html
- **v1 버전:** 1.1.1 (iOS buildNumber 21 / Android versionCode 10)
- **v2 버전:** 2.0.0 (개발 중, 미출시)

---

## 배포 프로세스 (수정 시 항상 이 순서로)

### 1. Android 빌드 (Windows에서 — 코드 수정 후 자동 실행)
```bash
# 1) android/app/build.gradle versionCode 1 증가
# 2) 빌드 실행
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="/c/Users/User/AppData/Local/Android/Sdk"
cd android && ./gradlew bundleRelease -x lint
```
- AAB 파일: `android/app/build/outputs/bundle/release/app-release.aab`
- **배포:** Play Console → 내부 테스트 → 새 버전 만들기 → AAB 업로드 (사용자가 직접)

### 2. iOS 빌드 (맥북에서 — Xcode 직접 빌드 방식)
EAS 클라우드 빌드 한도 소진으로 로컬 Xcode 빌드 방식 사용 중.

**상황별 필요 명령어 (코드 수정 내용에 따라 다름):**

| 상황 | 맥북 터미널 명령 |
|---|---|
| tsx 코드만 수정 | `git pull` 후 바로 Xcode Archive |
| npm 패키지 추가됨 | `git pull` → `cd ios && pod install && cd ..` → Xcode Archive |
| app.json 플러그인 변경 | `git pull` → `npx expo prebuild --platform ios --clean` → `cd ios && pod install && cd ..` → Xcode Archive |
| 맥북 첫 빌드 / 흰화면 발생 | 아래 전체 명령 실행 |

**맥북 첫 빌드 또는 흰화면 시 전체 명령:**
```bash
cd ~/clipu && git pull
# .env 파일 생성 (맥북에 이미 있으면 생략)
printf 'EXPO_PUBLIC_SUPABASE_URL=https://qzgohbxvpxtsquaygsmh.supabase.co\nEXPO_PUBLIC_SUPABASE_KEY=sb_publishable_YNvSkk_TQj9bPE4oqoaD3A_8Bx_5K0c\n' > .env
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
```

그 다음 Xcode에서:
1. `open ios/clipu.xcworkspace`
2. 각 타겟(clipu, ShareExtension) → Signing & Capabilities → Automatically manage signing 체크
3. Team: `junhyeong park (Y9Q88U5QG3)` 선택
4. **`Product` → `Archive`**
5. Organizer → `Distribute App` → `App Store Connect` → `Upload`

**주의사항:**
- `.env` 파일 없으면 흰화면 발생 — 맥북에 한 번만 만들면 이후 유지됨
- `buildNumber` 반드시 증가 (같은 번호 재업로드 불가) — Windows에서 app.json 수정 후 commit

### 3. 버전 업 시 체크리스트
- [ ] `app.json` ios.buildNumber 증가
- [ ] `android/app/build.gradle` versionCode 증가
- [ ] `DEV_NOTES.md` 버전 현황 업데이트

---

## 빌드 주의사항
- `android/` 폴더는 `.gitignore`에 포함됨 — `build.gradle` 수정은 로컬에서만
- `expo-share-intent` 플러그인: app.json plugins에 등록됨 (v1.1.1에서 재활성화)
  `androidIntentFilters: []` 설정으로 Android는 로컬 AndroidManifest.xml 사용
- iOS 흰화면 → `.env` 파일 확인 (Xcode 빌드 시 환경변수 수동 필요)
- Xcode 빌드 중 `Distribution Certificate` 오류 → Xcode Settings → Accounts → Manage Certificates → `Apple Distribution` 새로 생성

---

## 주요 파일
| 파일 | 역할 |
|---|---|
| `App.tsx` | 진입점, 딥링크, ShareHandler, 3탭 네비게이터 (v2) |
| `screens/HomeScreen.tsx` | 링크 목록, 클립 탭, 구독탭(💫), 코멘트 편집 모달 |
| `screens/AddLinkScreen.tsx` | 링크 저장 (큐레이터 코멘트 입력 포함) |
| `screens/ExploreScreen.tsx` | 탐색 탭 — 공개 클립 목록, 카테고리·정렬 (v2) |
| `screens/CollectionDetailScreen.tsx` | 공개 클립 상세 — 링크 잠금, 신고, 큐레이터 이동 (v2) |
| `screens/CuratorProfileScreen.tsx` | 큐레이터 프로필 — 공개 클립 목록 (v2) |
| `screens/MyScreen.tsx` | 마이 탭 — 통계, 알림, 구독 큐레이터·취소 (v2) |
| `screens/PublicConvertModal.tsx` | 전체공개 전환 모달 (v2) |
| `screens/SharePickerScreen.tsx` | 외부 공유 수신 시 클립 선택 화면 |
| `screens/SettingsModal.tsx` | 닉네임 수정, 회원탈퇴 |
| `lib/saveLink.ts` | 링크 저장 공통 함수 (note 파라미터 포함) |
| `lib/pushNotifications.ts` | 푸시 알림 헬퍼 |
| `docs/admin.html` | 어드민 웹 (사용자 관리 + 공개 클립 관리) |
| `docs/join.html` | 공유 클립 초대 중간 페이지 |
| `DEV_NOTES.md` | 전체 개발 현황 상세 기록 |
| `PRODUCT_IDEAS.md` | 차별화 기능 아이디어 |

---

## Supabase 테이블
```
--- v1+v2 공통 ---
links               id, user_id, url, title, description, image_url, collection_id, note, created_at
collections         id, user_id, name, is_shared, invite_code, is_public, description, category, cover_url, created_at
collection_members  id, collection_id, user_id, role('owner'|'member'), created_at
link_reactions      link_id, user_id, created_at  (공유클립 하트)
push_tokens         user_id(PK), token, updated_at
collection_notification_cooldown  collection_id(PK), notified_at

--- v2 전용 ---
collection_likes         collection_id, user_id, created_at  (공개클립 하트)
collection_subscriptions collection_id, user_id, created_at  (공개클립 구독)
user_profiles            user_id(PK), blue_check, total_hearts, bio, avatar_url
reports                  id, reporter_id, collection_id, reason, created_at
```

## Supabase RPC 함수
**v1+v2 공통:**
- `get_collection_by_invite(code)` — 초대코드로 클립 조회
- `join_collection(code)` — 클립 참여 (최대 30명)
- `get_collection_members(coll_id)` — 멤버 목록 (nickname 포함, SECURITY DEFINER)
- `get_collection_push_tokens(coll_id)` — 공유클립 멤버 푸시 토큰 조회
- `delete_my_account()` — 회원탈퇴
- `admin_list_users()` / `admin_delete_user(id)` — 어드민 전용

**v2 전용:**
- `get_public_collections(p_category)` — 공개 클립 목록 (통계 포함)
- `get_curator_subscriber_tokens(p_owner_id)` — 큐레이터 구독자 푸시 토큰
- `admin_list_public_collections()` — 어드민: 공개 클립 전체 조회
- `admin_set_collection_public(id, bool)` — 어드민: 공개 상태 변경

---

## 알려진 이슈 & 해결책
- **딥링크 파싱:** `ExpoLinking.parse('clipu://join/CODE')` → hostname='join', path='CODE'
- **iOS 흰화면:** Xcode 직접 빌드 시 `.env` 파일 없으면 Supabase 키 미포함 → 흰화면
- **공유클립 초대링크:** `https://jnyoong.github.io/clipu/join?code=` 형식 사용
- **ActionSheet + Share.share() 충돌:** onPress에 setTimeout 300ms 딜레이로 해결
- **CollectionDetailScreen 링크 수:** DB fetch limit 20개, 배너의 숨겨진 링크 수는 `collection.link_count` 기준
- **Supabase DB 공유:** v1·v2 동일 DB. 스키마 변경은 반드시 add-only 원칙
- **공개 클립 비가역:** `is_public = true` 후 앱에서 되돌리기 불가 (어드민 숨김만 가능)
