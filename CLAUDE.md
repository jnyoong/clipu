# Clipu 프로젝트 가이드

## 기본 규칙
- **항상 한국어**로만 응답
- 코드 수정 완료 시 **iOS/Android 동시** 빌드+배포 안내까지 마무리
- 중요한 결정은 사용자 확인 후 진행

---

## 프로젝트 개요
링크 저장·분류 앱 (Clip + you = Clipu)
- **GitHub:** https://github.com/jnyoong/clipu
- **Supabase:** https://qzgohbxvpxtsquaygsmh.supabase.co
- **어드민:** https://jnyoong.github.io/clipu/admin.html
- **현재 버전:** 1.0.1 (iOS 빌드 12 / Android versionCode 6)

---

## 배포 프로세스 (수정 시 항상 이 순서로)

### 1. Android 빌드 (Windows에서 직접)
```bash
# versionCode 1 증가 후 (android/app/build.gradle)
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="/c/Users/User/AppData/Local/Android/Sdk"
cd android && ./gradlew bundleRelease -x lint
```
- AAB 파일: `android/app/build/outputs/bundle/release/app-release.aab`
- **배포:** Play Console → 내부 테스트 → 새 버전 만들기 → AAB 업로드

### 2. iOS 빌드 (맥북에서)
```bash
git stash && git pull
npx eas-cli build --platform ios
```
- **제출: Transporter 앱 사용** (`eas submit` 사용 금지 — TestFlight 단계에서 hang됨)
- expo.dev → Builds → 최신 빌드 → .ipa 다운로드 → Transporter 드래그 → Deliver

### 3. 버전 업 시 체크리스트
- [ ] `app.json` version 및 ios.buildNumber 증가
- [ ] `android/app/build.gradle` versionCode 증가
- [ ] `DEV_NOTES.md` 버전 현황 업데이트

---

## 빌드 주의사항
- iOS 빌드 전 반드시 `git stash && git pull` 먼저 (EAS가 app.json 자동 수정 → 충돌)
- `expo-share-intent` 플러그인은 app.json plugins에서 **제거됨** (iOS ShareExtension 충돌)
  Android intent filter는 로컬 `android/` 폴더에 유지
- EAS 환경변수(Supabase 키)는 서버에 등록됨 — 매번 등록 불필요

---

## 주요 파일
| 파일 | 역할 |
|---|---|
| `App.tsx` | 진입점, 딥링크 처리, SafeAreaProvider |
| `screens/HomeScreen.tsx` | 링크 목록, 클립 탭, 설정 버튼, 편집 모드 |
| `screens/SettingsModal.tsx` | 닉네임 수정, 회원탈퇴 |
| `screens/SignupScreen.tsx` | 회원가입 (검증 포함) |
| `docs/admin.html` | 어드민 웹페이지 |
| `docs/join.html` | 공유 클립 초대 중간 페이지 |
| `DEV_NOTES.md` | 전체 개발 현황 상세 기록 |
| `PRODUCT_IDEAS.md` | 차별화 기능 아이디어 |

---

## Supabase RPC 함수
- `get_collection_by_invite(code)` — 초대코드로 클립 조회
- `join_collection(code)` — 클립 참여 (최대 30명)
- `get_collection_members(coll_id)` — 멤버 목록 (이메일 포함)
- `delete_my_account()` — 회원탈퇴
- `admin_list_users()` / `admin_delete_user(id)` — 어드민 전용

---

## 알려진 이슈 & 해결책
- **딥링크 파싱:** `ExpoLinking.parse('clipu://join/CODE')` → hostname='join', path='CODE'
  path에서 'join/CODE' 패턴 찾으면 안 됨. hostname 체크 필요 (App.tsx 수정 완료)
- **iOS 탭바 미표시:** SafeAreaProvider 없으면 SafeAreaView가 iOS에서 inset 0으로 처리됨
- **공유클립 초대링크:** `clipu://` 직접 링크 대신 `https://jnyoong.github.io/clipu/join?code=` 형식 사용
