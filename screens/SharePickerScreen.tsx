import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  Platform,
  ToastAndroid,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { saveLink } from '../lib/saveLink';
type PickerItem = { id: string | null; name: string };

type Props = {
  sharedUrl: string;
  userId: string;
  onDone: () => void;
};

export default function SharePickerScreen({ sharedUrl, userId, onDone }: Props) {
  const [collections, setCollections] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('collections')
      .select('id, name')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setCollections(data ?? []);
        setLoading(false);
      });
  }, []);

  const handlePick = async (collectionId: string | null) => {
    setSaving(true);
    const { error } = await saveLink(sharedUrl, userId, collectionId);
    setSaving(false);

    if (Platform.OS === 'android') {
      ToastAndroid.show(error ? '저장 실패' : '링크가 저장됐어요!', ToastAndroid.SHORT);
    }

    onDone();
    BackHandler.exitApp();
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={() => BackHandler.exitApp()} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>어디에 저장할까요?</Text>
        <Text style={styles.url} numberOfLines={1}>{sharedUrl}</Text>

        {loading || saving ? (
          <View style={styles.loader}>
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.loaderText}>{saving ? '저장 중...' : '불러오는 중...'}</Text>
          </View>
        ) : (
          <FlatList
            data={[{ id: null, name: '클립 없이 저장' }, ...collections] as PickerItem[]}
            keyExtractor={(item) => item.id ?? '__none__'}
            style={styles.list}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.item, index === 0 && styles.itemFirst]}
                onPress={() => handlePick(item.id)}
              >
                <Text style={[styles.itemText, index === 0 && styles.itemTextMuted]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  url: {
    fontSize: 12,
    color: '#888',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  loader: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: '#888',
  },
  list: {
    flexGrow: 0,
  },
  item: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  itemFirst: {
    borderTopWidth: 0,
  },
  itemText: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
  },
  itemTextMuted: {
    color: '#888',
    fontWeight: '400',
  },
});
