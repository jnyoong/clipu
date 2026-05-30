import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { ExploreStackParamList } from '../App';
import { PublicCollection } from './ExploreScreen';

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

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'CuratorProfile'>;
  route: RouteProp<ExploreStackParamList, 'CuratorProfile'>;
};

export default function CuratorProfileScreen({ navigation, route }: Props) {
  const { ownerId, ownerNickname } = route.params;
  const [collections, setCollections] = useState<PublicCollection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollections = async () => {
    const { data, error } = await supabase.rpc('get_public_collections', { p_category: null });
    if (!error && data) {
      const mine = (data as PublicCollection[]).filter(c => c.owner_id === ownerId);
      setCollections(mine);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchCollections();
  }, [ownerId]));

  const totalLikes = collections.reduce((s, c) => s + c.like_count, 0);
  const totalSubs = collections.reduce((s, c) => s + c.sub_count, 0);
  const blueCheck = collections.some(c => c.blue_check);
  const avatarLetter = ownerNickname.charAt(0).toUpperCase();

  const renderCard = ({ item }: { item: PublicCollection }) => {
    const bgColor = CATEGORY_COLORS[item.category] ?? '#F3F4F6';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('CollectionDetail', { collectionId: item.id })}
        activeOpacity={0.85}
      >
        {item.cover_url ? (
          <Image source={{ uri: item.cover_url }} style={styles.cardCover} resizeMode="cover" />
        ) : (
          <View style={[styles.cardCover, { backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={styles.cardEmoji}>{getCategoryEmoji(item.category)}</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={[styles.categoryBadge, { backgroundColor: bgColor }]}>
            <Text style={styles.categoryBadgeText}>{item.category}</Text>
          </View>
          <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <View style={styles.cardStats}>
            <Text style={styles.statText}>🔗 {item.link_count}</Text>
            <Text style={styles.statText}>♡ {item.like_count}</Text>
            <Text style={styles.statText}>구독 {item.sub_count}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>큐레이터 프로필</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={collections}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderCard}
        ListHeaderComponent={
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
            <View style={styles.nameRow}>
              <Text style={styles.nickname}>@{ownerNickname}</Text>
              {blueCheck && (
                <View style={styles.blueCheckBadge}>
                  <Text style={styles.blueCheckText}>✓</Text>
                </View>
              )}
            </View>
            {loading ? null : (
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
                  <Text style={styles.statNum}>{collections.length}</Text>
                  <Text style={styles.statLabel}>공개 클립</Text>
                </View>
              </View>
            )}
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>공개 클립</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#2563EB" style={{ marginTop: 32 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>공개된 클립이 없어요</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111' },

  profileSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  nickname: { fontSize: 20, fontWeight: '800', color: '#111' },
  blueCheckBadge: {
    backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  blueCheckText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  statItem: { alignItems: 'center', flex: 1 },
  statNum: { fontSize: 22, fontWeight: '800', color: '#111' },
  statLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },

  list: { paddingHorizontal: 16, paddingBottom: 40 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardCover: { width: '100%', height: 140 },
  cardEmoji: { fontSize: 40 },
  cardBody: { padding: 14, gap: 6 },
  categoryBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  cardName: { fontSize: 16, fontWeight: '700', color: '#111', lineHeight: 22 },
  cardDesc: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  cardStats: { flexDirection: 'row', gap: 12, marginTop: 4 },
  statText: { fontSize: 12, color: '#9CA3AF' },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 15, color: '#888' },
});
