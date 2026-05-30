import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getDomain } from '../lib/og';
import { ExploreStackParamList } from '../App';

type Link = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  note: string | null;
};

type DetailCollection = {
  id: string;
  name: string;
  description: string;
  category: string;
  cover_url: string | null;
  owner_id: string;
  owner_nickname: string;
  blue_check: boolean;
  link_count: number;
  like_count: number;
  sub_count: number;
};

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'CollectionDetail'>;
  route: RouteProp<ExploreStackParamList, 'CollectionDetail'>;
};

const CATEGORY_COLORS: Record<string, string> = {
  '맛집': '#FEF3C7', '마케팅': '#EDE9FE', '디자인': '#FCE7F3',
  'IT/개발': '#DBEAFE', '교육': '#D1FAE5', '여행': '#E0F2FE',
  '투자/금융': '#FEE2E2', '라이프': '#F0FDF4', '패션': '#FDF4FF', '기타': '#F3F4F6',
};

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    '맛집': '🍜', '마케팅': '📣', '디자인': '🎨', 'IT/개발': '💻',
    '교육': '📚', '여행': '✈️', '투자/금융': '💰', '라이프': '🌿',
    '패션': '👗', '기타': '📎',
  };
  return map[category] ?? '📎';
}

export default function CollectionDetailScreen({ navigation, route }: Props) {
  const { collectionId } = route.params;
  const { session } = useAuth();
  const [collection, setCollection] = useState<DetailCollection | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [liked, setLiked] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [subCount, setSubCount] = useState(0);

  const fetchDetail = async () => {
    const [colRes, linksRes, likeRes, subRes] = await Promise.all([
      supabase.rpc('get_public_collections').then(({ data }) =>
        (data as DetailCollection[] | null)?.find(c => c.id === collectionId) ?? null
      ),
      supabase
        .from('links')
        .select('id, url, title, description, image_url, note')
        .eq('collection_id', collectionId)
        .order('created_at', { ascending: false })
        .limit(20),
      session ? supabase
        .from('collection_likes')
        .select('collection_id')
        .eq('collection_id', collectionId)
        .eq('user_id', session.user.id)
        .maybeSingle() : Promise.resolve({ data: null }),
      session ? supabase
        .from('collection_subscriptions')
        .select('collection_id')
        .eq('collection_id', collectionId)
        .eq('user_id', session.user.id)
        .maybeSingle() : Promise.resolve({ data: null }),
    ]);

    if (colRes) {
      setCollection(colRes);
      setLikeCount(colRes.like_count);
      setSubCount(colRes.sub_count);
    }
    if (!linksRes.error && linksRes.data) setLinks(linksRes.data);
    setLiked(!!likeRes.data);
    setSubscribed(!!subRes.data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => {
    fetchDetail();
  }, [collectionId]));

  const handleToggleLike = async () => {
    if (!session) { Alert.alert('로그인 필요', '로그인 후 이용해주세요.'); return; }
    const next = !liked;
    setLiked(next);
    setLikeCount(prev => next ? prev + 1 : prev - 1);
    if (next) {
      await supabase.from('collection_likes').insert({ collection_id: collectionId, user_id: session.user.id });
    } else {
      await supabase.from('collection_likes').delete()
        .eq('collection_id', collectionId).eq('user_id', session.user.id);
    }
  };

  const handleToggleSubscribe = async () => {
    if (!session) { Alert.alert('로그인 필요', '로그인 후 이용해주세요.'); return; }
    const next = !subscribed;
    setSubscribed(next);
    setSubCount(prev => next ? prev + 1 : prev - 1);
    if (next) {
      await supabase.from('collection_subscriptions').insert({ collection_id: collectionId, user_id: session.user.id });
    } else {
      await supabase.from('collection_subscriptions').delete()
        .eq('collection_id', collectionId).eq('user_id', session.user.id);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={styles.loader} color="#2563EB" size="large" />
      </SafeAreaView>
    );
  }

  if (!collection) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>클립을 찾을 수 없어요.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const bgColor = CATEGORY_COLORS[collection.category] ?? '#F3F4F6';
  const isOwner = session?.user.id === collection.owner_id;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 커버 */}
        {collection.cover_url ? (
          <Image source={{ uri: collection.cover_url }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: bgColor }]}>
            <Text style={styles.coverEmoji}>{getCategoryEmoji(collection.category)}</Text>
          </View>
        )}

        {/* 헤더 뒤로가기 */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <View style={styles.backBtnCircle}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.body}>
          {/* 카테고리 배지 */}
          <View style={[styles.categoryBadge, { backgroundColor: bgColor }]}>
            <Text style={styles.categoryBadgeText}>{getCategoryEmoji(collection.category)} {collection.category}</Text>
          </View>

          {/* 클립 이름 */}
          <Text style={styles.title}>{collection.name}</Text>

          {/* 큐레이터 */}
          <View style={styles.curatorRow}>
            <View style={styles.curatorAvatar}>
              <Text style={styles.curatorAvatarText}>
                {(collection.owner_nickname ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.curatorInfo}>
              <View style={styles.curatorNameRow}>
                <Text style={styles.curatorName}>@{collection.owner_nickname ?? '익명'}</Text>
                {collection.blue_check && (
                  <View style={styles.blueCheckBadge}>
                    <Text style={styles.blueCheckText}>✓</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* 소개글 */}
          <Text style={styles.description}>{collection.description}</Text>

          {/* 통계 + 액션 */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.likeBtn, liked && styles.likeBtnActive]} onPress={handleToggleLike}>
              <Text style={[styles.likeBtnIcon, liked && styles.likeBtnIconActive]}>♥</Text>
              <Text style={[styles.likeBtnText, liked && styles.likeBtnTextActive]}>{likeCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.subscribeBtn, subscribed && styles.subscribeBtnActive]}
              onPress={handleToggleSubscribe}
            >
              <Text style={[styles.subscribeBtnText, subscribed && styles.subscribeBtnTextActive]}>
                {subscribed ? '구독 중' : '구독하기'}
              </Text>
              {subCount > 0 && (
                <Text style={[styles.subCount, subscribed && styles.subCountActive]}> {subCount}</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* 링크 목록 */}
          <View style={styles.linksHeader}>
            <Text style={styles.linksTitle}>링크 목록</Text>
            <Text style={styles.linksCount}>{collection.link_count}개</Text>
          </View>

          {links.length === 0 ? (
            <Text style={styles.noLinks}>링크가 없어요.</Text>
          ) : (
            links.map((link) => (
              <TouchableOpacity
                key={link.id}
                style={styles.linkCard}
                onPress={() => Linking.openURL(link.url)}
                activeOpacity={0.75}
              >
                {link.image_url ? (
                  <Image source={{ uri: link.image_url }} style={styles.linkImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.linkImage, styles.linkImagePlaceholder]} />
                )}
                <View style={styles.linkBody}>
                  <Text style={styles.linkTitle} numberOfLines={2}>{link.title || link.url}</Text>
                  <Text style={styles.linkDomain}>{getDomain(link.url)}</Text>
                  {link.note ? (
                    <Text style={styles.linkNote} numberOfLines={2}>💬 {link.note}</Text>
                  ) : null}
                </View>
                <Ionicons name="open-outline" size={16} color="#CBD5E1" style={styles.linkExternal} />
              </TouchableOpacity>
            ))
          )}

          {!isOwner && collection.link_count > 20 && (
            <View style={styles.moreHint}>
              <Text style={styles.moreHintText}>구독하면 업데이트 소식을 받을 수 있어요</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loader: { flex: 1 },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontSize: 16, color: '#555' },
  backLink: { fontSize: 14, color: '#2563EB' },

  cover: { width: '100%', height: 220 },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  coverEmoji: { fontSize: 56 },

  backBtn: { position: 'absolute', top: 16, left: 16, zIndex: 10 },
  backBtnCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },

  body: { padding: 20, gap: 14 },

  categoryBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  categoryBadgeText: { fontSize: 13, fontWeight: '600', color: '#374151' },

  title: { fontSize: 22, fontWeight: '800', color: '#111', lineHeight: 30 },

  curatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  curatorAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center',
  },
  curatorAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  curatorInfo: { flex: 1 },
  curatorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  curatorName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  blueCheckBadge: {
    backgroundColor: '#2563EB', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  blueCheckText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  description: { fontSize: 14, color: '#555', lineHeight: 22 },

  actionsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  likeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  likeBtnActive: { borderColor: '#F43F5E', backgroundColor: '#FFF1F2' },
  likeBtnIcon: { fontSize: 16, color: '#D1D5DB' },
  likeBtnIconActive: { color: '#F43F5E' },
  likeBtnText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
  likeBtnTextActive: { color: '#F43F5E' },

  subscribeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#2563EB', backgroundColor: '#fff',
  },
  subscribeBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  subscribeBtnText: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  subscribeBtnTextActive: { color: '#fff' },
  subCount: { fontSize: 13, color: '#2563EB', fontWeight: '600' },
  subCountActive: { color: '#fff' },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },

  linksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linksTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  linksCount: { fontSize: 13, color: '#2563EB', fontWeight: '600' },

  noLinks: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 20 },

  linkCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  linkImage: { width: 64, height: 64, backgroundColor: '#F3F4F6', flexShrink: 0 },
  linkImagePlaceholder: { backgroundColor: '#E5E7EB' },
  linkBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 3 },
  linkTitle: { fontSize: 13, fontWeight: '600', color: '#111', lineHeight: 19 },
  linkDomain: { fontSize: 11, color: '#2563EB' },
  linkNote: { fontSize: 12, color: '#6B7280', lineHeight: 17, marginTop: 2 },
  linkExternal: { marginRight: 12 },

  moreHint: {
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, alignItems: 'center',
  },
  moreHintText: { fontSize: 13, color: '#2563EB', fontWeight: '500' },
});
