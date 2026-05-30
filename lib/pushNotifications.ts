/**
 * 푸시 알림 헬퍼 (expo-notifications 0.32 + Expo Push API)
 *
 * ── 현재 동작 ─────────────────────────────────────────────────────────────
 * - iOS: Firebase 불필요. Xcode에서 Push Notifications 기능만 추가하면 동작.
 * - Android: Firebase 설정 + google-services.json 필요 (아래 설명 참고).
 * - 3시간 이내 같은 클립에 알림이 또 가지 않도록 쿨다운 처리.
 *
 * ── Android Firebase 설정 순서 ────────────────────────────────────────────
 * 1. https://console.firebase.google.com → 프로젝트 추가 → 이름: "clipu"
 * 2. Android 앱 추가 → 패키지명: com.clipu.app
 * 3. google-services.json 다운로드 → android/app/ 폴더에 복사
 * 4. android/build.gradle buildscript.dependencies에 추가:
 *      classpath("com.google.gms:google-services:4.4.2")
 * 5. android/app/build.gradle 맨 아래에 추가:
 *      apply plugin: "com.google.gms.google-services"
 * 6. AAB 재빌드
 *
 * ── iOS 설정 순서 ─────────────────────────────────────────────────────────
 * Xcode → clipu 타겟 → Signing & Capabilities → + → Push Notifications
 * 그 후 맥북에서 Archive → Upload (buildNumber 증가 필수)
 *
 * ── Supabase SQL (아래 모두 실행) ─────────────────────────────────────────
 * -- 1) 푸시 토큰 테이블
 * CREATE TABLE IF NOT EXISTS push_tokens (
 *   user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *   token text NOT NULL,
 *   updated_at timestamptz DEFAULT now()
 * );
 * ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "own token" ON push_tokens FOR ALL USING (auth.uid() = user_id);
 *
 * -- 2) 쿨다운 테이블 (3시간 중복 알림 방지)
 * CREATE TABLE IF NOT EXISTS collection_notification_cooldown (
 *   collection_id uuid PRIMARY KEY REFERENCES collections(id) ON DELETE CASCADE,
 *   notified_at timestamptz NOT NULL DEFAULT now()
 * );
 * ALTER TABLE collection_notification_cooldown ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "members_cooldown" ON collection_notification_cooldown
 * FOR ALL USING (
 *   collection_id IN (
 *     SELECT collection_id FROM collection_members WHERE user_id = auth.uid()
 *   )
 * );
 *
 * -- 3) 멤버 푸시 토큰 조회 RPC
 * CREATE OR REPLACE FUNCTION get_collection_push_tokens(coll_id uuid)
 * RETURNS TABLE(token text)
 * LANGUAGE sql SECURITY DEFINER AS $$
 *   SELECT pt.token
 *   FROM collection_members cm
 *   JOIN push_tokens pt ON pt.user_id = cm.user_id
 *   WHERE cm.collection_id = coll_id AND cm.user_id != auth.uid();
 * $$;
 */

import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// 알림이 앱 사용 중에 도착해도 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3시간

/**
 * 디바이스 Expo 푸시 토큰을 Supabase에 등록.
 * Android: Firebase(google-services.json) 설정 완료 후 동작.
 * iOS: Xcode Push Notifications 기능 추가 후 동작.
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '95ce1c42-0416-4f76-a646-7abf284be7df',
    });

    await supabase.from('push_tokens').upsert({
      user_id: userId,
      token: tokenData.data,
      updated_at: new Date().toISOString(),
    });
  } catch (_) {
    // Firebase / APNs 미설정 시 조용히 실패
  }
}

/**
 * 큐레이터가 새 클립을 전체공개할 때 기존 구독자들에게 알림 발송.
 * SQL 필요: get_curator_subscriber_tokens(p_owner_id uuid)
 *
 * CREATE OR REPLACE FUNCTION get_curator_subscriber_tokens(p_owner_id uuid)
 * RETURNS TABLE(token text)
 * LANGUAGE sql SECURITY DEFINER AS $$
 *   SELECT DISTINCT pt.token
 *   FROM collections c
 *   JOIN collection_subscriptions cs ON cs.collection_id = c.id
 *   JOIN push_tokens pt ON pt.user_id = cs.user_id
 *   WHERE c.user_id = p_owner_id AND c.is_public = true AND cs.user_id != p_owner_id;
 * $$;
 */
export async function sendNewPublicCollectionNotification(
  collectionId: string,
  collectionName: string,
  ownerUserId: string,
  ownerNickname: string,
): Promise<void> {
  try {
    const { data: tokens } = await supabase.rpc('get_curator_subscriber_tokens', {
      p_owner_id: ownerUserId,
    });
    if (!tokens || (tokens as any[]).length === 0) return;

    const messages = (tokens as { token: string }[]).map(({ token }) => ({
      to: token,
      title: '새 공개 클립 🌐',
      body: `@${ownerNickname}님이 "${collectionName}"을 공개했어요`,
      data: { collectionId, type: 'new_public_collection' },
    }));

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (_) {}
}

/**
 * 공유클립에 새 링크 저장 시 다른 멤버들에게 알림 발송.
 * 3시간 이내에 같은 클립에서 이미 알림이 갔으면 건너뜀.
 */
export async function sendSharedCollectionNotification(
  collectionId: string,
  collectionName: string,
  senderNickname: string,
): Promise<void> {
  try {
    // 3시간 쿨다운 체크
    const { data: cooldown } = await supabase
      .from('collection_notification_cooldown')
      .select('notified_at')
      .eq('collection_id', collectionId)
      .single();

    if (cooldown?.notified_at) {
      const elapsed = Date.now() - new Date(cooldown.notified_at).getTime();
      if (elapsed < COOLDOWN_MS) return;
    }

    // 다른 멤버들의 푸시 토큰 조회
    const { data: tokens, error } = await supabase.rpc('get_collection_push_tokens', {
      coll_id: collectionId,
    });

    if (error || !tokens || (tokens as { token: string }[]).length === 0) return;

    // Expo Push API로 발송
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

    // 쿨다운 갱신 (다음 3시간 동안 같은 클립 알림 차단)
    await supabase.from('collection_notification_cooldown').upsert({
      collection_id: collectionId,
      notified_at: new Date().toISOString(),
    });
  } catch (_) {
    // 알림 실패는 조용히 무시 (링크 저장은 이미 완료)
  }
}
