import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { saveLink } from '../lib/saveLink';
import { useAuth } from '../contexts/AuthContext';
import { AppStackParamList } from '../App';
import { Collection } from './CollectionsScreen';

type PickerItem = { id: string | null; name: string };

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'AddLink'>;
  route: RouteProp<AppStackParamList, 'AddLink'>;
};

export default function AddLinkScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<PickerItem | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    supabase
      .from('collection_members')
      .select('role, collections(id, name, user_id, is_shared, invite_code, created_at)')
      .then(({ data }) => {
        const cols: Collection[] = (data ?? [])
          .filter((m: any) => m.collections !== null)
          .sort((a: any, b: any) =>
            new Date(a.collections.created_at).getTime() - new Date(b.collections.created_at).getTime()
          )
          .map((m: any) => ({ ...m.collections, role: m.role as 'owner' | 'member' }));
        setCollections(cols);
        if (route.params?.collectionId) {
          const preset = cols.find((c) => c.id === route.params.collectionId);
          if (preset) setSelectedCollection(preset);
        }
      });
  }, []);

  const handleSave = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert('오류', 'URL을 입력해주세요.');
      return;
    }

    setLoading(true);
    const { error } = await saveLink(trimmed, session!.user.id, selectedCollection?.id ?? null);
    setLoading(false);

    if (error) {
      Alert.alert('저장 실패', error);
    } else {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>링크 저장</Text>
        <Text style={styles.subtitle}>저장할 URL을 붙여넣으세요</Text>

        <TextInput
          style={styles.input}
          placeholder="https://..."
          placeholderTextColor="#999"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          autoFocus
          editable={!loading}
        />

        <TouchableOpacity
          style={styles.collectionPicker}
          onPress={() => setPickerVisible(true)}
          disabled={loading}
        >
          <Text style={styles.collectionPickerLabel}>클립</Text>
          <Text style={[styles.collectionPickerValue, !selectedCollection && styles.collectionPickerPlaceholder]}>
            {selectedCollection ? selectedCollection.name : '선택 안 함'}
          </Text>
          <Text style={styles.collectionPickerArrow}>›</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.loadingText}>저장 중...</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleSave}>
            <Text style={styles.buttonText}>저장</Text>
          </TouchableOpacity>
        )}

        {!loading && (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancel}>취소</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity style={styles.modalBackdrop} onPress={() => setPickerVisible(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>클립 선택</Text>
          <FlatList
            data={[{ id: null, name: '선택 안 함' }, ...collections] as PickerItem[]}
            keyExtractor={(item) => item.id ?? '__none__'}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setSelectedCollection(item.id ? item : null);
                  setPickerVisible(false);
                }}
              >
                <Text style={[
                  styles.modalItemText,
                  !item.id && styles.modalItemTextMuted,
                  selectedCollection?.id === item.id && styles.modalItemTextSelected,
                ]}>
                  {item.name}
                </Text>
                {selectedCollection?.id === item.id && (
                  <Text style={styles.modalItemCheck}>✓</Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
    color: '#111',
  },
  collectionPicker: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  collectionPickerLabel: {
    fontSize: 14,
    color: '#888',
    marginRight: 10,
  },
  collectionPickerValue: {
    flex: 1,
    fontSize: 15,
    color: '#111',
    fontWeight: '500',
  },
  collectionPickerPlaceholder: {
    color: '#bbb',
    fontWeight: '400',
  },
  collectionPickerArrow: {
    fontSize: 18,
    color: '#ccc',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
  },
  cancel: {
    color: '#888',
    textAlign: 'center',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    maxHeight: '60%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  modalItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalItemText: {
    flex: 1,
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
  },
  modalItemTextMuted: {
    color: '#aaa',
    fontWeight: '400',
  },
  modalItemTextSelected: {
    color: '#2563EB',
  },
  modalItemCheck: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: '700',
  },
});
