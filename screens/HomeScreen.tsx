import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AppStackParamList } from '../App';

type Link = {
  id: string;
  url: string;
  title: string | null;
  created_at: string;
};

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'Home'>;
};

export default function HomeScreen({ navigation }: Props) {
  const { session, signOut } = useAuth();
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLinks = async () => {
    const { data, error } = await supabase
      .from('links')
      .select('id, url, title, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) setLinks(data);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchLinks();
    }, [])
  );

  const handleDelete = (id: string) => {
    Alert.alert('삭제', '이 링크를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('links').delete().eq('id', id);
          setLinks((prev) => prev.filter((l) => l.id !== id));
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Clipu</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color="#2563EB" />
      ) : links.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>저장된 링크가 없어요</Text>
          <Text style={styles.emptyHint}>아래 + 버튼으로 첫 링크를 저장해보세요</Text>
        </View>
      ) : (
        <FlatList
          data={links}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => Linking.openURL(item.url)}
              onLongPress={() => handleDelete(item.id)}
            >
              <Text style={styles.cardUrl} numberOfLines={1}>{item.url}</Text>
              <Text style={styles.cardDate}>
                {new Date(item.created_at).toLocaleDateString('ko-KR')}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddLink')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563EB',
  },
  signOut: {
    fontSize: 14,
    color: '#888',
  },
  loader: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: '#999',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardUrl: {
    fontSize: 14,
    color: '#2563EB',
    marginBottom: 6,
  },
  cardDate: {
    fontSize: 12,
    color: '#BBB',
  },
  fab: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    lineHeight: 32,
  },
});
