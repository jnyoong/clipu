import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  Image,
  ScrollView,
  TextInput,
  Share,
  Switch,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getDomain } from '../lib/og';
import { AppStackParamList } from '../App';
import { Collection } from './CollectionsScreen';
import SettingsModal from './SettingsModal';

type Member = { user_id: string; role: string; email: string };

type Link = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  collection_id: string | null;
  created_at: string;
};

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'Home'>;
};

export default function HomeScreen({ navigation }: Props) {
  const { session, signOut } = useAuth();
  const route = useRoute<RouteProp<AppStackParamList, 'Home'>>();
  const [links, setLinks] = useState<Link[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [addingCollection, setAddingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionIsShared, setNewCollectionIsShared] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [membersModal, setMembersModal] = useState<{ col: Collection; members: Member[]; loadingMembers: boolean } | null>(null);
  const inputRef = useRef<TextInput>(null);

  const fetchAll = async () => {
    const [linksRes, colsRes] = await Promise.all([
      supabase
        .from('links')
        .select('id, url, title, description, image_url, collection_id, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('collection_members')
        .select('role, collections(id, name, user_id, is_shared, invite_code, created_at)'),
    ]);
    if (!linksRes.error && linksRes.data) setLinks(linksRes.data);
    if (!colsRes.error && colsRes.data) {
      const cols: Collection[] = (colsRes.data as any[])
        .filter((m) => m.collections !== null)
        .sort((a, b) =>
          new Date(a.collections.created_at).getTime() - new Date(b.collections.created_at).getTime()
        )
        .map((m) => ({ ...m.collections, role: m.role as 'owner' | 'member' }));
      setCollections(cols);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchAll(); }, []));
  useEffect(() => { if (route.params?.joinedAt) fetchAll(); }, [route.params?.joinedAt]);

  const exitEditMode = () => {
    setEditMode(false);
    setSelectedLinks(new Set());
  };

  const handleSettingsPress = () => {
    Alert.alert('메뉴', undefined, [
      {
        text: '편집',
        onPress: () => setEditMode(true),
      },
      {
        text: '설정',
        onPress: () => setSettingsVisible(true),
      },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          Alert.alert('로그아웃', '로그아웃 하시겠어요?', [
            { text: '취소', style: 'cancel' },
            { text: '로그아웃', style: 'destructive', onPress: signOut },
          ]);
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const toggleLinkSelection = (id: string) => {
    setSelectedLinks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const count = selectedLinks.size;
    Alert.alert('링크 삭제', `선택한 링크 ${count}개를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const ids = Array.from(selectedLinks);
          await supabase.from('links').delete().in('id', ids);
          setLinks((prev) => prev.filter((l) => !selectedLinks.has(l.id)));
          setSelectedLinks(new Set());
        },
      },
    ]);
  };

  const handleDeleteCollectionInEditMode = (col: Collection) => {
    const hasLinks = links.some((l) => l.collection_id === col.id);
    if (hasLinks) {
      Alert.alert(
        '클립 삭제',
        `"${col.name}"에 링크가 있어요.\n삭제하면 링크가 미분류로 이동돼요. 계속할까요?`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
              await supabase.from('collections').delete().eq('id', col.id);
              setCollections((prev) => prev.filter((c) => c.id !== col.id));
              if (selectedCollectionId === col.id) setSelectedCollectionId('all');
            },
          },
        ]
      );
    } else {
      supabase.from('collections').delete().eq('id', col.id).then(() => {
        setCollections((prev) => prev.filter((c) => c.id !== col.id));
        if (selectedCollectionId === col.id) setSelectedCollectionId('all');
      });
    }
  };

  const handleDeleteCollection = (col: Collection) => {
    Alert.alert('클립 삭제', `"${col.name}"을 삭제할까요?\n안에 있는 링크는 미분류로 이동돼요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('collections').delete().eq('id', col.id);
          setCollections((prev) => prev.filter((c) => c.id !== col.id));
          if (selectedCollectionId === col.id) setSelectedCollectionId('all');
        },
      },
    ]);
  };

  const handleLeaveCollection = (col: Collection) => {
    Alert.alert('클립 나가기', `"${col.name}"에서 나갈까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('collection_members').delete()
            .eq('collection_id', col.id).eq('user_id', session!.user.id);
          setCollections((prev) => prev.filter((c) => c.id !== col.id));
          if (selectedCollectionId === col.id) setSelectedCollectionId('all');
        },
      },
    ]);
  };

  const shareInviteLink = async (col: Collection) => {
    if (!col.invite_code) return;
    try {
      await Share.share({
        message: `"${col.name}" 클립에 초대합니다!\nhttps://jnyoong.github.io/clipu/join?code=${col.invite_code}`,
      });
    } catch (_) {}
  };

  const handleConvertToShared = (col: Collection) => {
    Alert.alert(
      '공유 클립으로 전환',
      `"${col.name}"을 공유 클립으로 전환할까요?\n초대 링크로 최대 30명까지 함께 사용할 수 있어요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '전환',
          onPress: async () => {
            const updates: Record<string, any> = { is_shared: true };
            if (!col.invite_code) updates.invite_code = Math.random().toString(36).substring(2, 10);
            const { data, error } = await supabase
              .from('collections').update(updates).eq('id', col.id)
              .select('id, name, user_id, is_shared, invite_code').single();
            if (!error && data) {
              setCollections((prev) => prev.map((c) => c.id === col.id ? { ...data, role: col.role } : c));
              Alert.alert('전환 완료', `"${col.name}"이 공유 클립으로 전환됐어요!`);
            }
          },
        },
      ]
    );
  };

  const handleViewMembers = async (col: Collection) => {
    setMembersModal({ col, members: [], loadingMembers: true });
    const { data, error } = await supabase.rpc('get_collection_members', { coll_id: col.id });
    if (!error && data) {
      setMembersModal({ col, members: data as Member[], loadingMembers: false });
    } else {
      setMembersModal((prev) => prev ? { ...prev, loadingMembers: false } : null);
    }
  };

  const handleCollectionTabLongPress = (col: Collection) => {
    const buttons: any[] = [];
    if (col.is_shared) {
      buttons.push({ text: '초대 링크 공유', onPress: () => shareInviteLink(col) });
      buttons.push({ text: '공유 멤버 보기', onPress: () => handleViewMembers(col) });
    } else if (col.role === 'owner') {
      buttons.push({ text: '공유 클립으로 전환', onPress: () => handleConvertToShared(col) });
    }
    if (col.role === 'owner') {
      buttons.push({ text: '클립 삭제', style: 'destructive', onPress: () => handleDeleteCollection(col) });
    } else {
      buttons.push({ text: '클립 나가기', style: 'destructive', onPress: () => handleLeaveCollection(col) });
    }
    buttons.push({ text: '취소', style: 'cancel' });
    Alert.alert(col.name, undefined, buttons);
  };

  const handleCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) {
      setAddingCollection(false);
      setNewCollectionName('');
      setNewCollectionIsShared(false);
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from('collections')
      .insert({ user_id: session!.user.id, name, is_shared: newCollectionIsShared })
      .select('id, name, user_id, is_shared, invite_code').single();
    setCreating(false);
    if (!error && data) {
      setCollections((prev) => [...prev, { ...data, role: 'owner' as const }]);
      setSelectedCollectionId(data.id);
    }
    setAddingCollection(false);
    setNewCollectionName('');
    setNewCollectionIsShared(false);
  };

  const openAddCollection = () => {
    setAddingCollection(true);
    setNewCollectionName('');
    setNewCollectionIsShared(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const filteredLinks =
    selectedCollectionId === 'all'
      ? links
      : selectedCollectionId === null
      ? links.filter((l) => l.collection_id === null)
      : links.filter((l) => l.collection_id === selectedCollectionId);

  const renderCard = ({ item }: { item: Link }) => {
    const isSelected = selectedLinks.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.card, editMode && isSelected && styles.cardSelected]}
        onPress={editMode ? () => toggleLinkSelection(item.id) : () => Linking.openURL(item.url)}
        onLongPress={editMode ? undefined : () => {
          Alert.alert('삭제', '이 링크를 삭제할까요?', [
            { text: '취소', style: 'cancel' },
            { text: '삭제', style: 'destructive', onPress: async () => {
              await supabase.from('links').delete().eq('id', item.id);
              setLinks((prev) => prev.filter((l) => l.id !== item.id));
            }},
          ]);
        }}
        activeOpacity={0.7}
      >
        {editMode && (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Text style={styles.checkboxTick}>✓</Text>}
          </View>
        )}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title || item.url}</Text>
          <Text style={styles.cardDomain} numberOfLines={1}>{getDomain(item.url)}</Text>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const tabs: Array<{ id: string | null | 'all'; label: string; col?: Collection }> = [
    { id: 'all', label: '전체' },
    ...collections.map((c) => ({ id: c.id, label: c.name, col: c })),
    { id: null, label: '미분류' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Clipu</Text>
        {editMode ? (
          <TouchableOpacity onPress={exitEditMode}>
            <Text style={styles.editDone}>완료</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSettingsPress} style={styles.settingsBtnWrap}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((tab) => (
            <View key={String(tab.id)} style={styles.tabWrap}>
              <TouchableOpacity
                style={[styles.tab, selectedCollectionId === tab.id && styles.tabActive]}
                onPress={() => !editMode && setSelectedCollectionId(tab.id)}
                onLongPress={() => !editMode && tab.col && handleCollectionTabLongPress(tab.col)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, selectedCollectionId === tab.id && styles.tabTextActive]}>
                  {tab.col?.is_shared ? '🔗 ' : ''}{tab.label}
                </Text>
              </TouchableOpacity>
              {editMode && tab.col && (
                <TouchableOpacity
                  style={styles.tabDeleteBadge}
                  onPress={() => handleDeleteCollectionInEditMode(tab.col!)}
                >
                  <Text style={styles.tabDeleteBadgeText}>−</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {!editMode && (
            <TouchableOpacity style={styles.tabAdd} onPress={openAddCollection}>
              <Text style={styles.tabAddText}>＋</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {!editMode && addingCollection && (
        <View style={styles.addCollectionContainer}>
          <View style={styles.addCollectionRow}>
            <TextInput
              ref={inputRef}
              style={styles.addCollectionInput}
              placeholder="클립 이름 입력"
              placeholderTextColor="#aaa"
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              onSubmitEditing={handleCreateCollection}
              returnKeyType="done"
              editable={!creating}
            />
            {creating ? (
              <ActivityIndicator color="#2563EB" style={{ marginHorizontal: 12 }} />
            ) : (
              <>
                <TouchableOpacity style={styles.addCollectionConfirm} onPress={handleCreateCollection}>
                  <Text style={styles.addCollectionConfirmText}>확인</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addCollectionCancel}
                  onPress={() => { setAddingCollection(false); setNewCollectionName(''); setNewCollectionIsShared(false); }}
                >
                  <Text style={styles.addCollectionCancelText}>취소</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <View style={styles.sharedToggleRow}>
            <Text style={styles.sharedToggleLabel}>공유 클립</Text>
            <Switch
              value={newCollectionIsShared}
              onValueChange={setNewCollectionIsShared}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={newCollectionIsShared ? '#2563EB' : '#f4f3f4'}
              disabled={creating}
            />
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={styles.loader} color="#2563EB" size="large" />
      ) : filteredLinks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>저장된 링크가 없어요</Text>
          {!editMode && <Text style={styles.emptyHint}>아래 + 버튼으로 첫 링크를 저장해보세요</Text>}
        </View>
      ) : (
        <FlatList
          data={filteredLinks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderCard}
        />
      )}

      {editMode && selectedLinks.size > 0 && (
        <TouchableOpacity style={styles.deleteBar} onPress={handleDeleteSelected}>
          <Text style={styles.deleteBarText}>{selectedLinks.size}개 링크 삭제</Text>
        </TouchableOpacity>
      )}

      {!editMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() =>
            navigation.navigate('AddLink', {
              collectionId: selectedCollectionId === 'all' ? null : selectedCollectionId,
            })
          }
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {session && (
        <SettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          session={session}
          onSignOut={signOut}
        />
      )}

      {membersModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setMembersModal(null)}>
          <TouchableWithoutFeedback onPress={() => setMembersModal(null)}>
            <View style={styles.membersOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.membersSheet}>
                  <View style={styles.membersHandle} />
                  <View style={styles.membersHeader}>
                    <Text style={styles.membersTitle}>{membersModal.col.name}</Text>
                    <TouchableOpacity onPress={() => setMembersModal(null)} style={styles.membersCloseBtn}>
                      <Ionicons name="close" size={22} color="#888" />
                    </TouchableOpacity>
                  </View>
                  {membersModal.loadingMembers ? (
                    <ActivityIndicator color="#2563EB" style={{ marginVertical: 24 }} />
                  ) : (
                    <>
                      <Text style={styles.membersCount}>멤버 {membersModal.members.length}명 / 30명</Text>
                      <FlatList
                        data={membersModal.members}
                        keyExtractor={(m) => m.user_id}
                        style={{ width: '100%', maxHeight: 300 }}
                        renderItem={({ item }) => (
                          <View style={styles.memberRow}>
                            <View style={styles.memberInfo}>
                              <Text style={styles.memberEmail} numberOfLines={1}>
                                {item.email || item.user_id.slice(0, 8) + '...'}
                              </Text>
                              {item.user_id === session?.user.id && (
                                <Text style={styles.memberMe}>나</Text>
                              )}
                            </View>
                            {item.role === 'owner' && <Text style={styles.memberOwner}>방장</Text>}
                          </View>
                        )}
                      />
                    </>
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  logo: { fontSize: 24, fontWeight: '700', color: '#2563EB' },
  settingsBtnWrap: { padding: 2 },
  editDone: { fontSize: 15, color: '#2563EB', fontWeight: '600' },
  tabsWrapper: {
    height: 52, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  tabs: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  tabWrap: { position: 'relative', marginRight: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignSelf: 'center',
  },
  tabActive: { backgroundColor: '#2563EB' },
  tabText: { fontSize: 13, color: '#555', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  tabDeleteBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', zIndex: 1,
  },
  tabDeleteBadgeText: { color: '#fff', fontSize: 14, fontWeight: 'bold', lineHeight: 18 },
  tabAdd: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#D1D5DB', alignSelf: 'center', marginRight: 8,
  },
  tabAddText: { fontSize: 14, color: '#888', lineHeight: 18 },
  addCollectionContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  addCollectionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 8,
  },
  sharedToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  sharedToggleLabel: { fontSize: 13, color: '#555' },
  addCollectionInput: {
    flex: 1, borderWidth: 1, borderColor: '#2563EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: '#111',
  },
  addCollectionConfirm: { backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addCollectionConfirmText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  addCollectionCancel: { paddingHorizontal: 8, paddingVertical: 8 },
  addCollectionCancelText: { color: '#888', fontSize: 14 },
  loader: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#555', marginBottom: 8 },
  emptyHint: { fontSize: 13, color: '#999' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardSelected: { borderWidth: 2, borderColor: '#2563EB' },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB',
    marginLeft: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  checkboxSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  cardImage: { width: 72, height: 72, backgroundColor: '#F3F4F6', flexShrink: 0 },
  cardImagePlaceholder: { backgroundColor: '#E5E7EB' },
  cardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111', lineHeight: 20 },
  cardDomain: { fontSize: 11, color: '#2563EB' },
  cardDesc: { fontSize: 12, color: '#777', lineHeight: 17, marginTop: 1 },
  deleteBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#EF4444', paddingVertical: 18, alignItems: 'center',
  },
  deleteBarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  fab: {
    position: 'absolute', bottom: 40, right: 24,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
  membersOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  membersSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: 40, paddingHorizontal: 20, alignItems: 'center',
  },
  membersHandle: { width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginBottom: 16 },
  membersHeader: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between', marginBottom: 4 },
  membersTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  membersCloseBtn: { padding: 4 },
  membersCount: { fontSize: 14, color: '#2563EB', fontWeight: '600', marginBottom: 16, alignSelf: 'flex-start' },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', width: '100%',
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  memberEmail: { fontSize: 14, color: '#333', flex: 1 },
  memberMe: {
    fontSize: 11, color: '#2563EB', backgroundColor: '#EFF6FF',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  memberOwner: {
    fontSize: 11, color: '#fff', backgroundColor: '#2563EB',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
  },
});
