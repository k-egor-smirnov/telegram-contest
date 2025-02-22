import { type TeactNode, useRef } from '../../lib/teact/teact';
import React from '../../lib/teact/teactn';

import type { MenuItemContextAction } from './ListItem';

import buildClassName from '../../util/buildClassName';
import { MouseButton } from '../../util/windowEnvironment';
import renderText from '../common/helpers/renderText';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import { useFastClick } from '../../hooks/useFastClick';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';
import MaskIcon from '../common/icons/MaskIcon';
import Menu from './Menu';
import MenuItem from './MenuItem';
import MenuSeparator from './MenuSeparator';

import styles from './VerticalNavigationTab.module.scss';

type OwnProps = {
  className?: string;
  title: TeactNode;
  isActive?: boolean;
  isBlocked?: boolean;
  icon: string;
  badgeCount?: number;
  isBadgeActive?: boolean;
  onClick?: (arg: number) => void;
  clickArg?: number;
  contextActions?: MenuItemContextAction[];
  contextRootElementSelector?: string;
};

export function VerticalNavigationTab({
  onClick, className, title, badgeCount, isBadgeActive, icon,
  clickArg, contextActions, contextRootElementSelector, isActive, isBlocked,
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const tabRef = useRef<HTMLButtonElement>(null);

  const {
    contextMenuAnchor, handleContextMenu, handleBeforeContextMenu, handleContextMenuClose,
    handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(tabRef, !contextActions);

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLButtonElement>) => {
    if (contextActions && (e.button === MouseButton.Secondary || !onClick)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    onClick?.(clickArg!);
  });

  const getTriggerElement = useLastCallback(() => tabRef.current);
  const getRootElement = useLastCallback(
    () => (contextRootElementSelector ? tabRef.current!.closest(contextRootElementSelector) : document.body),
  );
  const getMenuElement = useLastCallback(
    () => document.querySelector('#portals')!.querySelector('.Tab-context-menu .bubble'),
  );

  const getLayout = useLastCallback(() => ({ withPortal: true }));

  return (
    <button
      className={buildClassName(
        styles.tab,
        onClick && styles.interactive,
        className,
        isActive && styles.active,
        isBlocked && styles.blocked,
      )}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      ref={tabRef}
    >
      <div className={styles.icon}>
        {typeof icon === 'string' ? <MaskIcon src={icon} className={styles.maskIcon} /> : icon}
      </div>
      <div className={styles.title}>
        {isBlocked && <Icon name="lock-badge" className="blocked" />}
        {typeof title === 'string' ? renderText(title) : title}
      </div>
      {Boolean(badgeCount) && (
        <span className={buildClassName(styles.badge, isBadgeActive && styles.badgeActive)}>{badgeCount}</span>
      )}

      {contextActions && contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="Tab-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </button>
  );
}
