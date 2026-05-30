import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TouchableWithoutFeedback,
  TextInput, StyleSheet, ScrollView, ActivityIndicator, Alert,
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

  const handleConfirm = async () => {
    if (linkCount < 10) {
      Alert.alert('링크 부족', `전체공개 전환은 링크 10개 이상 필요해요.\n현재 ${linkCount}개 저장되어 있어요.`);
      return;
    }
    if (!category) {
      Alert.alert('카테고리 선택', '카테고리를 선택해주세요.');
      return;
    }
    if (description.trim().length < 20) {
      Alert.alert('소개글 부족', '소개글은 20자 이상 입력해주세요.');
      return;
    }

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
  };

  const handleCancelPublic = async () => {
    Alert.alert('공개 취소', `"${collection.name}" 전체공개를 취소할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '공개 취소',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('collections').update({ is_public: false }).eq('id', collection.id);
          onConverted({ ...collection, is_public: false });
          reset();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.handle} />

              {/* 이미 공개 중인 경우 */}
              {collection.is_public ? (
                <View style={styles.content}>
                  <Text style={styles.title}>전체공개 클립</Text>
                  <Text style={styles.subtitle}>현재 탐색 탭에 공개되어 있어요.</Text>
                  <TouchableOpacity style={styles.cancelPublicBtn} onPress={handleCancelPublic}>
                    <Text style={styles.cancelPublicText}>공개 취소하기</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                    <Text style={styles.closeBtnText}>닫기</Text>
                  </TouchableOpacity>
                </View>
              ) : step === 1 ? (
                /* Step 1: 카테고리 선택 */
                <View style={styles.content}>
                  <Text style={styles.title}>전체공개로 전환</Text>
                  <Text style={styles.subtitle}>클립의 카테고리를 선택해주세요</Text>
                  <ScrollView style={styles.categoryScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.categoryGrid}>
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
                    </View>
                  </ScrollView>
                  <TouchableOpacity
                    style={[styles.nextBtn, !category && styles.nextBtnDisabled]}
                    onPress={() => category && setStep(2)}
                    disabled={!category}
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
                  />
                  <Text style={styles.charCount}>{description.length}/200</Text>

                  {linkCount < 10 && (
                    <View style={styles.warnBox}>
                      <Text style={styles.warnText}>⚠️ 링크가 {linkCount}개예요. 전체공개는 10개 이상 필요해요.</Text>
                    </View>
                  )}

                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                      <Text style={styles.backBtnText}>이전</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.confirmBtn, (description.trim().length < 20 || linkCount < 10) && styles.confirmBtnDisabled]}
                      onPress={handleConfirm}
                      disabled={description.trim().length < 20 || linkCount < 10 || saving}
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40, paddingHorizontal: 20, paddingTop: 12, minHeight: 360,
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  content: { gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 20 },

  categoryScroll: { maxHeight: 200 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryPill: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  categoryPillActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  categoryText: { fontSize: 14, color: '#555', fontWeight: '500' },
  categoryTextActive: { color: '#2563EB', fontWeight: '700' },

  nextBtn: {
    backgroundColor: '#2563EB', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  nextBtnDisabled: { backgroundColor: '#93C5FD' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  descInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    padding: 14, fontSize: 14, color: '#111', height: 120, lineHeight: 22,
  },
  charCount: { fontSize: 12, color: '#999', textAlign: 'right', marginTop: -6 },

  warnBox: {
    backgroundColor: '#FFF7ED', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  warnText: { fontSize: 13, color: '#92400E' },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
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

  cancelPublicBtn: {
    borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  cancelPublicText: { fontSize: 15, color: '#EF4444', fontWeight: '600' },

  closeBtn: { paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { fontSize: 15, color: '#888' },
});
