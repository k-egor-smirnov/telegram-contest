import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSession } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';
import type { ISettings, LeftColumnContent, SettingsScreens } from '../../../types';
import type { WithChatFoldersTabsProps } from '../../common/hocs/withChatFoldersTabs';

import { ALL_FOLDER_ID } from '../../../config';
import { selectTabState } from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { captureEvents, SwipeDirection } from '../../../util/captureEvents';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import withChatFoldersTabs from '../../common/hocs/withChatFoldersTabs';

import useAppLayout from '../../../hooks/useAppLayout';
import useDerivedState from '../../../hooks/useDerivedState';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useShowTransition from '../../../hooks/useShowTransition';

import StoryRibbon from '../../story/StoryRibbon';
import Transition from '../../ui/Transition';
import ChatFoldersHorizontalTabs from './ChatFoldersHorizontalTabs';
import ChatList from './ChatList';

type OwnProps = {
  onSettingsScreenSelect: (screen: SettingsScreens) => void;
  foldersDispatch: FolderEditDispatch;
  onLeftColumnContentChange: (content: LeftColumnContent) => void;
  shouldHideFolderTabs?: boolean;
  isForumPanelOpen?: boolean;
};

type StateProps = {
  orderedFolderIds?: number[];
  activeChatFolder: number;
  currentUserId?: string;
  shouldSkipHistoryAnimations?: boolean;
  maxFolders: number;
  maxChatLists: number;
  maxFolderInvites: number;
  hasArchivedChats?: boolean;
  hasArchivedStories?: boolean;
  archiveSettings: GlobalState['archiveSettings'];
  isStoryRibbonShown?: boolean;
  sessions?: Record<string, ApiSession>;
} & WithChatFoldersTabsProps;

const SAVED_MESSAGES_HOTKEY = '0';

const ChatFolders: FC<OwnProps & StateProps> = ({
  foldersDispatch,
  onSettingsScreenSelect,
  onLeftColumnContentChange,
  orderedFolderIds,
  activeChatFolder,
  currentUserId,
  isForumPanelOpen,
  shouldSkipHistoryAnimations,
  shouldHideFolderTabs,
  hasArchivedChats,
  hasArchivedStories,
  archiveSettings,
  isStoryRibbonShown,
  sessions,
  foldersTabsAppearance,
}) => {
  const { isMobile } = useAppLayout();

  const {
    setActiveChatFolder,
    openChat,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);

  const lang = useLang();

  const {
    ref,
    shouldRender: shouldRenderStoryRibbon,
    getIsClosing: getIsStoryRibbonClosing,
  } = useShowTransition({
    isOpen: isStoryRibbonShown,
    className: false,
    withShouldRender: true,
  });
  const isStoryRibbonClosing = useDerivedState(getIsStoryRibbonClosing);

  const allChatsFolderIndex = orderedFolderIds?.findIndex((id) => id === ALL_FOLDER_ID);
  const isInAllChatsFolder = allChatsFolderIndex === activeChatFolder;
  const isInFirstFolder = activeChatFolder === 0;

  // Prevent `activeTab` pointing at non-existing folder after update

  useEffect(() => {
    if (!IS_TOUCH_ENV || !orderedFolderIds?.length || isForumPanelOpen) {
      return undefined;
    }

    return captureEvents(transitionRef.current!, {
      selectorToPreventScroll: '.chat-list',
      onSwipe: ((e, direction) => {
        if (direction === SwipeDirection.Left) {
          setActiveChatFolder(
            { activeChatFolder: Math.min(activeChatFolder + 1, orderedFolderIds.length - 1) },
            { forceOnHeavyAnimation: true },
          );
          return true;
        } else if (direction === SwipeDirection.Right) {
          setActiveChatFolder({ activeChatFolder: Math.max(0, activeChatFolder - 1) }, { forceOnHeavyAnimation: true });
          return true;
        }

        return false;
      }),
    });
  }, [activeChatFolder, orderedFolderIds, isForumPanelOpen, setActiveChatFolder]);

  const isNotInFirstFolderRef = useRef();
  isNotInFirstFolderRef.current = !isInFirstFolder;

  useEffect(() => (isNotInFirstFolderRef.current ? captureEscKeyListener(() => {
    if (isNotInFirstFolderRef.current) {
      setActiveChatFolder({ activeChatFolder: 0 });
    }
  }) : undefined), [activeChatFolder, setActiveChatFolder]);

  useHistoryBack({
    isActive: !isInFirstFolder,
    onBack: () => setActiveChatFolder({ activeChatFolder: 0 }, { forceOnHeavyAnimation: true }),
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code.startsWith('Digit') && orderedFolderIds) {
        const [, digit] = e.code.match(/Digit(\d)/) || [];
        if (!digit) return;

        if (digit === SAVED_MESSAGES_HOTKEY) {
          openChat({ id: currentUserId, shouldReplaceHistory: true });
          return;
        }

        const folder = Number(digit) - 1;
        if (folder > orderedFolderIds.length - 1) return;

        setActiveChatFolder({ activeChatFolder: folder }, { forceOnHeavyAnimation: true });
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [currentUserId, orderedFolderIds, openChat, setActiveChatFolder]);

  const {
    ref: placeholderRef,
    shouldRender: shouldRenderPlaceholder,
  } = useShowTransition({
    isOpen: !orderedFolderIds,
    noMountTransition: true,
    withShouldRender: true,
  });

  function renderCurrentTab(isActive: boolean) {
    const isFolder = activeChatFolder && !isInAllChatsFolder;

    return (
      <ChatList
        folderType={isFolder ? 'folder' : 'all'}
        folderId={isFolder ? activeChatFolder : undefined}
        isActive={isActive}
        isForumPanelOpen={isForumPanelOpen}
        foldersDispatch={foldersDispatch}
        onSettingsScreenSelect={onSettingsScreenSelect}
        onLeftColumnContentChange={onLeftColumnContentChange}
        canDisplayArchive={(hasArchivedChats || hasArchivedStories) && !archiveSettings.isHidden}
        archiveSettings={archiveSettings}
        sessions={sessions}
      />
    );
  }

  const shouldRenderFolders = foldersTabsAppearance === 'horizontal'
    && orderedFolderIds
   && orderedFolderIds.length > 1;

  return (
    <div
      ref={ref}
      className={buildClassName(
        'ChatFolders',
        shouldRenderFolders && shouldHideFolderTabs && 'ChatFolders--tabs-hidden',
        shouldRenderStoryRibbon && 'with-story-ribbon',
      )}
    >
      {shouldRenderStoryRibbon && <StoryRibbon isClosing={isStoryRibbonClosing} />}
      {
        shouldRenderFolders ? <ChatFoldersHorizontalTabs contextRootElementSelector="#LeftColumn" />
          : shouldRenderPlaceholder
            ? <div ref={placeholderRef} className="tabs-placeholder" />
            : undefined
      }
      <Transition
        ref={transitionRef}
        name={shouldSkipHistoryAnimations ? 'none' : lang.isRtl ? 'slideOptimizedRtl' : 'slideOptimized'}
        activeKey={activeChatFolder}
        renderCount={shouldRenderFolders ? orderedFolderIds.length : undefined}
      >
        {renderCurrentTab}
      </Transition>
    </div>
  );
};

export default memo(withChatFoldersTabs(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      chatFolders: {
        orderedIds: orderedFolderIds,
      },
      chats: {
        listIds: {
          archived,
        },
      },
      stories: {
        orderedPeerIds: {
          archived: archivedStories,
        },
      },
      activeSessions: {
        byHash: sessions,
      },
      currentUserId,
      archiveSettings,
    } = global;
    const { shouldSkipHistoryAnimations, activeChatFolder } = selectTabState(global);
    const { storyViewer: { isRibbonShown: isStoryRibbonShown } } = selectTabState(global);

    return {
      orderedFolderIds,
      activeChatFolder,
      currentUserId,
      shouldSkipHistoryAnimations,
      hasArchivedChats: Boolean(archived?.length),
      hasArchivedStories: Boolean(archivedStories?.length),
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
      maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
      archiveSettings,
      isStoryRibbonShown,
      sessions,
    };
  },
)(ChatFolders)));
