import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AppStackParamList } from '../App';

export type Collection = {
  id: string;
  name: string;
  user_id: string;
  is_shared: boolean;
  invite_code: string | null;
  role: 'owner' | 'member';
};

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'Collections'>;
};

export default function CollectionsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCollections = async () => {
    const { data, error } = await supabase
      .from('collection_members')
      .select('role, collections(id, name, user_id, is_shared, invite_code, created_at)');

    if (!error && data) {
      const cols: Collection[] = (data as any[])
        .filter((m) => m.collections !== null)
        .sort((a, b) =>
          new Date(a.collections.created_at).getTime() - new Date(b.collections.created_at).getTime()
        )
        .map((m) => ({ ...m.collections, role: m.role as 'owner' | 'member' }));
      setCollections(cols);
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchCollections();
    }, [])
  );

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    const { data, error } = await supabase
      .from('collections')
      .insert({ user_id: session!.user.id, name })
      .select('id, name, user_id, is_shared, invite_code')
      .single();

    setCreating(false);

    if (error) {
      Alert.alert('오류', error.message);
    } else {
      setCollections((prev) => [...prev, { ...data, role: 'owner' as const }]);
      setNewName('');
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('클립 삭제', `"${name}"을 삭제할까요?\n안에 있는 링크는 미분류로 이동돼요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('collections').delete().eq('id', id);
          setCollections((prev) => prev.filter((c) => c.id !== id));
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'} 돌아가기</Text>
        </TouchableOpacity>
        <Text style={styles.title}>클립 관리</Text>
      </View>

      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          placeholder="새 클립 이름"
          placeholderTextColor="#aaa"
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={handleCreate}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.createBtn, !newName.trim() && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!newName.trim() || creating}
        >
          {creating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.createBtnText}>추가</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563EB" />
      ) : collections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>클립이 없어요</Text>
          <Text style={styles.emptyHint}>위에서 새 클립을 만들어보세요</Text>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onLongPress={() => handleDelete(item.id, item.name)}
              activeOpacity={0.7}
            >
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemHint}>길게 누르면 삭제</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 14,
    color: '#2563EB',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  createRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  createBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  item: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  itemHint: {
    fontSize: 11,
    color: '#bbb',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 13,
    color: '#999',
  },
});
