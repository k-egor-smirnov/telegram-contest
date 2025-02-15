import type { FC, Props } from '../../../lib/teact/teact';
import React, { memo, useEffect, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChatFolder, ApiChatlistExportedInvite } from '../../../api/types';
import type { ISettings } from '../../../types';
import type { MenuItemContextAction } from '../../ui/ListItem';
import type { TabWithProperties } from '../../ui/TabList';

import { ALL_FOLDER_ID } from '../../../config';
import { selectCanShareFolder, selectTabState } from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import { getFolderIconSrcByEmoji } from '../../../util/folderIconsMap';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { renderTextWithEntities } from '../helpers/renderTextWithEntities';

import useAppLayout from '../../../hooks/useAppLayout';
import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  orderedFolderIds?: number[];
  maxFolders: number;
  maxFolderInvites: number;
  activeChatFolder: number;
  maxChatLists: number;
  foldersTabsPreference: ISettings['foldersTabsPreference'];
};

export type ChatFoldersTabIcon = TabWithProperties & {
  icon: string;
};

export type WithChatFoldersTabsProps = {
  folderTabs?: TabWithProperties[];
  activeChatFolder?: number;
  handleSwitchTab?: (tabId: number) => void;
  foldersTabsAppearance?: ISettings['foldersTabsPreference'];
};

export default function withChatFoldersTabs<T extends Props>(WrappedComponent: FC<T>) {
  function ComponentwithChatFoldersTabsTabs({
    activeChatFolder, chatFoldersById, folderInvitesById, maxChatLists,
    maxFolderInvites, maxFolders, orderedFolderIds, foldersTabsPreference, ...restProps
  }: StateProps & T) {
    const lang = useLang();
    const { isMobile } = useAppLayout();
    const folderCountersById = useFolderManagerForUnreadCounters();

    const {
      openLimitReachedModal,
      openShareChatFolderModal,
      openDeleteChatFolderModal,
      openEditChatFolder,
      setActiveChatFolder,
      loadChatFolders,
    } = getActions();

    const handleSwitchTab = useLastCallback((index: number) => {
      setActiveChatFolder({ activeChatFolder: index }, { forceOnHeavyAnimation: true });
    });

    const allChatsFolder: ApiChatFolder = useMemo(() => {
      return {
        id: ALL_FOLDER_ID,
        title: { text: orderedFolderIds?.[0] === ALL_FOLDER_ID ? lang('FilterAllChatsShort') : lang('FilterAllChats') },
        includedChatIds: MEMO_EMPTY_ARRAY,
        excludedChatIds: MEMO_EMPTY_ARRAY,
      } satisfies ApiChatFolder;
    }, [orderedFolderIds, lang]);

    useEffect(() => {
      loadChatFolders();
    }, []);

    const displayedFolders = useMemo(() => {
      return orderedFolderIds
        ? orderedFolderIds.map((id) => {
          if (id === ALL_FOLDER_ID) {
            return allChatsFolder;
          }

          return chatFoldersById[id] || {};
        }).filter(Boolean)
        : undefined;
    }, [chatFoldersById, allChatsFolder, orderedFolderIds]);

    useEffect(() => {
      if (!displayedFolders?.length) {
        return;
      }

      if (activeChatFolder >= displayedFolders.length) {
        setActiveChatFolder({ activeChatFolder: 0 });
      }
    }, [activeChatFolder, displayedFolders, setActiveChatFolder]);

    const chatFolderTabsProps = useMemo<WithChatFoldersTabsProps>(() => {
      if (!displayedFolders || !displayedFolders.length) {
        return {};
      }

      const folderTabs = displayedFolders.map((folder, i) => {
        const { id, title } = folder;
        const isBlocked = id !== ALL_FOLDER_ID && i > maxFolders - 1;
        const canShareFolder = selectCanShareFolder(getGlobal(), id);
        const contextActions: MenuItemContextAction[] = [];

        if (canShareFolder) {
          contextActions.push({
            title: lang('FilterShare'),
            icon: 'link',
            handler: () => {
              const chatListCount = Object.values(chatFoldersById)
                .reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);

              if (chatListCount >= maxChatLists && !folder.isChatList) {
                openLimitReachedModal({
                  limit: 'chatlistJoined',
                });
                return;
              }

              // Greater amount can be after premium downgrade
              if (folderInvitesById[id]?.length >= maxFolderInvites) {
                openLimitReachedModal({
                  limit: 'chatlistInvites',
                });
                return;
              }

              openShareChatFolderModal({
                folderId: id,
              });
            },
          });
        }

        if (id !== ALL_FOLDER_ID) {
          contextActions.push({
            title: lang('FilterEdit'),
            icon: 'edit',
            handler: () => {
              openEditChatFolder({ folderId: id });
            },
          });

          contextActions.push({
            title: lang('FilterDelete'),
            icon: 'delete',
            destructive: true,
            handler: () => {
              openDeleteChatFolderModal({ folderId: id });
            },
          });
        }

        return {
          id,
          title: renderTextWithEntities({
            text: title.text,
            entities: title.entities,
            noCustomEmojiPlayback: folder.noTitleAnimations,
          }),
          badgeCount: folderCountersById[id]?.chatsCount,
          icon: id === ALL_FOLDER_ID ? getFolderIconSrcByEmoji('💬') : getFolderIconSrcByEmoji(folder.emoticon ?? '📁'),
          isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
          isBlocked,
          contextActions: contextActions?.length ? contextActions : undefined,
        } satisfies ChatFoldersTabIcon;
      });

      return {
        folderTabs,
        activeChatFolder,
        handleSwitchTab,
        foldersTabsAppearance: isMobile ? 'horizontal' : foldersTabsPreference,
      };
    }, [
      displayedFolders, maxFolders, folderCountersById, lang, chatFoldersById, maxChatLists, folderInvitesById,
      maxFolderInvites, activeChatFolder, handleSwitchTab, foldersTabsPreference, isMobile,
    ]);

    /* eslint-disable-next-line react/jsx-props-no-spreading */
    return <WrappedComponent {...chatFolderTabsProps} {...(restProps as unknown as T)} />;
  }

  return memo(withGlobal<T>((global): StateProps => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
        invites: folderInvitesById,
      },
    } = global;

    const { activeChatFolder } = selectTabState(global);

    return {
      chatFoldersById,
      orderedFolderIds,
      folderInvitesById,
      activeChatFolder,
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
      maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
      foldersTabsPreference: global.settings.byKey.foldersTabsPreference,
    };
  })(ComponentwithChatFoldersTabsTabs));
}
