import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  ToastAndroid,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { saveLink } from '../lib/saveLink';
import { sendSharedCollectionNotification } from '../lib/pushNotifications';

type PickerItem = { id: string; name: string; is_shared?: boolean };

type Props = {
  sharedUrl: string;
  userId: string;
  userNickname?: string;
  onDone: () => void;
};

export default function SharePickerScreen({ sharedUrl, userId, userNickname, onDone }: Props) {
  const [collections, setCollections] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // collection_members join으로 공유클립 포함 전체 클립 가져오기
    supabase
      .from('collection_members')
      .select('collections(id, name, is_shared, created_at)')
      .then(({ data }) => {
        const cols: PickerItem[] = ((data ?? []) as any[])
          .filter((m) => m.collections !== null)
          .sort((a: any, b: any) =>
            new Date(a.collections.created_at).getTime() - new Date(b.collections.created_at).getTime()
          )
          .map((m: any) => ({
            id: m.collections.id,
            name: m.collections.name,
            is_shared: m.collections.is_shared ?? false,
          }));
        setCollections(cols);
        setLoading(false);
      });
  }, []);

  const handlePick = async (item: PickerItem) => {
    setSaving(true);
    const { error } = await saveLink(sharedUrl, userId, item.id);
    setSaving(false);

    if (error) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('저장 실패. 다시 시도해주세요.', ToastAndroid.SHORT);
      } else {
        Alert.alert('저장 실패', '다시 시도해주세요.');
      }
      return;
    }

    // 공유클립이면 다른 멤버에게 알림 발송 (push_tokens 테이블 설정 후 실제 발송됨)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (item.is_shared) {
      sendSharedCollectionNotification(item.id, item.name, userNickname ?? '누군가');
    }

    if (Platform.OS === 'android') {
      ToastAndroid.show('링크가 저장됐어요!', ToastAndroid.SHORT);
      // onDone() 없이 바로 exit → 외부 앱으로 즉시 복귀
      BackHandler.exitApp();
    } else {
      onDone();
    }
  };

  const handleClose = () => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      onDone();
    }
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>어디에 저장할까요?</Text>
        <Text style={styles.url} numberOfLines={1}>{sharedUrl}</Text>

        {loading || saving ? (
          <View style={styles.loader}>
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.loaderText}>{saving ? '저장 중...' : '불러오는 중...'}</Text>
          </View>
        ) : collections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>클립이 없어요</Text>
            <Text style={styles.emptyHint}>앱에서 클립을 먼저 만들어주세요</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={collections}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.item, index === 0 && styles.itemFirst]}
                onPress={() => handlePick(item)}
              >
                <Text style={styles.itemText}>
                  {item.is_shared ? '🔗 ' : ''}{item.name}
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emptyHint: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  closeBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  closeBtnText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
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
});
