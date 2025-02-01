import type { TeactNode } from '../../lib/teact/teact';
import React from '../../lib/teact/teactn';

import type { ChatFoldersTabIcon } from '../common/hocs/withChatFoldersTabs';

import { VerticalNavigationTab } from './VerticalNavigationTab';

import styles from './VerticalNavigationTabs.module.scss';

type OwnProps = {
  tabs: readonly ChatFoldersTabIcon[];
  dropdown?: TeactNode;
  activeTab: number;
  className?: string;
  tabClassName?: string;
  onSwitchTab: (index: number) => void;
  contextRootElementSelector?: string;
};

export function VerticalNavigationTabs({
  tabs, activeTab, onSwitchTab, className, contextRootElementSelector, tabClassName, dropdown,
}: OwnProps) {
  return (
    <ul className={styles.verticalNavigationTabs}>
      {dropdown ? (
        <li className={styles.dropdown}>
          {dropdown}
        </li>
      ) : undefined}
      {tabs.map((item, index) => (
        <VerticalNavigationTab
          title={item.title}
          icon={item.icon}
          badgeCount={item.badgeCount}
          isActive={activeTab === index}
          contextActions={item.contextActions}
          clickArg={index}
          onClick={onSwitchTab}
        />
      ))}
    </ul>
  );
}
