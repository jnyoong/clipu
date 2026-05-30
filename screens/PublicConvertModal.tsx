import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TouchableWithoutFeedback,
  TextInput, StyleSheet, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Collection } from './CollectionsScreen';

const CATEGORIES = [
  '맛집', '마케팅', '디자인', 'IT/개발', '교육',
  '여행', '투자/금융', '라이프', '패션', '기타',
];

type Props = {
  visible: boolean;
  collection: Collection;
  linkCount: number;
  onClose: () => void;
  onConverted: (updated: Collection) => void;
};

export default function PublicConvertModal({ visible, collection, linkCount, onClose, onConverted }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep(1);
    setCategory('');
    setDescription('');
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = () => {
    if (!category || description.trim().length < 20) return;

    Alert.alert(
      '전체공개 확인',
      '전체공개 후에는 취소할 수 없어요.\n탐색 탭에 영구 노출됩니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '공개하기',
          onPress: async () => {
            setSaving(true);
            const { data, error } = await supabase
              .from('collections')
              .update({ is_public: true, category, description: description.trim() })
              .eq('id', collection.id)
              .select('id, name, user_id, is_shared, invite_code, is_public, description, category, cover_url')
              .single();
            setSaving(false);
            if (error) {
              Alert.alert('오류', '전환 중 오류가 발생했어요.');
              return;
            }
            onConverted({ ...data, role: collection.role });
            reset();
          },
        },
      ]
    );
  };

  const canProceed = linkCount >= 10;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />

                {collection.is_public ? (
                  /* 이미 공개 중 */
                  <View style={styles.content}>
                    <Text style={styles.title}>전체공개 클립 🌐</Text>
                    <Text style={styles.subtitle}>현재 탐색 탭에 공개되어 있어요.</Text>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoText}>카테고리: {collection.category}</Text>
                      <Text style={styles.infoHint}>전체공개는 한 번 설정하면 취소할 수 없어요.</Text>
                    </View>
                    <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                      <Text style={styles.closeBtnText}>확인</Text>
                    </TouchableOpacity>
                  </View>
                ) : step === 1 ? (
                  /* Step 1: 카테고리 선택 */
                  <View style={styles.content}>
                    <Text style={styles.title}>전체공개로 전환</Text>
                    <Text style={styles.subtitle}>클립의 카테고리를 선택해주세요</Text>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryRow}
                    >
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.categoryPill, category === cat && styles.categoryPillActive]}
                          onPress={() => setCategory(cat)}
                        >
                          <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {!canProceed && (
                      <Text style={styles.linkHint}>
                        링크 10개 이상이어야 전체공개로 전환할 수 있어요 (현재 {linkCount}개)
                      </Text>
                    )}

                    <TouchableOpacity
                      style={[styles.nextBtn, (!category || !canProceed) && styles.nextBtnDisabled]}
                      onPress={() => category && canProceed && setStep(2)}
                      disabled={!category || !canProceed}
                    >
                      <Text style={styles.nextBtnText}>다음</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                      <Text style={styles.closeBtnText}>취소</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Step 2: 소개글 입력 */
                  <View style={styles.content}>
                    <Text style={styles.title}>클립 소개글</Text>
                    <Text style={styles.subtitle}>어떤 링크를 모았는지 알려주세요 (최소 20자)</Text>
                    <TextInput
                      style={styles.descInput}
                      placeholder="예: 2026년 상반기 마케터들이 실제로 참고한 쇼츠 광고 레퍼런스만 모았어요."
                      placeholderTextColor="#aaa"
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      maxLength={200}
                      textAlignVertical="top"
                      blurOnSubmit
                    />
                    <Text style={styles.charCount}>{description.length}/200</Text>

                    <View style={styles.btnRow}>
                      <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                        <Text style={styles.backBtnText}>이전</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.confirmBtn, description.trim().length < 20 && styles.confirmBtnDisabled]}
                        onPress={handleConfirm}
                        disabled={description.trim().length < 20 || saving}
                      >
                        {saving ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.confirmBtnText}>공개하기</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40, paddingHorizontal: 20, paddingTop: 12, minHeight: 320,
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  content: { gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 20 },

  categoryRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  categoryPill: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  categoryPillActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  categoryText: { fontSize: 14, color: '#555', fontWeight: '500' },
  categoryTextActive: { color: '#2563EB', fontWeight: '700' },

  linkHint: { fontSize: 12, color: '#EF4444', textAlign: 'center' },

  nextBtn: {
    backgroundColor: '#2563EB', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#93C5FD' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  descInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    padding: 14, fontSize: 14, color: '#111', height: 120, lineHeight: 22,
  },
  charCount: { fontSize: 12, color: '#999', textAlign: 'right', marginTop: -6 },

  btnRow: { flexDirection: 'row', gap: 10 },
  backBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  backBtnText: { fontSize: 15, color: '#555', fontWeight: '600' },
  confirmBtn: {
    flex: 2, backgroundColor: '#2563EB', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#93C5FD' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  infoBox: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB', gap: 6,
  },
  infoText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  infoHint: { fontSize: 12, color: '#999' },

  closeBtn: { paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { fontSize: 15, color: '#888' },
});
