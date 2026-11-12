import { useAuthStore } from "@esports/auth";
import { Checkmark16Regular, Dismiss16Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmojiKeyboard, type EmojiType } from "rn-emoji-keyboard";

import { APP_LINKS } from "@/core/config/links";
import {
  activeTriggerDraft,
  applyTriggerSelection,
  buildCircleContentRefs,
} from "@/features/circle/circle-publish-entities";
import {
  fetchCircleDeclarations,
  fetchCircleTopicOptions,
  fetchCircleUploadSign,
  publishCircleVideo,
  type CircleTopicOption,
} from "@/features/circle/circle-publish.api";
import { uploadVideoToVod } from "@/features/circle/vod-upload";
import { useMessageStore } from "@/features/message/message-store";
import { getConversationDisplayTitle } from "@/features/message/message-title";
import {
  isSelfConversationId,
  isSystemConversationId,
} from "@/features/message/system-conversations";
import {
  beginVideoPick,
  type VideoPickResult,
} from "@/shared/media-picker/media-picker-session";
import { openInAppWebView } from "@/shared/navigation/open-web-view";
import { requireLogin } from "@/shared/navigation/require-login";
import { SYSTEM_FONT } from "@/shared/theme/typography";
import { showToast } from "@/shared/ui/app-toast";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { HighlightedInput } from "@/features/circle/components/HighlightedInput";
import {
  CirclePublishVideoTile,
  type UploadState,
} from "@/features/circle/components/CirclePublishVideoTile";

const atIcon = require("../../../../assets/svgs/circle-publish-at.svg");
const emojiIcon = require("../../../../assets/svgs/circle-publish-emoji.svg");
const topicIcon = require("../../../../assets/svgs/circle-publish-topic.svg");
const notifyIcon = require("../../../../assets/svgs/circle-publish-notify.svg");
const arrowRightIcon = require("../../../../assets/svgs/circle-publish-arrow-right.svg");
const keyboardTopicIcon = require("../../../../assets/svgs/circle-comment-topic.svg");
const keyboardEmojiIcon = require("../../../../assets/svgs/circle-comment-emoji.svg");
const keyboardAtIcon = require("../../../../assets/svgs/circle-comment-at.svg");
const FALLBACK_AVATAR = require("../../../../assets/images/radar-avatar-1.png");

type PublishPanel = "none" | "topic" | "mention" | "emoji";

type MentionUser = {
  id: string;
  nickname: string;
  avatar?: string;
};

/** 标题/正文的字数按 Unicode 码点计（与后端校验一致）。 */
const codePointLength = (text: string) => Array.from(text).length;

/** 话题热度格式化：「1.9亿人浏览」「8805.4w人浏览」「2.3w人浏览」。 */
function formatTopicHeat(heat?: number): string | null {
  if (typeof heat !== "number" || heat < 0) {
    return null;
  }
  if (heat >= 100000000) {
    return `${(heat / 100000000).toFixed(1)}亿人浏览`;
  }
  if (heat >= 10000) {
    return `${(heat / 10000).toFixed(1)}w人浏览`;
  }
  return `${heat}人浏览`;
}

export default function CirclePublishScreen() {
  const insets = useSafeAreaInsets();
  const accessToken = useAuthStore((state) => state.accessToken);
  const viewerUserId = useAuthStore((state) => state.user?.id);
  const conversations = useMessageStore((state) => state.conversations);
  const blacklistedUserIds = useMessageStore(
    (state) => state.blacklistedUserIds,
  );
  const messageConnectionState = useMessageStore(
    (state) => state.connectionState,
  );
  const refreshConversations = useMessageStore(
    (state) => state.refreshConversations,
  );

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
  const [focusedField, setFocusedField] = useState<"title" | "content" | null>(
    null,
  );
  const [topicOptions, setTopicOptions] = useState<CircleTopicOption[]>([]);
  const [topicLoading, setTopicLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const uploadCancelledRef = useRef(false);
  const contentInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let cancelled = false;
    fetchCircleDeclarations({ token: accessToken })
      .then((options) => {
        if (!cancelled) {
          setDeclarationOptions(options);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // 声明选项弱依赖：失败时打开弹层再重试
          setDeclarationOptions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // 键盘被手势/系统收起时，同步让输入框失焦，快捷栏随之消失。
  useEffect(() => {
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      if (contentInputRef.current?.isFocused()) {
        contentInputRef.current.blur();
      }
    });
    return () => {
      hideSubscription.remove();
    };
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

  /** 输入框高亮用：id→昵称 字典，命中正文里真实出现的 @昵称。 */
  const mentionNameDict = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        mentionedUsers
          .filter((user) => user.nickname)
          .map((user) => [user.id, user.nickname]),
      ),
    [mentionedUsers],
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
    if (panel !== "topic" || !accessToken) {
      return;
    }
    const timer = setTimeout(() => {
      setTopicLoading(true);
      fetchCircleTopicOptions({ keyword: topicKeyword, token: accessToken })
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
  }, [panel, topicKeyword, accessToken]);

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
          sign,
          onProgress: (percent) => {
            setUpload((current) =>
              current?.status === "uploading"
                ? { ...current, percent }
                : current,
            );
          },
          cancelled: () => uploadCancelledRef.current,
        });
        setUpload({ status: "success", percent: 100, vid });
      } catch (error) {
        setUpload({ status: "failed", percent: 0 });
        showToast(
          error instanceof Error ? error.message : "视频上传未完成，请重试",
        );
      }
    },
    [accessToken],
  );

  const handlePickVideo = useCallback(async () => {
    if (!requireLogin()) {
      return;
    }
    // 必须先 begin 建立会话、再 push 打开选择页、最后 await 结果；
    // 若在 push 前 await，Promise 会一直挂起导致首次点击无响应（第二次点击才触发上一次的 push）。
    const pickPending = beginVideoPick();
    router.push({ pathname: "/media-picker", params: { media: "video" } });
    const picked = await pickPending;
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
    setContent((current) =>
      applyTriggerSelection(current, "#", option.topicName),
    );
    setPanel("none");
  };

  const handleMentionSelect = (user: MentionUser) => {
    setMentionedUsers((current) =>
      current.some((item) => item.id === user.id)
        ? current
        : [...current, user],
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
    // 表情面板顶替键盘高度，先收起键盘并失焦，避免两者同时占位。
    contentInputRef.current?.blur();
  };

  const handleDone = () => {
    setPanel("none");
    // 失焦触发键盘收起，快捷栏随键盘一起消失。
    contentInputRef.current?.blur();
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
          selectedTopics.map((topic) => ({
            id: topic.topicId,
            label: topic.topicName,
          })),
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

  // 快捷栏仅在「描述聚焦」时悬浮；面板打开时（话题/提及/表情）也保持显示。
  const inputActive = focusedField === "content";
  const showKeyboardArea = inputActive || panel !== "none";
  const publishReady =
    Boolean(video) &&
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    agreed &&
    declarations.length > 0 &&
    upload?.status === "success";
  const mentionLoading =
    messageConnectionState === "idle" ||
    messageConnectionState === "connecting";

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="发视频"
        onBack={() => {
          router.back();
        }}
        style={{ paddingTop: insets.top, height: insets.top + 44 }}
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
            style={[
              styles.titleCount,
              title.length > 0 && styles.titleCountFilled,
            ]}
          >
            {codePointLength(title)}/20
          </Text>
        </View>

        <HighlightedInput
          ref={contentInputRef}
          value={content}
          onChangeText={handleContentChange}
          placeholder="添加作品描述"
          placeholderTextColor="#CACACC"
          style={styles.contentInput}
          containerStyle={styles.contentInputContainer}
          highlightStyle={styles.contentHighlight}
          mentions={mentionNameDict}
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

        <CirclePublishVideoTile
          video={video}
          coverUri={coverUri}
          upload={upload}
          onPick={() => {
            void handlePickVideo();
          }}
          onRemove={handleRemoveVideo}
          onRetry={handleRetryUpload}
        />

        <View style={styles.chipRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="插入话题"
            style={styles.chip}
            onPress={handleTopicChipPress}
          >
            <Image source={topicIcon} style={styles.chipIcon} />
            <Text style={styles.chipText}>话题</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="插入表情"
            style={styles.chip}
            onPress={handleEmojiChipPress}
          >
            <Image source={emojiIcon} style={styles.chipIcon} />
            <Text style={styles.chipText}>表情</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="提及用户"
            style={styles.chip}
            onPress={handleMentionChipPress}
          >
            <Image source={atIcon} style={styles.chipIcon} />
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
          <Image source={notifyIcon} style={styles.declarationIcon} />
          <Text style={styles.declarationLabel}>自主声明</Text>
          <Text
            numberOfLines={1}
            style={[
              styles.declarationValue,
              declarations.length > 0 && styles.declarationValueFilled,
            ]}
          >
            {declarations.length > 0
              ? declarations.join("、")
              : "请选择自主声明"}
          </Text>
          <Image source={arrowRightIcon} style={styles.declarationArrow} />
        </Pressable>
        <View style={styles.divider} />
      </ScrollView>

      {showKeyboardArea ? (
        <KeyboardStickyView style={styles.keyboardArea}>
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
                onPress={handleTopicChipPress}
                style={styles.keyboardIconButton}
              >
                <Image source={keyboardTopicIcon} style={styles.keyboardIcon} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="插入表情"
                onPress={handleEmojiChipPress}
                style={styles.keyboardIconButton}
              >
                <Image source={keyboardEmojiIcon} style={styles.keyboardIcon} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="提及用户"
                onPress={handleMentionChipPress}
                style={styles.keyboardIconButton}
              >
                <Image source={keyboardAtIcon} style={styles.keyboardIcon} />
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
            <View
              style={[
                styles.emojiPanel,
                { height: 340 + insets.bottom + 10 },
              ]}
            >
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
        </KeyboardStickyView>
      ) : (
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
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
                  openInAppWebView(
                    APP_LINKS.communityAgreement,
                    "盼之电竞社区公约",
                  );
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
            <Text style={styles.publishText}>
              {sending ? "发布中" : "发布"}
            </Text>
          </Pressable>
        </View>
      )}

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

/** 话题候选面板：行 = 话题名 + 热度，选中即回写正文。 */
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
        <ActivityIndicator
          color="#999999"
          size="small"
          style={styles.panelLoading}
        />
      ) : options.length === 0 ? (
        <Text style={styles.panelEmptyText}>没有找到相关话题</Text>
      ) : (
        <ScrollView
          style={styles.panelScroll}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {options.map((option) => {
            const heatText = formatTopicHeat(option.heat);
            return (
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
                {heatText ? <Text style={styles.topicHeat}>{heatText}</Text> : null}
              </Pressable>
            );
          })}
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
        <ActivityIndicator
          color="#999999"
          size="small"
          style={styles.panelLoading}
        />
      ) : users.length === 0 ? (
        <Text style={styles.panelEmptyText}>暂无可@用户</Text>
      ) : (
        <ScrollView
          style={styles.panelScroll}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
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
      <View style={styles.declarationHeader}>
        <View style={styles.declarationHeaderText}>
          <Text style={styles.declarationSheetTitle}>为作品内容添加声明</Text>
          <Text style={styles.declarationSheetSubtitle}>
            作品发布前添加自主声明，帮助他人减少困惑
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭"
          hitSlop={8}
          onPress={onClose}
          style={styles.declarationClose}
        >
          <Dismiss16Regular color="#7F7F80" width={16} height={16} />
        </Pressable>
      </View>
      <ScrollView
        style={styles.declarationSheetScroll}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
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
              <View
                style={[
                  styles.declarationCheck,
                  checked && styles.declarationChecked,
                ]}
              >
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
        accessibilityLabel="提交自主声明"
        disabled={selected.length === 0}
        onPress={onConfirm}
        style={({ pressed }) => [
          styles.declarationConfirm,
          selected.length === 0 && styles.declarationConfirmDisabled,
          pressed && selected.length > 0 && styles.publishButtonPressed,
        ]}
      >
        <Text style={styles.declarationConfirmText}>提交</Text>
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
    marginTop: 12,
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
  contentInputContainer: {
    minHeight: 160,
    borderRadius: 8,
    marginBottom: 12,
    justifyContent: "flex-start",
  },
  contentInput: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 24,
    color: "#0D0D0F",
    padding: 0,
    textAlignVertical: "top",
  },
  contentHighlight: {
    color: "#1540AD",
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
  chipIcon: {
    width: 16,
    height: 16,
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
  declarationIcon: {
    width: 16,
    height: 16,
  },
  declarationArrow: {
    width: 18,
    height: 18,
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
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  topicName: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#0D0D0F",
  },
  topicHeat: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#979799",
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
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  declarationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  declarationHeaderText: {
    flex: 1,
    gap: 8,
    paddingRight: 12,
    paddingBottom: 8,
  },
  declarationSheetTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    color: "#0D0D0F",
  },
  declarationSheetSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    color: "#7F7F80",
  },
  declarationClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  declarationSheetScroll: {
    maxHeight: 300,
  },
  declarationOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 54,
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
