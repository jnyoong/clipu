# Clipu 개발 노트

## 프로젝트 개요
링크 저장·분류 콘텐츠 아카이빙 앱 (Clip + you = Clipu)
다른 앱에서 링크를 공유받아 저장하고, 클립(폴더)으로 분류해 열람하는 앱

---

## 현재 버전
| 항목 | 값 |
|---|---|
| 앱 버전 | **1.1.1** |
| iOS 빌드 번호 | 17 |
| Android versionCode | 10 |

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

## iOS Share Extension — 공유창 내 클립 선택 구현 (맥북에서 진행)

> 외부앱 공유 → Clipu 앱이 열리지 않고 공유 시트 안에서 바로 클립 선택 → 저장 → 원래 앱 유지

### 전제 조건
- `expo-secure-store` 설치 완료 ✓ (세션 토큰 Keychain에 자동 저장 중)
- 맥북에서 아래 순서 진행

### Step 1: 최신 코드로 prebuild

```bash
cd ~/clipu && git pull
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
```

### Step 2: Xcode에서 App Group + Keychain 공유 설정

`open ios/clipu.xcworkspace` 후:

1. **clipu 타겟** → Signing & Capabilities → + 버튼
   - **App Groups** 추가 → `group.com.clipu.app`
   - **Keychain Sharing** 추가 → `com.clipu.app`

2. **ShareExtension 타겟** → 동일하게 적용
   - App Groups: `group.com.clipu.app`
   - Keychain Sharing: `com.clipu.app`

### Step 3: 새 Share Extension 타겟 생성 (기존 ShareExtension 교체)

> File → New → Target → Share Extension → 이름: `ClipuShare`

Package: `com.clipu.app.ClipuShare`

### Step 4: ClipuShareViewController.swift 교체

`ios/ClipuShare/ShareViewController.swift` 내용을 아래로 교체:

```swift
import UIKit
import Social

class ShareViewController: UIViewController {

  private let supabaseUrl = "https://qzgohbxvpxtsquaygsmh.supabase.co"
  private let anonKey = "sb_publishable_YNvSkk_TQj9bPE4oqoaD3A_8Bx_5K0c"

  private var sharedUrl: String = ""
  private var collections: [[String: String]] = []
  private var accessToken: String = ""
  private var userId: String = ""

  private let tableView = UITableView()
  private let titleLabel = UILabel()
  private let urlLabel = UILabel()
  private let indicator = UIActivityIndicatorView(style: .medium)

  override func viewDidLoad() {
    super.viewDidLoad()
    setupUI()
    loadCredentials()
  }

  private func loadCredentials() {
    // Keychain에서 토큰 읽기
    accessToken = readFromKeychain(key: "clipu_access_token") ?? ""
    userId = readFromKeychain(key: "clipu_user_id") ?? ""

    guard !accessToken.isEmpty else {
      showError("Clipu 앱에 먼저 로그인해주세요")
      return
    }

    // 공유 URL 추출
    extractSharedUrl { [weak self] url in
      guard let self = self, let url = url else { return }
      self.sharedUrl = url
      DispatchQueue.main.async {
        self.urlLabel.text = url
        self.indicator.startAnimating()
      }
      self.fetchCollections()
    }
  }

  private func fetchCollections() {
    guard let url = URL(string: "\(supabaseUrl)/rest/v1/rpc/get_user_collections") else { return }
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(anonKey, forHTTPHeaderField: "apikey")
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    request.httpBody = "{}".data(using: .utf8)

    // 직접 collection_members 조회로 대체
    let cmUrl = URL(string: "\(supabaseUrl)/rest/v1/collection_members?select=role,collections(id,name,is_shared)&order=collections(created_at)")!
    var cmReq = URLRequest(url: cmUrl)
    cmReq.setValue(anonKey, forHTTPHeaderField: "apikey")
    cmReq.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

    URLSession.shared.dataTask(with: cmReq) { [weak self] data, _, _ in
      guard let self = self, let data = data,
            let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
        DispatchQueue.main.async { self?.showError("클립 목록을 불러오지 못했어요") }
        return
      }
      self.collections = arr.compactMap { item -> [String: String]? in
        guard let col = item["collections"] as? [String: Any],
              let id = col["id"] as? String,
              let name = col["name"] as? String else { return nil }
        let isShared = col["is_shared"] as? Bool ?? false
        return ["id": id, "name": (isShared ? "🔗 " : "") + name]
      }
      DispatchQueue.main.async {
        self.indicator.stopAnimating()
        self.tableView.reloadData()
      }
    }.resume()
  }

  private func saveLink(collectionId: String) {
    indicator.startAnimating()
    let endpoint = URL(string: "\(supabaseUrl)/rest/v1/links")!
    var req = URLRequest(url: endpoint)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue(anonKey, forHTTPHeaderField: "apikey")
    req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    req.setValue("return=minimal", forHTTPHeaderField: "Prefer")

    let body: [String: Any] = [
      "user_id": userId,
      "url": sharedUrl,
      "collection_id": collectionId
    ]
    req.httpBody = try? JSONSerialization.data(withJSONObject: body)

    URLSession.shared.dataTask(with: req) { [weak self] _, resp, _ in
      let ok = (resp as? HTTPURLResponse)?.statusCode == 201
      DispatchQueue.main.async {
        self?.indicator.stopAnimating()
        if ok {
          self?.extensionContext?.completeRequest(returningItems: nil)
        } else {
          self?.showError("저장 실패. 다시 시도해주세요.")
        }
      }
    }.resume()
  }

  private func extractSharedUrl(completion: @escaping (String?) -> Void) {
    guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
          let provider = item.attachments?.first else {
      completion(nil); return
    }
    if provider.hasItemConformingToTypeIdentifier("public.url") {
      provider.loadItem(forTypeIdentifier: "public.url") { data, _ in
        completion((data as? URL)?.absoluteString ?? data as? String)
      }
    } else if provider.hasItemConformingToTypeIdentifier("public.plain-text") {
      provider.loadItem(forTypeIdentifier: "public.plain-text") { data, _ in
        completion(data as? String)
      }
    } else {
      completion(nil)
    }
  }

  private func readFromKeychain(key: String) -> String? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "expo-secure-store",
      kSecAttrAccount as String: key,
      kSecAttrAccessGroup as String: "com.clipu.app",
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne
    ]
    var result: AnyObject?
    SecItemCopyMatching(query as CFDictionary, &result)
    guard let data = result as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  private func setupUI() {
    view.backgroundColor = .systemBackground

    titleLabel.text = "어디에 저장할까요?"
    titleLabel.font = .boldSystemFont(ofSize: 17)
    titleLabel.translatesAutoresizingMaskIntoConstraints = false

    urlLabel.font = .systemFont(ofSize: 12)
    urlLabel.textColor = .secondaryLabel
    urlLabel.numberOfLines = 1
    urlLabel.translatesAutoresizingMaskIntoConstraints = false

    indicator.translatesAutoresizingMaskIntoConstraints = false

    tableView.dataSource = self
    tableView.delegate = self
    tableView.translatesAutoresizingMaskIntoConstraints = false
    tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")

    let cancelBtn = UIButton(type: .system)
    cancelBtn.setTitle("취소", for: .normal)
    cancelBtn.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
    cancelBtn.translatesAutoresizingMaskIntoConstraints = false

    view.addSubview(titleLabel)
    view.addSubview(urlLabel)
    view.addSubview(indicator)
    view.addSubview(tableView)
    view.addSubview(cancelBtn)

    NSLayoutConstraint.activate([
      titleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
      titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
      urlLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 6),
      urlLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
      urlLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
      indicator.topAnchor.constraint(equalTo: urlLabel.bottomAnchor, constant: 12),
      indicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      tableView.topAnchor.constraint(equalTo: urlLabel.bottomAnchor, constant: 8),
      tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      tableView.bottomAnchor.constraint(equalTo: cancelBtn.topAnchor, constant: -8),
      cancelBtn.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
      cancelBtn.centerXAnchor.constraint(equalTo: view.centerXAnchor),
    ])
  }

  private func showError(_ msg: String) {
    let alert = UIAlertController(title: "오류", message: msg, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "확인", style: .default) { [weak self] _ in
      self?.extensionContext?.cancelRequest(withError: NSError(domain: "ClipuShare", code: 0))
    })
    present(alert, animated: true)
  }

  @objc private func cancelTapped() {
    extensionContext?.cancelRequest(withError: NSError(domain: "ClipuShare", code: 1))
  }
}

extension ShareViewController: UITableViewDataSource, UITableViewDelegate {
  func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
    collections.count
  }
  func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
    cell.textLabel?.text = collections[indexPath.row]["name"]
    return cell
  }
  func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    guard let id = collections[indexPath.row]["id"] else { return }
    saveLink(collectionId: id)
  }
}
```

### Step 5: ClipuShare/Info.plist 설정

Info.plist에 아래 항목 추가 (NSExtension 딕셔너리 내):
```xml
<key>NSExtensionActivationRule</key>
<dict>
  <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
  <integer>1</integer>
  <key>NSExtensionActivationSupportsWebPageWithMaxCount</key>
  <integer>1</integer>
</dict>
```

### Step 6: 기존 expo-share-intent ShareExtension 비활성화 (선택)

Xcode → Schemes → clipu → Build → ShareExtension 체크 해제하거나,
Info.plist에서 `NSExtensionActivationRule`을 빈 딕셔너리로 변경해 공유 대상에서 제외.

### Step 7: 빌드 & 테스트

buildNumber 증가 → Product → Archive → Upload

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
| `get_collection_members(coll_id)` | 클립 멤버 목록 조회 (닉네임 포함, SECURITY DEFINER) |
| `get_collection_push_tokens(coll_id)` | 공유클립 멤버 푸시 토큰 조회 — **미등록, 아래 SQL 실행 필요** |
| `delete_my_account()` | 본인 계정 + 데이터 완전 삭제 |
| `admin_list_users()` | 전체 유저 목록 (어드민 전용) |
| `admin_delete_user(target_user_id)` | 유저 삭제 (어드민 전용) |

---

## 푸시 알림 설정 (다음 세션 — Firebase 준비 완료 후)

### 1단계: Supabase SQL 실행 (지금 바로 가능)
Supabase → SQL Editor 에서 아래 실행:

```sql
-- 푸시 토큰 저장 테이블
CREATE TABLE IF NOT EXISTS push_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own token" ON push_tokens FOR ALL USING (auth.uid() = user_id);

-- 공유클립 멤버 토큰 조회 (내 토큰 제외, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_collection_push_tokens(coll_id uuid)
RETURNS TABLE(token text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT pt.token
  FROM collection_members cm
  JOIN push_tokens pt ON pt.user_id = cm.user_id
  WHERE cm.collection_id = coll_id AND cm.user_id != auth.uid();
$$;

-- get_collection_members 0명 버그 해결용 (기존 함수 재생성)
CREATE OR REPLACE FUNCTION get_collection_members(coll_id uuid)
RETURNS TABLE(user_id uuid, role text, nickname text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT cm.user_id, cm.role,
         (auth.users.raw_user_meta_data->>'nickname') AS nickname
  FROM collection_members cm
  JOIN auth.users ON auth.users.id = cm.user_id
  WHERE cm.collection_id = coll_id;
$$;
```

### 2단계: Firebase 프로젝트 생성
1. https://console.firebase.google.com → 새 프로젝트 (clipu)
2. Android 앱 추가 → 패키지명: `com.clipu.app`
3. `google-services.json` 다운로드 → `android/app/` 폴더에 복사

### 3단계: expo-notifications 설치 + 빌드
```bash
npm install expo-notifications
# app.json plugins 배열에 "expo-notifications" 추가
npx expo prebuild --platform android  # android/ 재생성
# 그 후 versionCode 증가하고 AAB 빌드
```

### 4단계: 토큰 등록 코드 활성화
`lib/pushNotifications.ts` → `registerForPushNotifications` 함수 주석 해제

이후 앱 실행 시 자동으로 토큰이 등록되고, 공유클립에 링크 저장 시 다른 멤버에게 알림이 발송됩니다.

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
