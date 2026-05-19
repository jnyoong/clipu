/**
 * 푸시 알림 헬퍼
 *
 * ── 현재 상태 ──────────────────────────────────────────────────────────────
 * - sendSharedCollectionNotification: 구현 완료 (Expo Push API 직접 호출)
 *   단, Supabase에 push_tokens 테이블 + get_collection_push_tokens RPC 가 있어야 실제 발송됨
 * - registerForPushNotifications: Firebase 설정 완료 후 활성화
 *
 * ── Firebase + expo-notifications 설정 순서 (다음 세션) ────────────────────
 * 1. Firebase Console에서 Android 앱 등록 → google-services.json 다운로드
 *    → android/app/ 폴더에 복사
 * 2. npm install expo-notifications
 * 3. app.json plugins 배열에 "expo-notifications" 추가
 * 4. npx expo prebuild --platform android (android/ 폴더 재생성)
 * 5. 아래 registerForPushNotifications 함수 주석 해제
 *
 * ── Supabase SQL (지금 바로 실행 가능) ─────────────────────────────────────
 * 아래 SQL을 Supabase SQL Editor에서 실행하세요:
 *
 * -- 푸시 토큰 저장 테이블
 * CREATE TABLE IF NOT EXISTS push_tokens (
 *   user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *   token text NOT NULL,
 *   updated_at timestamptz DEFAULT now()
 * );
 * ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "own token" ON push_tokens FOR ALL USING (auth.uid() = user_id);
 *
 * -- 공유클립 멤버들의 토큰 조회 (SECURITY DEFINER: 내 토큰 제외)
 * CREATE OR REPLACE FUNCTION get_collection_push_tokens(coll_id uuid)
 * RETURNS TABLE(token text)
 * LANGUAGE sql SECURITY DEFINER AS $$
 *   SELECT pt.token
 *   FROM collection_members cm
 *   JOIN push_tokens pt ON pt.user_id = cm.user_id
 *   WHERE cm.collection_id = coll_id AND cm.user_id != auth.uid();
 * $$;
 *
 * -- (get_collection_members 가 0명을 반환하면 아래로 재생성)
 * CREATE OR REPLACE FUNCTION get_collection_members(coll_id uuid)
 * RETURNS TABLE(user_id uuid, role text, nickname text)
 * LANGUAGE sql SECURITY DEFINER AS $$
 *   SELECT cm.user_id, cm.role,
 *          (auth.users.raw_user_meta_data->>'nickname') AS nickname
 *   FROM collection_members cm
 *   JOIN auth.users ON auth.users.id = cm.user_id
 *   WHERE cm.collection_id = coll_id;
 * $$;
 */

import { supabase } from './supabase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * 공유클립에 새 링크가 추가됐을 때 다른 멤버에게 알림 발송.
 * push_tokens 테이블과 get_collection_push_tokens RPC 가 있어야 실제 발송됨.
 */
export async function sendSharedCollectionNotification(
  collectionId: string,
  collectionName: string,
  senderNickname: string,
): Promise<void> {
  try {
    const { data: tokens, error } = await supabase.rpc('get_collection_push_tokens', {
      coll_id: collectionId,
    });

    if (error || !tokens || (tokens as { token: string }[]).length === 0) return;

    const messages = (tokens as { token: string }[]).map(({ token }) => ({
      to: token,
      title: '새 링크가 추가됐어요',
      body: `${senderNickname}님이 "${collectionName}"에 링크를 공유했어요`,
      data: { collectionId },
    }));

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (_) {
    // 알림 실패는 무시 — 링크 저장은 이미 완료된 상태
  }
}

/**
 * 디바이스 푸시 토큰 등록 (Firebase 설정 완료 후 활성화).
 * 현재는 no-op.
 */
export async function registerForPushNotifications(_userId: string): Promise<void> {
  // TODO: Firebase 설정 + expo-notifications 설치 후 아래 주석 해제
  //
  // import * as Notifications from 'expo-notifications';
  // try {
  //   const { status } = await Notifications.requestPermissionsAsync();
  //   if (status !== 'granted') return;
  //   const tokenData = await Notifications.getExpoPushTokenAsync({
  //     projectId: '95ce1c42-0416-4f76-a646-7abf284be7df',
  //   });
  //   await supabase.from('push_tokens').upsert({
  //     user_id: _userId,
  //     token: tokenData.data,
  //     updated_at: new Date().toISOString(),
  //   });
  // } catch (_) {}
}
