import {
  ChevronRight16Regular,
  Checkmark16Regular,
  Dismiss16Regular,
  Emoji16Regular,
  Info24Regular,
  NumberSymbol16Regular,
  NumberSymbol24Regular,
  Person16Regular,
  Play32Regular,
  Video24Regular,
} from "@fluentui/react-native-icons";
import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import * as VideoThumbnails from "expo-video-thumbnails";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmojiKeyboard, type EmojiType } from "rn-emoji-keyboard";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchCircleDeclarations,
  fetchCircleTopicOptions,
  fetchCircleUploadSign,
  publishCircleVideo,
  type CircleTopicOption,
} from "@/features/circle/circle-publish.api";
import {
  activeTriggerDraft,
  applyTriggerSelection,
  buildCircleContentRefs,
} from "@/features/circle/circle-publish-entities";
import { uploadVideoToVod } from "@/features/circle/vod-upload";
import {
  beginVideoPick,
  type VideoPickResult,
} from "@/shared/media-picker/media-picker-session";
import { useMessageStore } from "@/features/message/message-store";
import { getConversationDisplayTitle } from "@/features/message/message-title";
import {
  isSelfConversationId,
  isSystemConversationId,
} from "@/features/message/system-conversations";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { APP_LINKS } from "@/core/config/links";
import { openInAppWebView } from "@/shared/navigation/open-web-view";
import { requireLogin } from "@/shared/navigation/require-login";
import { showToast } from "@/shared/ui/app-toast";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { SYSTEM_FONT } from "@/shared/theme/typography";

const atIcon = require("../../../../assets/svgs/circle-comment-at.svg");
const emojiIcon = require("../../../../assets/svgs/circle-comment-emoji.svg");
const FALLBACK_AVATAR = require("../../../../assets/images/radar-avatar-1.png");

type PublishPanel = "none" | "topic" | "mention" | "emoji";

type UploadState = {
  status: "uploading" | "success" | "failed";
  percent: number;
  vid?: string;
};

type MentionUser = {
  id: string;
  nickname: string;
  avatar?: string;
};

/** 标题/正文的字数按 Unicode 码点计（与后端校验一致）。 */
const codePointLength = (text: string) => Array.from(text).length;

export default function CirclePublishScreen() {
  const insets = useSafeAreaInsets();
  const accessToken = useAuthStore((state) => state.accessToken);
  const viewerUserId = useAuthStore((state) => state.user?.id);
  const conversations = useMessageStore((state) => state.conversations);
  const blacklistedUserIds = useMessageStore((state) => state.blacklistedUserIds);
  const messageConnectionState = useMessageStore((state) => state.connectionState);
  const refreshConversations = useMessageStore((state) => state.refreshConversations);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [video, setVideo] = useState<VideoPickResult | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<CircleTopicOption[]>([]);
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);
  const [declarations, setDeclarations] = useState<string[]>([]);
  const [declarationDraft, setDeclarationDraft] = useState<string[]>([]);
  const [declarationOptions, setDeclarationOptions] = useState<string[]>([]);
  const [declarationSheetOpen, setDeclarationSheetOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [panel, setPanel] = useState<PublishPanel>("none");
  const [focusedField, setFocusedField] = useState<"title" | "content" | null>(null);
  const [topicOptions, setTopicOptions] = useState<CircleTopicOption[]>([]);
  const [topicLoading, setTopicLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const uploadCancelledRef = useRef(false);

  useEffect(() => {
    fetchCircleDeclarations()
      .then(setDeclarationOptions)
      .catch(() => {
        // 声明选项弱依赖：失败时打开弹层再重试
      });
  }, []);

  const mentionUsers = useMemo<MentionUser[]>(
    () =>
      conversations
        .filter(
          (conversation) =>
            !isSystemConversationId(conversation.id) &&
            !isSelfConversationId(conversation.id, viewerUserId) &&
            !blacklistedUserIds.includes(conversation.id),
        )
        .map((conversation) => ({
          id: conversation.id,
          nickname: getConversationDisplayTitle(
            conversation.id,
            conversation.title,
            conversation.note,
          ),
          avatar: conversation.avatar,
        })),
    [blacklistedUserIds, conversations, viewerUserId],
  );

  const topicKeyword = useMemo(() => {
    if (panel !== "topic") {
      return "";
    }
    const draft = activeTriggerDraft(content);
    if (draft && draft.trigger === "#") {
      return draft.keyword;
    }
    return "";
  }, [content, panel]);

  // 话题面板打开/关键词变化时拉取候选（空关键词=热榜前 N）
  useEffect(() => {
    if (panel !== "topic") {
      return;
    }
    const timer = setTimeout(() => {
      setTopicLoading(true);
      fetchCircleTopicOptions({ keyword: topicKeyword })
        .then(setTopicOptions)
        .catch(() => {
          setTopicOptions([]);
        })
        .finally(() => {
          setTopicLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [panel, topicKeyword]);

  const startUpload = useCallback(
    async (picked: VideoPickResult) => {
      const token = accessToken;
      if (!token) {
        return;
      }
      uploadCancelledRef.current = false;
      setUpload({ status: "uploading", percent: 0 });
      try {
        const sign = await fetchCircleUploadSign({
          filename: picked.filename,
          token,
        });
        const vid = await uploadVideoToVod({
          uri: picked.uri,
          fileSize: picked.fileSize,
          filename: picked.filename,
          sign,
          onProgress: (percent) => {
            setUpload((current) =>
              current?.status === "uploading" ? { ...current, percent } : current,
            );
          },
          cancelled: () => uploadCancelledRef.current,
        });
        setUpload({ status: "success", percent: 100, vid });
      } catch (error) {
        setUpload({ status: "failed", percent: 0 });
        showToast(error instanceof Error ? error.message : "视频上传未完成，请重试");
      }
    },
    [accessToken],
  );

  const handlePickVideo = useCallback(async () => {
    if (!requireLogin()) {
      return;
    }
    const picked = await beginVideoPick();
    router.push({ pathname: "/media-picker", params: { media: "video" } });
    if (!picked) {
      return;
    }
    setVideo(picked);
    setUpload(null);
    setCoverUri(null);
    // 封面弱依赖：取第 1 秒帧，失败沿用深色占位
    VideoThumbnails.getThumbnailAsync(picked.uri, { time: 1000 })
      .then((result) => {
        setCoverUri(result.uri);
      })
      .catch(() => {
        // 忽略封面生成失败
      });
    void startUpload(picked);
  }, [startUpload]);

  const handleRemoveVideo = () => {
    uploadCancelledRef.current = true;
    setVideo(null);
    setUpload(null);
    setCoverUri(null);
  };

  const handleRetryUpload = () => {
    if (!video) {
      return;
    }
    void startUpload(video);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    const draft = activeTriggerDraft(value);
    if (draft) {
      setPanel(draft.trigger === "#" ? "topic" : "mention");
    } else {
      setPanel((current) => (current === "emoji" ? current : "none"));
    }
    // 实体同步：正文里被删掉的已选项不再提交
    setSelectedTopics((current) =>
      current.filter((topic) => value.includes(`#${topic.topicName}`)),
    );
    setMentionedUsers((current) =>
      current.filter((user) => value.includes(`@${user.nickname}`)),
    );
  };

  const handleTopicSelect = (option: CircleTopicOption) => {
    setSelectedTopics((current) =>
      current.some((topic) => topic.topicId === option.topicId)
        ? current
        : [...current, option],
    );
    setContent((current) => applyTriggerSelection(current, "#", option.topicName));
    setPanel("none");
  };

  const handleMentionSelect = (user: MentionUser) => {
    setMentionedUsers((current) =>
      current.some((item) => item.id === user.id) ? current : [...current, user],
    );
    setContent((current) => applyTriggerSelection(current, "@", user.nickname));
    setPanel("none");
  };

  const handleTopicChipPress = () => {
    setPanel("topic");
    setContent((current) => (current.endsWith("#") ? current : `${current}#`));
  };

  const handleMentionChipPress = () => {
    if (!requireLogin() || !accessToken) {
      return;
    }
    setPanel("mention");
    setContent((current) => (current.endsWith("@") ? current : `${current}@`));
    void refreshConversations(accessToken);
  };

  // 与聊天输入一致：选中表情只追加草稿，面板保持展开
  const handleEmojiSelect = useCallback((emoji: EmojiType) => {
    setContent((current) => {
      if (codePointLength(current) + codePointLength(emoji.emoji) > 1000) {
        return current;
      }
      return `${current}${emoji.emoji}`;
    });
  }, []);

  const handleEmojiChipPress = () => {
    if (panel === "emoji") {
      setPanel("none");
      return;
    }
    setPanel("emoji");
    Keyboard.dismiss();
  };

  const handleDone = () => {
    setPanel("none");
    Keyboard.dismiss();
  };

  const handlePublish = async () => {
    if (sending) {
      return;
    }
    if (!requireLogin()) {
      return;
    }
    const token = accessToken;
    if (!token) {
      return;
    }
    const titleText = title.trim();
    if (!video) {
      showToast("请先选择视频");
      return;
    }
    if (!titleText) {
      showToast("请输入视频标题");
      return;
    }
    if (codePointLength(titleText) > 20) {
      showToast("标题不能超过 20 字");
      return;
    }
    if (!content.trim()) {
      showToast("请输入正文内容");
      return;
    }
    if (codePointLength(content) > 1000) {
      showToast("正文不能超过 1000 字");
      return;
    }
    if (!agreed) {
      showToast("请先阅读并同意《盼之电竞社区公约》");
      return;
    }
    if (declarations.length === 0) {
      showToast("请至少选择一项自主声明");
      return;
    }
    if (upload?.status === "uploading") {
      showToast("视频上传中，请稍候");
      return;
    }
    if (upload?.status !== "success" || !upload.vid) {
      showToast("视频上传未完成，请重试");
      return;
    }
    setSending(true);
    try {
      // 正文不单独 trim：实体 offset 与提交文本必须逐字对应
      await publishCircleVideo({
        vid: upload.vid,
        title: titleText,
        content,
        topics: buildCircleContentRefs(
          content,
          selectedTopics.map((topic) => ({ id: topic.topicId, label: topic.topicName })),
          "#",
        ),
        mentions: buildCircleContentRefs(
          content,
          mentionedUsers.map((user) => ({ id: user.id, label: user.nickname })),
          "@",
        ),
        declarations,
        token,
      });
      showToast("发布成功，待审核");
      router.back();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "发布失败，请重试");
    } finally {
      setSending(false);
    }
  };

  const inputActive = focusedField === "content" || panel !== "none";
  const publishReady =
    Boolean(video) &&
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    agreed &&
    declarations.length > 0 &&
    upload?.status === "success";
  const mentionLoading =
    messageConnectionState === "idle" || messageConnectionState === "connecting";

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="发视频"
        onBack={() => {
          router.back();
        }}
        style={{ paddingTop: insets.top }}
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="添加标题"
            placeholderTextColor="#CACACC"
            style={styles.titleInput}
            maxLength={20}
            returnKeyType="done"
            onFocus={() => {
              setFocusedField("title");
            }}
            onBlur={() => {
              setFocusedField(null);
            }}
          />
          <Text
            style={[styles.titleCount, title.length > 0 && styles.titleCountFilled]}
          >
            {codePointLength(title)}/20
          </Text>
        </View>

        <TextInput
          value={content}
          onChangeText={handleContentChange}
          placeholder="添加作品描述"
          placeholderTextColor="#CACACC"
          style={styles.contentInput}
          maxLength={1000}
          multiline
          textAlignVertical="top"
          onFocus={() => {
            setFocusedField("content");
            setPanel((current) => (current === "none" ? "none" : current));
          }}
          onBlur={() => {
            setFocusedField(null);
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="选择视频"
          style={styles.uploadTile}
          onPress={() => {
            if (upload?.status === "failed") {
              handleRetryUpload();
              return;
            }
            if (!video) {
              void handlePickVideo();
            }
          }}
        >
          {video ? (
            <View style={styles.tileInner}>
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.tileCover} contentFit="cover" />
              ) : (
                <View style={styles.tileCoverPlaceholder} />
              )}
              <View pointerEvents="none" style={styles.tilePlayWrap}>
                <Play32Regular color="#FFFFFF" width={32} height={32} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="移除视频"
                onPress={handleRemoveVideo}
                style={styles.tileDelete}
              >
                <Dismiss16Regular color="#FFFFFF" width={10} height={10} />
              </Pressable>
              {upload?.status === "uploading" ? (
                <View style={styles.tileProgress}>
                  <Text style={styles.tileProgressText}>{upload.percent}%</Text>
                </View>
              ) : null}
              {upload?.status === "failed" ? (
                <View style={styles.tileProgress}>
                  <Text style={styles.tileProgressText}>点击重试</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.tileEmpty}>
              <Video24Regular color="#979799" width={28} height={28} />
              <Text style={styles.tileEmptyText}>添加视频</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.chipRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="插入话题"
            style={styles.chip}
            onPress={handleTopicChipPress}
          >
            <NumberSymbol16Regular color="#0D0D0F" width={16} height={16} />
            <Text style={styles.chipText}>话题</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="插入表情"
            style={styles.chip}
            onPress={handleEmojiChipPress}
          >
            <Emoji16Regular color="#0D0D0F" width={16} height={16} />
            <Text style={styles.chipText}>表情</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="提及用户"
            style={styles.chip}
            onPress={handleMentionChipPress}
          >
            <Person16Regular color="#0D0D0F" width={16} height={16} />
            <Text style={styles.chipText}>用户</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="选择自主声明"
          style={styles.declarationRow}
          onPress={() => {
            setDeclarationDraft(declarations);
            setDeclarationSheetOpen(true);
          }}
        >
          <Info24Regular color="#0D0D0F" width={18} height={18} />
          <Text style={styles.declarationLabel}>自主声明</Text>
          <Text
            numberOfLines={1}
            style={[
              styles.declarationValue,
              declarations.length > 0 && styles.declarationValueFilled,
            ]}
          >
            {declarations.length > 0 ? declarations.join("、") : "请选择自主声明"}
          </Text>
          <ChevronRight16Regular color="#CACACC" width={16} height={16} />
        </Pressable>
        <View style={styles.divider} />
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={inputActive}
      >
        {inputActive ? (
          <View style={styles.keyboardArea}>
            {panel === "topic" ? (
              <TopicPanel
                options={topicOptions}
                loading={topicLoading}
                onSelect={handleTopicSelect}
              />
            ) : null}
            {panel === "mention" ? (
              <MentionPanel
                users={mentionUsers}
                loading={mentionLoading}
                onSelect={handleMentionSelect}
              />
            ) : null}
            <View style={styles.keyboardBar}>
              <View style={styles.keyboardIcons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="插入话题"
                  onPressIn={handleTopicChipPress}
                  style={styles.keyboardIconButton}
                >
                  <NumberSymbol24Regular color="#333333" width={24} height={24} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="插入表情"
                  onPressIn={handleEmojiChipPress}
                  style={styles.keyboardIconButton}
                >
                  <Image source={emojiIcon} style={styles.keyboardIcon} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="提及用户"
                  onPressIn={handleMentionChipPress}
                  style={styles.keyboardIconButton}
                >
                  <Image source={atIcon} style={styles.keyboardIcon} />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="完成"
                onPress={handleDone}
                style={styles.doneButton}
              >
                <Text style={styles.doneText}>完成</Text>
              </Pressable>
            </View>
            {panel === "emoji" ? (
              <View style={[styles.emojiPanel, { height: 340 + insets.bottom + 10 }]}>
                <EmojiKeyboard
                  categoryPosition="bottom"
                  disableSafeArea
                  enableRecentlyUsed
                  hideHeader
                  onEmojiSelected={handleEmojiSelect}
                  styles={{
                    container: {
                      paddingBottom: insets.bottom + 10,
                      borderRadius: 0,
                      elevation: 0,
                      shadowOpacity: 0,
                    },
                  }}
                  theme={{
                    container: "#FFFFFF",
                    header: "#333333",
                    category: { icon: "#999999", iconActive: "#FE1F4C" },
                  }}
                />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              onPress={() => {
                setAgreed((current) => !current);
              }}
              style={styles.agreeRow}
            >
              <View style={[styles.agreeCheck, agreed && styles.agreeChecked]}>
                {agreed ? (
                  <Checkmark16Regular color="#FFFFFF" width={10} height={10} />
                ) : null}
              </View>
              <Text style={styles.agreeText}>
                我已阅读并同意
                <Text
                  style={styles.agreeLink}
                  onPress={() => {
                    openInAppWebView(APP_LINKS.communityAgreement, "盼之电竞社区公约");
                  }}
                >
                  《盼之电竞社区公约》
                </Text>
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="发布"
              disabled={!publishReady || sending}
              onPress={handlePublish}
              style={({ pressed }) => [
                styles.publishButton,
                !publishReady && styles.publishButtonDisabled,
                pressed && publishReady && styles.publishButtonPressed,
              ]}
            >
              <Text style={styles.publishText}>{sending ? "发布中" : "发布"}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <DeclarationSheet
        visible={declarationSheetOpen}
        options={declarationOptions}
        selected={declarationDraft}
        onToggle={(option) => {
          setDeclarationDraft((current) =>
            current.includes(option)
              ? current.filter((item) => item !== option)
              : [...current, option],
          );
        }}
        onClose={() => {
          setDeclarationSheetOpen(false);
        }}
        onConfirm={() => {
          setDeclarations(declarationDraft);
          setDeclarationSheetOpen(false);
        }}
      />
    </View>
  );
}

/** 话题候选面板：行 = 话题名，选中即回写正文。 */
function TopicPanel({
  options,
  loading,
  onSelect,
}: {
  options: CircleTopicOption[];
  loading: boolean;
  onSelect: (option: CircleTopicOption) => void;
}) {
  return (
    <View style={styles.topicPanel}>
      {loading && options.length === 0 ? (
        <ActivityIndicator color="#999999" size="small" style={styles.panelLoading} />
      ) : options.length === 0 ? (
        <Text style={styles.panelEmptyText}>没有找到相关话题</Text>
      ) : (
        <ScrollView style={styles.panelScroll} bounces={false}>
          {options.map((option) => (
            <Pressable
              key={option.topicId || option.topicName}
              accessibilityRole="button"
              accessibilityLabel={`选择话题 ${option.topicName}`}
              onPress={() => {
                onSelect(option);
              }}
              style={styles.topicRow}
            >
              <Text style={styles.topicName} numberOfLines={1}>
                #{option.topicName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** @用户候选面板：行 = 头像 + 昵称，数据来自消息会话。 */
function MentionPanel({
  users,
  loading,
  onSelect,
}: {
  users: MentionUser[];
  loading: boolean;
  onSelect: (user: MentionUser) => void;
}) {
  return (
    <View style={styles.mentionPanel}>
      {loading && users.length === 0 ? (
        <ActivityIndicator color="#999999" size="small" style={styles.panelLoading} />
      ) : users.length === 0 ? (
        <Text style={styles.panelEmptyText}>暂无可@用户</Text>
      ) : (
        <ScrollView style={styles.panelScroll} bounces={false}>
          {users.map((user) => (
            <Pressable
              key={user.id}
              accessibilityRole="button"
              accessibilityLabel={`提及 ${user.nickname}`}
              onPress={() => {
                onSelect(user);
              }}
              style={styles.mentionRow}
            >
              <Image
                source={user.avatar ? { uri: user.avatar } : FALLBACK_AVATAR}
                style={styles.mentionAvatar}
                contentFit="cover"
              />
              <Text style={styles.mentionName} numberOfLines={1}>
                {user.nickname}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** 自主声明多选弹层（草稿状态由父组件持有，确认时才落盘）。 */
function DeclarationSheet({
  visible,
  options,
  selected,
  onToggle,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      contentStyle={styles.declarationSheet}
    >
      <Text style={styles.declarationSheetTitle}>自主声明</Text>
      <ScrollView style={styles.declarationSheetScroll} bounces={false}>
        {options.map((option) => {
          const checked = selected.includes(option);
          return (
            <Pressable
              key={option}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() => {
                onToggle(option);
              }}
              style={styles.declarationOptionRow}
            >
              <View style={[styles.declarationCheck, checked && styles.declarationChecked]}>
                {checked ? (
                  <Checkmark16Regular color="#FFFFFF" width={10} height={10} />
                ) : null}
              </View>
              <Text style={styles.declarationOptionText}>{option}</Text>
            </Pressable>
          );
        })}
        {options.length === 0 ? (
          <Text style={styles.panelEmptyText}>加载中，请稍后</Text>
        ) : null}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="确定自主声明"
        disabled={selected.length === 0}
        onPress={onConfirm}
        style={({ pressed }) => [
          styles.declarationConfirm,
          selected.length === 0 && styles.declarationConfirmDisabled,
          pressed && selected.length > 0 && styles.publishButtonPressed,
        ]}
      >
        <Text style={styles.declarationConfirmText}>确定</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  titleInput: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: "#0D0D0F",
    paddingVertical: 0,
  },
  titleCount: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#CACACC",
  },
  titleCountFilled: {
    color: "#7F7F80",
  },
  contentInput: {
    minHeight: 160,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F5F6F7",
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 24,
    color: "#0D0D0F",
    marginBottom: 12,
  },
  uploadTile: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: "#F5F6F7",
    overflow: "hidden",
    marginBottom: 12,
  },
  tileInner: {
    width: "100%",
    height: "100%",
  },
  tileCover: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1A1A1A",
  },
  tileCoverPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1A1A1A",
  },
  tilePlayWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  tileDelete: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderBottomLeftRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileProgress: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileProgressText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#FFFFFF",
  },
  tileEmpty: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tileEmptyText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    color: "#7F7F80",
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#F5F6F7",
  },
  chipText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    color: "#0D0D0F",
  },
  declarationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 0,
    paddingRight: 16,
  },
  declarationLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    color: "#0D0D0F",
  },
  declarationValue: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    color: "#CACACC",
  },
  declarationValueFilled: {
    color: "#0D0D0F",
  },
  divider: {
    height: 0.5,
    backgroundColor: "#EBEBEB",
  },
  keyboardArea: {
    borderTopWidth: 0.5,
    borderTopColor: "#EBEBEB",
    backgroundColor: "#FFFFFF",
  },
  keyboardBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  keyboardIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  keyboardIconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  keyboardIcon: {
    width: 24,
    height: 24,
  },
  doneButton: {
    paddingHorizontal: 8,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    color: "#0D0D0F",
  },
  topicPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: "#F5F6F7",
    maxHeight: 240,
  },
  mentionPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    maxHeight: 240,
  },
  panelScroll: {
    paddingVertical: 4,
  },
  panelLoading: {
    marginVertical: 20,
  },
  panelEmptyText: {
    marginVertical: 20,
    textAlign: "center",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#979799",
  },
  topicRow: {
    height: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  topicName: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#0D0D0F",
  },
  mentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  mentionAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EBEBEB",
  },
  mentionName: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#0D0D0F",
  },
  emojiPanel: {
    backgroundColor: "#FFFFFF",
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "#EBEBEB",
  },
  agreeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  agreeCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CACACC",
    alignItems: "center",
    justifyContent: "center",
  },
  agreeChecked: {
    borderColor: "#FE1F4C",
    backgroundColor: "#FE1F4C",
  },
  agreeText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#7F7F80",
  },
  agreeLink: {
    color: "#0D0D0F",
    textDecorationLine: "underline",
  },
  publishButton: {
    height: 42,
    borderRadius: 8,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  publishButtonDisabled: {
    backgroundColor: "#FF708D",
    opacity: 0.6,
  },
  publishButtonPressed: {
    opacity: 0.85,
  },
  publishText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  declarationSheet: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  declarationSheetTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: "600",
    color: "#0D0D0F",
    textAlign: "center",
    marginBottom: 8,
  },
  declarationSheetScroll: {
    maxHeight: 300,
  },
  declarationOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 52,
  },
  declarationCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#CACACC",
    alignItems: "center",
    justifyContent: "center",
  },
  declarationChecked: {
    borderColor: "#FE1F4C",
    backgroundColor: "#FE1F4C",
  },
  declarationOptionText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    color: "#0D0D0F",
  },
  declarationConfirm: {
    marginTop: 12,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  declarationConfirmDisabled: {
    backgroundColor: "#FF708D",
    opacity: 0.6,
  },
  declarationConfirmText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
  },
});
