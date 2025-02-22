import { memo, type TeactNode } from '../../lib/teact/teact';
import React from '../../lib/teact/teactn';

import type { WithChatFoldersTabsProps } from '../common/hocs/withChatFoldersTabs';

import withChatFoldersTabs from '../common/hocs/withChatFoldersTabs';

import { VerticalNavigationTabs } from '../ui/VerticalNavigationTabs';

type OwnProps = {
  contextRootElementSelector: string;
  mainMenuButton: TeactNode;
} & WithChatFoldersTabsProps;

function ChatFoldersVerticalTabs({
  contextRootElementSelector,
  mainMenuButton,
  ...chatFolderTabsProps
}: OwnProps) {
  if (!('folderTabs' in chatFolderTabsProps)) {
    // todo render not loaded yet state
    return undefined;
  }

  const { activeChatFolder, folderTabs, handleSwitchTab } = chatFolderTabsProps;

  return (
    <VerticalNavigationTabs
      dropdown={mainMenuButton}
      activeTab={activeChatFolder}
      tabs={folderTabs}
      onSwitchTab={handleSwitchTab}
    />
  );
}

export default memo(withChatFoldersTabs(ChatFoldersVerticalTabs));
