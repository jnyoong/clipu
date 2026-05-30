import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type NotifItem = {
  type: 'like' | 'subscribe';
  collectionName: string;
  created_at: string;
};

type ColStat = {
  id: string;
  name: string;
  likeCount: number;
  subCount: number;
};

type CuratorInfo = {
  owner_id: string;
  owner_nickname: string;
  blue_check: boolean;
  collections: Array<{ id: string; name: string; like_count: number; sub_count: number }>;
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}일 전`;
  return `${Math.floor(diff / 2592000)}달 전`;
}

export default function MyScreen() {
  const { session, signOut } = useAuth();
  const [editingNickname, setEditingNickname] = useState(false);
  const [nickname, setNickname] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const [publicCols, setPublicCols] = useState<ColStat[]>([]);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [subscribedCurators, setSubscribedCurators] = useState<CuratorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [unsubscribingId, setUnsubscribingId] = useState<string | null>(null);

  const defaultNickname = session?.user.user_metadata?.nickname
    || session?.user.email?.split('@')[0]
    || '';

  const fetchData = async () => {
    if (!session) return;

    // 내 공개 클립 조회
    const { data: myCols } = await supabase
      .from('collections')
      .select('id, name')
      .eq('user_id', session.user.id)
      .eq('is_public', true);

    const colIds = (myCols ?? []).map((c) => c.id);
    const colNameMap: Record<string, string> = {};
    (myCols ?? []).forEach((c) => { colNameMap[c.id] = c.name; });

    // 구독 정보 + 공개 클립 전체 동시 조회
    const [mySubs, pubColsRes] = await Promise.all([
      supabase.from('collection_subscriptions').select('collection_id').eq('user_id', session.user.id),
      supabase.rpc('get_public_collections', { p_category: null }),
    ]);

    // 내 공개 클립 통계
    if (colIds.length > 0 && !pubColsRes.error && pubColsRes.data) {
      const statMap: Record<string, { like: number; sub: number }> = {};
      ((pubColsRes.data ?? []) as any[])
        .filter((c) => c.owner_id === session.user.id)
        .forEach((c) => { statMap[c.id] = { like: c.like_count, sub: c.sub_count }; });

      setPublicCols((myCols ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        likeCount: statMap[c.id]?.like ?? 0,
        subCount: statMap[c.id]?.sub ?? 0,
      })));

      // 알림 (내 공개 클립에 달린 하트·구독)
      const [likesRes, subsRes] = await Promise.all([
        supabase.from('collection_likes').select('collection_id, created_at')
          .in('collection_id', colIds).order('created_at', { ascending: false }).limit(40),
        supabase.from('collection_subscriptions').select('collection_id, created_at')
          .in('collection_id', colIds).order('created_at', { ascending: false }).limit(40),
      ]);

      const notifs: NotifItem[] = [
        ...(likesRes.data ?? []).map((l) => ({
          type: 'like' as const,
          collectionName: colNameMap[l.collection_id] ?? '',
          created_at: l.created_at,
        })),
        ...(subsRes.data ?? []).map((s) => ({
          type: 'subscribe' as const,
          collectionName: colNameMap[s.collection_id] ?? '',
          created_at: s.created_at,
        })),
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30);

      setNotifications(notifs);
    } else {
      setPublicCols([]);
      setNotifications([]);
    }

    // 구독 중인 큐레이터
    if (!mySubs.error && mySubs.data && mySubs.data.length > 0 && !pubColsRes.error && pubColsRes.data) {
      const subIds = mySubs.data.map((s) => s.collection_id);
      const myCuratorCols = (pubColsRes.data as any[]).filter(
        (c) => subIds.includes(c.id) && c.owner_id !== session.user.id
      );

      const curatorMap: Record<string, CuratorInfo> = {};
      myCuratorCols.forEach((c) => {
        if (!curatorMap[c.owner_id]) {
          curatorMap[c.owner_id] = {
            owner_id: c.owner_id,
            owner_nickname: c.owner_nickname || '익명',
            blue_check: c.blue_check,
            collections: [],
          };
        }
        curatorMap[c.owner_id].collections.push({
          id: c.id,
          name: c.name,
          like_count: c.like_count,
          sub_count: c.sub_count,
        });
      });
      setSubscribedCurators(Object.values(curatorMap));
    } else {
      setSubscribedCurators([]);
    }

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      setNickname(defaultNickname);
      setLoading(true);
      fetchData();
    }, [session?.user.id])
  );

  const handleSaveNickname = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    setSavingNickname(true);
    const { error } = await supabase.auth.updateUser({ data: { nickname: trimmed } });
    setSavingNickname(false);
    if (error) {
      Alert.alert('오류', '저장에 실패했어요.');
    } else {
      setEditingNickname(false);
      Alert.alert('저장 완료', '닉네임이 변경됐어요.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '회원탈퇴',
      '탈퇴하면 모든 링크와 클립 데이터가 영구 삭제돼요.\n정말로 탈퇴하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await supabase.rpc('delete_my_account');
            if (error) {
              setDeleting(false);
              Alert.alert('오류', '탈퇴 처리 중 오류가 발생했어요.');
              return;
            }
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  const handleUnsubscribe = (collectionId: string, collectionName: string) => {
    Alert.alert(
      '구독 취소',
      `"${collectionName}" 구독을 취소할까요?`,
      [
        { text: '아니요', style: 'cancel' },
        {
          text: '취소하기',
          style: 'destructive',
          onPress: async () => {
            setUnsubscribingId(collectionId);
            await supabase
              .from('collection_subscriptions')
              .delete()
              .eq('collection_id', collectionId)
              .eq('user_id', session!.user.id);
            setSubscribedCurators(prev =>
              prev.map(curator => ({
                ...curator,
                collections: curator.collections.filter(c => c.id !== collectionId),
              })).filter(curator => curator.collections.length > 0)
            );
            setUnsubscribingId(null);
          },
        },
      ]
    );
  };

  const avatarLetter = defaultNickname.charAt(0).toUpperCase();
  const totalLikes = publicCols.reduce((s, c) => s + c.likeCount, 0);
  const totalSubs = publicCols.reduce((s, c) => s + c.subCount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.headerTitle}>마이</Text>
          </View>

          {/* 프로필 */}
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionLabelText}>프로필</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarLetter}</Text>
              </View>
              <View style={styles.profileInfo}>
                {editingNickname ? (
                  <View style={styles.nicknameEditRow}>
                    <TextInput
                      style={styles.nicknameInput}
                      value={nickname}
                      onChangeText={setNickname}
                      maxLength={20}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleSaveNickname}
                    />
                    <TouchableOpacity
                      style={[styles.nickSaveBtn, savingNickname && styles.nickSaveBtnOff]}
                      onPress={handleSaveNickname}
                      disabled={savingNickname}
                    >
                      {savingNickname ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.nickSaveBtnText}>저장</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setEditingNickname(false); setNickname(defaultNickname); }}
                    >
                      <Text style={styles.nickCancelText}>취소</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.nicknameRow}>
                    <Text style={styles.nicknameText}>{defaultNickname}</Text>
                    <TouchableOpacity
                      style={styles.editNicknameBtn}
                      onPress={() => setEditingNickname(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editNicknameBtnText}>수정</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={styles.emailText}>{session?.user.email}</Text>
              </View>
            </View>
          </View>

          {/* 내 공개 클립 */}
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionLabelText}>내 공개 클립</Text>
          </View>
          {loading ? (
            <ActivityIndicator color="#2563EB" style={{ marginVertical: 24 }} />
          ) : publicCols.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>공개된 클립이 없어요</Text>
              <Text style={styles.emptyHint}>홈에서 클립을 꾹 누르면 전체공개로 전환할 수 있어요</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{totalLikes}</Text>
                  <Text style={styles.statLabel}>총 하트</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{totalSubs}</Text>
                  <Text style={styles.statLabel}>총 구독</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{publicCols.length}</Text>
                  <Text style={styles.statLabel}>공개 클립</Text>
                </View>
              </View>
              {publicCols.map((col, i) => (
                <View key={col.id} style={[styles.colRow, i === 0 && styles.colRowFirst]}>
                  <Text style={styles.colName} numberOfLines={1}>{col.name}</Text>
                  <View style={styles.colStats}>
                    <Text style={styles.colStat}>♥ {col.likeCount}</Text>
                    <Text style={styles.colStat}>구독 {col.subCount}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 최근 알림 */}
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionLabelText}>최근 알림</Text>
          </View>
          {!loading && notifications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>아직 알림이 없어요</Text>
              <Text style={styles.emptyHint}>공개 클립에 하트나 구독이 생기면 여기에 표시돼요</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {notifications.map((n, i) => (
                <View key={i} style={[styles.notifRow, i > 0 && styles.notifBorder]}>
                  <Text style={[styles.notifIcon, n.type === 'subscribe' && styles.notifIconSub]}>
                    {n.type === 'like' ? '♥' : '●'}
                  </Text>
                  <View style={styles.notifBody}>
                    <Text style={styles.notifText} numberOfLines={2}>
                      <Text style={styles.notifBold}>{n.collectionName}</Text>
                      {n.type === 'like' ? '에 하트가 달렸어요' : '에 구독자가 생겼어요'}
                    </Text>
                    <Text style={styles.notifTime}>{timeAgo(n.created_at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 구독 중인 큐레이터 */}
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionLabelText}>구독 중인 큐레이터</Text>
          </View>
          {!loading && subscribedCurators.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>구독 중인 큐레이터가 없어요</Text>
              <Text style={styles.emptyHint}>탐색 탭에서 마음에 드는 클립을 구독해보세요</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {subscribedCurators.map((curator, i) => (
                <View key={curator.owner_id} style={[styles.curatorBlock, i > 0 && styles.curatorBorder]}>
                  {/* 큐레이터 헤더 */}
                  <View style={styles.curatorRow}>
                    <View style={styles.curatorAvatar}>
                      <Text style={styles.curatorAvatarText}>
                        {curator.owner_nickname.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.curatorInfo}>
                      <View style={styles.curatorNameRow}>
                        <Text style={styles.curatorName}>@{curator.owner_nickname}</Text>
                        {curator.blue_check && (
                          <View style={styles.curatorBlueCheck}>
                            <Text style={styles.curatorBlueCheckText}>✓</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.curatorSubBadge}>{curator.collections.length}개 구독 중</Text>
                    </View>
                  </View>
                  {/* 클립별 구독 취소 */}
                  {curator.collections.map((col) => (
                    <View key={col.id} style={styles.subColRow}>
                      <Text style={styles.subColName} numberOfLines={1}>{col.name}</Text>
                      <TouchableOpacity
                        style={styles.unsubBtn}
                        onPress={() => handleUnsubscribe(col.id, col.name)}
                        disabled={unsubscribingId === col.id}
                      >
                        {unsubscribingId === col.id ? (
                          <ActivityIndicator color="#EF4444" size="small" />
                        ) : (
                          <Text style={styles.unsubBtnText}>구독 취소</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* 계정 */}
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionLabelText}>계정</Text>
          </View>
          <View style={styles.card}>
            <TouchableOpacity style={styles.menuRow} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={18} color="#374151" />
              <Text style={styles.menuText}>로그아웃</Text>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuRow} onPress={handleDeleteAccount} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator color="#EF4444" size="small" style={{ marginRight: 8 }} />
              ) : (
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              )}
              <Text style={[styles.menuText, styles.menuDanger]}>회원탈퇴</Text>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>
          </View>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111' },

  sectionLabel: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionLabelText: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 4,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  emptyCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 4,
    borderRadius: 16, padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  emptyText: { fontSize: 14, color: '#555', fontWeight: '600', marginBottom: 4 },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  profileInfo: { flex: 1, gap: 4 },
  nicknameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nicknameText: { fontSize: 17, fontWeight: '700', color: '#111' },
  editNicknameBtn: {
    backgroundColor: '#EFF6FF', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  editNicknameBtnText: { fontSize: 13, color: '#2563EB', fontWeight: '700' },
  emailText: { fontSize: 13, color: '#9CA3AF' },
  nicknameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nicknameInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#2563EB', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: 15, color: '#111',
  },
  nickSaveBtn: {
    backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  nickSaveBtnOff: { backgroundColor: '#93C5FD' },
  nickSaveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  nickCancelText: { fontSize: 13, color: '#9CA3AF', paddingHorizontal: 4 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, marginBottom: 8 },
  statItem: { alignItems: 'center', flex: 1 },
  statNum: { fontSize: 22, fontWeight: '800', color: '#111' },
  statLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },

  colRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  colRowFirst: { borderTopWidth: 0 },
  colName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111' },
  colStats: { flexDirection: 'row', gap: 10 },
  colStat: { fontSize: 13, color: '#9CA3AF' },

  notifRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 },
  notifBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  notifIcon: { fontSize: 14, marginTop: 2, color: '#F43F5E' },
  notifIconSub: { color: '#2563EB', fontSize: 10, marginTop: 4 },
  notifBody: { flex: 1, gap: 2 },
  notifText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  notifBold: { fontWeight: '700' },
  notifTime: { fontSize: 12, color: '#9CA3AF' },

  curatorBlock: { paddingVertical: 12 },
  curatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  curatorBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  curatorAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  curatorAvatarText: { fontSize: 16, fontWeight: '700', color: '#2563EB' },
  curatorInfo: { flex: 1 },
  curatorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  curatorName: { fontSize: 14, fontWeight: '700', color: '#111' },
  curatorBlueCheck: {
    backgroundColor: '#2563EB', borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  curatorBlueCheckText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  curatorColNames: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  curatorSubBadge: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  subColRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F9FAFB',
  },
  subColName: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
  unsubBtn: {
    borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, minWidth: 68, alignItems: 'center',
  },
  unsubBtnText: { fontSize: 12, color: '#EF4444', fontWeight: '600' },

  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  menuText: { flex: 1, fontSize: 15, color: '#374151', fontWeight: '500' },
  menuDanger: { color: '#EF4444' },
  menuDivider: { height: 1, backgroundColor: '#F3F4F6' },
});
