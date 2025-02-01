import React from '../../../lib/teact/teactn';

import type { WithChatFoldersTabsProps } from '../../common/hocs/withChatFoldersTabs';

import withChatFoldersTabs from '../../common/hocs/withChatFoldersTabs';

import TabList from '../../ui/TabList';

type OwnProps = {
  contextRootElementSelector: string;
} & WithChatFoldersTabsProps;

function ChatFoldersHorizontalTabs({
  contextRootElementSelector,
  ...chatFolderTabsProps
}: OwnProps) {
  if (!('folderTabs' in chatFolderTabsProps)) {
    return undefined;
  }

  const { activeChatFolder, folderTabs, handleSwitchTab } = chatFolderTabsProps;

  return (
    <TabList
      contextRootElementSelector={contextRootElementSelector}
      tabs={folderTabs}
      activeTab={activeChatFolder}
      onSwitchTab={handleSwitchTab}
    />
  );
}

export default withChatFoldersTabs(ChatFoldersHorizontalTabs);
