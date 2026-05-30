import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { ExploreStackParamList } from '../App';

export type PublicCollection = {
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

const CATEGORIES = ['전체', '맛집', '마케팅', '디자인', 'IT/개발', '교육', '여행', '투자/금융', '라이프', '패션', '기타'];

type SortKey = 'popular' | 'subscribers' | 'links';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: '♡ 인기순' },
  { key: 'subscribers', label: '● 구독순' },
  { key: 'links', label: '🔗 링크순' },
];

const CATEGORY_COLORS: Record<string, string> = {
  '맛집': '#FEF3C7', '마케팅': '#EDE9FE', '디자인': '#FCE7F3',
  'IT/개발': '#DBEAFE', '교육': '#D1FAE5', '여행': '#E0F2FE',
  '투자/금융': '#FEE2E2', '라이프': '#F0FDF4', '패션': '#FDF4FF', '기타': '#F3F4F6',
};

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'Explore'>;
};

export default function ExploreScreen({ navigation }: Props) {
  const [collections, setCollections] = useState<PublicCollection[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [sortKey, setSortKey] = useState<SortKey>('popular');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCollections = async (category: string = selectedCategory) => {
    const { data, error } = await supabase.rpc('get_public_collections', {
      p_category: category === '전체' ? null : category,
    });
    if (!error && data) setCollections(data as PublicCollection[]);
    setLoading(false);
    setRefreshing(false);
  };

  const sortedCollections = [...collections]
    .filter(c => c.link_count > 0)
    .sort((a, b) => {
      if (sortKey === 'popular') return b.like_count - a.like_count;
      if (sortKey === 'subscribers') return b.sub_count - a.sub_count;
      return b.link_count - a.link_count;
    });

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchCollections(selectedCategory);
  }, [selectedCategory]));

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setLoading(true);
    fetchCollections(cat);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCollections(selectedCategory);
  };

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
          <View style={[styles.cardCover, styles.cardCoverPlaceholder, { backgroundColor: bgColor }]}>
            <Text style={styles.cardCoverEmoji}>{getCategoryEmoji(item.category)}</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardNickname} numberOfLines={1}>
              @{item.owner_nickname ?? '익명'}
            </Text>
            {item.blue_check && <Text style={styles.blueCheck}>✓</Text>}
          </View>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
          <View style={styles.cardStats}>
            <Text style={styles.statText}>🔗 {item.link_count}</Text>
            <Text style={styles.statText}>♡ {item.like_count}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>탐색</Text>
        <Text style={styles.headerSub}>큐레이터들의 클립을 발견해보세요</Text>
      </View>

      <View style={styles.categoryWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryTab, selectedCategory === cat && styles.categoryTabActive]}
              onPress={() => handleCategoryChange(cat)}
            >
              <Text style={[styles.categoryTabText, selectedCategory === cat && styles.categoryTabTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortBtn, sortKey === opt.key && styles.sortBtnActive]}
              onPress={() => setSortKey(opt.key)}
            >
              <Text style={[styles.sortBtnText, sortKey === opt.key && styles.sortBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color="#2563EB" size="large" />
      ) : (
        <FlatList
          data={sortedCollections}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={sortedCollections.length === 0 ? styles.emptyContainer : styles.list}
          renderItem={renderCard}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" colors={['#2563EB']} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>아직 공개된 클립이 없어요</Text>
              <Text style={styles.emptyHint}>내 클립을 전체공개로 전환해 첫 번째 큐레이터가 되어보세요!</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    '맛집': '🍜', '마케팅': '📣', '디자인': '🎨', 'IT/개발': '💻',
    '교육': '📚', '여행': '✈️', '투자/금융': '💰', '라이프': '🌿',
    '패션': '👗', '기타': '📎',
  };
  return map[category] ?? '📎';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },

  categoryWrapper: {
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  categoryRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  categoryTab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  categoryTabActive: { backgroundColor: '#2563EB' },
  categoryTabText: { fontSize: 13, color: '#555', fontWeight: '500' },
  categoryTabTextActive: { color: '#fff', fontWeight: '700' },

  sortRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10, gap: 8,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8,
  },
  sortBtn: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  sortBtnActive: { backgroundColor: '#2563EB' },
  sortBtnText: { fontSize: 12, color: '#555', fontWeight: '500' },
  sortBtnTextActive: { color: '#fff', fontWeight: '700' },

  loader: { flex: 1 },
  list: { padding: 12, gap: 12 },
  emptyContainer: { flex: 1 },
  row: { gap: 12 },

  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardCover: { width: '100%', aspectRatio: 4 / 3 },
  cardCoverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardCoverEmoji: { fontSize: 36 },
  cardBody: { padding: 12, gap: 4 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#111', lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardNickname: { fontSize: 12, color: '#888', flex: 1 },
  blueCheck: { fontSize: 12, color: '#2563EB', fontWeight: '700' },
  cardDesc: { fontSize: 11, color: '#9CA3AF', lineHeight: 16, marginTop: 1 },
  cardStats: { flexDirection: 'row', gap: 10, marginTop: 2 },
  statText: { fontSize: 12, color: '#9CA3AF' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#555', marginBottom: 8, fontWeight: '600' },
  emptyHint: { fontSize: 13, color: '#999', textAlign: 'center', lineHeight: 20 },
});
