# Clipu 개발 노트

## 프로젝트 개요
링크 저장·분류 콘텐츠 아카이빙 앱 (Clip + you = Clipu)
다른 앱에서 링크를 공유받아 저장하고, 목록으로 열람하는 앱

---

## 기술 스택 & 버전

| 항목 | 버전 |
|---|---|
| Expo SDK | 54.0.33 |
| React Native | 0.81.5 |
| React | 19.1.0 |
| TypeScript | 5.9.2 |
| @supabase/supabase-js | 2.105.4 |
| @react-navigation/native | 7.2.4 |
| @react-navigation/native-stack | 7.14.14 |
| @react-native-async-storage/async-storage | 2.2.0 |
| react-native-url-polyfill | 3.0.0 |
| react-native-screens | 4.16.0 |
| react-native-safe-area-context | 5.6.0 |

---

## 인프라

| 항목 | 값 |
|---|---|
| GitHub | https://github.com/jnyoong/clipu |
| Supabase Project URL | https://qzgohbxvpxtsquaygsmh.supabase.co |
| Supabase 키 종류 | Publishable Key (sb_publishable_...) |
| 브랜치 | main |

### Supabase 설정 (완료)
- Authentication > Email > **Confirm email: OFF** (회원가입 즉시 로그인)
- `links` 테이블 생성 완료 (supabase/schema.sql 실행 완료)
- RLS 활성화, 본인 데이터만 조회/삽입/삭제 가능

---

## 파일 구조

```
clipu/
├── App.tsx                  # 진입점. AuthProvider + NavigationContainer + 조건부 스택
├── contexts/
│   └── AuthContext.tsx      # 세션 상태 관리 (session, loading, signOut)
├── lib/
│   ├── supabase.ts          # Supabase 클라이언트 (AsyncStorage 어댑터)
│   └── og.ts               # OG 메타데이터 추출 (title, description, image_url)
├── screens/
│   ├── LoginScreen.tsx      # 이메일/비밀번호 로그인
│   ├── SignupScreen.tsx     # 이메일/비밀번호 회원가입
│   ├── HomeScreen.tsx       # 링크 목록 (카드 UI, 탭=열기, 길게=삭제)
│   └── AddLinkScreen.tsx   # URL 입력 → OG 추출 → Supabase 저장
├── supabase/
│   └── schema.sql          # links 테이블 + RLS 정책 DDL
└── .env                    # Supabase URL + Key (gitignore 처리됨)
```

---

## Supabase 테이블 스키마

```sql
links (
  id          uuid primary key,
  user_id     uuid references auth.users,
  url         text,
  title       text,
  description text,
  image_url   text,
  created_at  timestamptz
)
```

---

## 테스트 환경

| 플랫폼 | 방법 |
|---|---|
| iOS | iPhone 실기기 + Expo Go (App Store 설치) → QR 스캔 |
| Android | Android Studio 에뮬레이터 (Pixel 8, API 35) |

### 서버 실행 방법
```
# VS Code 터미널 → Command Prompt로 전환 후
npm start

# Android 에뮬레이터로 열기 (서버 켠 상태에서)
a 키 입력
```
**주의:** PowerShell에서는 npm 실행 안 됨. 반드시 Command Prompt 사용.

---

## 완료된 개발 현황

### 1단계 — 프로젝트 세팅 ✅
- Expo blank-TypeScript 초기화
- Supabase 클라이언트 연결
- GitHub remote 연결 및 초기 push

### 2단계 — 인증 ✅
- 로그인 화면 (LoginScreen)
- 회원가입 화면 (SignupScreen)
- 세션 자동 유지 (AuthContext + AsyncStorage)
- 로그아웃

### 3단계 — 링크 저장 & 열람 ✅
- URL 입력 → OG 메타데이터 자동 추출 → Supabase 저장
- 홈 화면: 카드 목록 (이미지·제목·도메인·설명)
- 카드 탭 → 브라우저로 열기
- 카드 길게 누르기 → 삭제

### 4단계 — 에뮬레이터 ✅
- Android Studio + Pixel 8 AVD 세팅
- iOS + Android 동시 정상 동작 확인

### 5단계 — 공유 클립 & 협업 ✅
- 공유 클립 생성 (클립 추가 시 공유 토글)
- 초대 링크(`clipu://join/CODE`) 딥링크 참여 흐름
- owner/member 권한 구분, 클립 삭제 / 나가기
- **공유 클립으로 전환 (2026-05-12)**: 기존 일반 클립을 꾹 눌러 공유 클립으로 전환 가능
- **최대 참여 인원 30명 (2026-05-12)**: 기존 8명에서 30명으로 확대
  - `JoinCollectionScreen` 메시지 변경
  - Supabase `join_collection` 함수 수정 필요 → 아래 참고

---

## 다음 개발 순서

### 5단계 — Android 공유 기능 (다음 할 일)
다른 앱(카카오톡, 브라우저 등)에서 링크 공유 시 Clipu로 받기

**주의: 이 단계부터 개발 방식이 바뀜**
- `expo-share-intent` 패키지 설치
- `npx expo prebuild` 실행 → `android/`, `ios/` 폴더 생성
- 이후 Expo Go 대신 **Development Build** 사용
- Android는 에뮬레이터에서 직접 빌드 실행 가능
- iOS는 Apple Developer 계정 필요 ($99/년)

```bash
# 진행 순서 (다음 세션)
npm install expo-share-intent
npx expo prebuild
# 이후 Claude Code에게 share intent 코드 작업 요청
```

### 6단계 — iOS 공유 기능
- Apple Developer 계정 구매 후 진행
- EAS Build로 iOS Development Build 생성
- TestFlight로 iPhone에 설치

### 7단계 — 태그 / 검색 (MVP 이후)
- 링크에 태그 추가
- 태그로 필터링
- 제목·URL 검색

### 8단계 — 앱스토어 출시
- Android: Google Play ($25 일회성)
- iOS: App Store ($99/년 Apple 계정 필요)

---

## Supabase join_collection 함수 (인원 30명 제한)

join_collection RPC 함수의 인원 제한을 30명으로 변경하려면 **Supabase SQL Editor**에서 아래 실행:

```sql
create or replace function public.join_collection(code text)
returns text
language plpgsql
security definer
as $$
declare
  col_id uuid;
  member_count int;
begin
  select id into col_id
    from public.collections
   where invite_code = code and is_shared = true;

  if col_id is null then
    return 'not_found';
  end if;

  select count(*) into member_count
    from public.collection_members
   where collection_id = col_id;

  if member_count >= 30 then
    return 'full';
  end if;

  insert into public.collection_members (collection_id, user_id, role)
    values (col_id, auth.uid(), 'member')
    on conflict do nothing;

  return 'ok';
end;
$$;
```

---

## 알아두면 좋은 것들

- OG 추출은 클라이언트(앱)에서 직접 fetch. React Native는 CORS 없음.
- `.env`는 gitignore 처리됨. Supabase 키는 로컬에만 존재.
- `EXPO_PUBLIC_` 접두사 붙은 변수만 앱에서 접근 가능.
- 공유 기능 prebuild 후에는 `android/`, `ios/` 폴더가 생기고 Expo Go 못 씀.
- PowerShell에서 npm 안 됨 → VS Code 터미널을 Command Prompt로 전환 필요.
