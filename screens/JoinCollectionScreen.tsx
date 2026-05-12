import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Props = {
  inviteCode: string;
  onJoined: () => void;
  onCancel: () => void;
};

export default function JoinCollectionScreen({ inviteCode, onJoined, onCancel }: Props) {
  const [collectionName, setCollectionName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCollection = async () => {
      const { data, error } = await supabase.rpc('get_collection_by_invite', { code: inviteCode });
      if (error || !data || data.length === 0) {
        setError('유효하지 않은 초대 링크예요');
      } else {
        setCollectionName(data[0].name);
      }
      setLoading(false);
    };
    fetchCollection();
  }, [inviteCode]);

  const handleJoin = async () => {
    setJoining(true);
    const { data, error } = await supabase.rpc('join_collection', { code: inviteCode });
    setJoining(false);
    if (error) {
      setError('오류가 발생했어요. 다시 시도해주세요.');
      return;
    }
    if (data === 'full') {
      setError('클립이 가득 찼어요 (최대 30명)');
      return;
    }
    if (data === 'not_found') {
      setError('유효하지 않은 초대 링크예요');
      return;
    }
    onJoined();
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={onCancel} activeOpacity={1} />
      <View style={styles.sheet}>
        {loading ? (
          <ActivityIndicator color="#2563EB" size="large" style={{ marginVertical: 24 }} />
        ) : error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>닫기</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>클립 참여</Text>
            <Text style={styles.collectionName}>"{collectionName}"</Text>
            <Text style={styles.desc}>이 클립에 참여할까요?{'\n'}참여하면 링크를 함께 볼 수 있어요.</Text>
            <TouchableOpacity
              style={[styles.joinBtn, joining && styles.joinBtnDisabled]}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.joinText}>참여하기</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 28,
    paddingBottom: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.3,
  },
  collectionName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2563EB',
    textAlign: 'center',
    marginBottom: 4,
  },
  desc: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  joinBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
  },
  joinBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  joinText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 10,
  },
  cancelText: {
    color: '#888',
    fontSize: 15,
  },
  errorText: {
    fontSize: 15,
    color: '#EF4444',
    textAlign: 'center',
    marginVertical: 16,
    lineHeight: 22,
  },
});
