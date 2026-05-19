import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Props = {
  visible: boolean;
  onClose: () => void;
  session: Session;
  onSignOut: () => void;
};

export default function SettingsModal({ visible, onClose, session, onSignOut }: Props) {
  const defaultNickname = session.user.user_metadata?.nickname
    || session.user.email?.split('@')[0]
    || '';
  const [nickname, setNickname] = useState(defaultNickname);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { nickname: trimmed } });
    setSaving(false);
    if (error) {
      Alert.alert('오류', '저장에 실패했어요.');
    } else {
      Alert.alert('저장 완료', '닉네임이 변경됐어요.');
      onClose();
    }
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

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>설정</Text>

          <View style={styles.field}>
            <Text style={styles.label}>닉네임</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="닉네임 입력"
              placeholderTextColor="#aaa"
              maxLength={20}
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>저장</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            disabled={saving}
          >
            <Text style={styles.cancelBtnText}>취소</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <Text style={styles.deleteBtnText}>회원탈퇴</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
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
    paddingTop: 12,
    paddingBottom: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 24,
  },
  field: {
    width: '100%',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
    width: '100%',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  cancelBtnText: {
    color: '#888',
    fontSize: 15,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 20,
  },
  deleteBtn: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '500',
  },
});
