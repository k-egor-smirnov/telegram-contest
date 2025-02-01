import type { FC } from '../../lib/teact/teact';
import { useMemo } from '../../lib/teact/teact';
import React from '../../lib/teact/teactn';

import { LeftColumnContent } from '../../types';

import { APP_NAME, DEBUG, IS_BETA } from '../../config';
import buildClassName from '../../util/buildClassName';
import { IS_ELECTRON, IS_MAC_OS } from '../../util/windowEnvironment';

import useAppLayout from '../../hooks/useAppLayout';
import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import { useFullscreenStatus } from '../../hooks/window/useFullscreen';
import useLeftHeaderButtonRtlForumTransition from './main/hooks/useLeftHeaderButtonRtlForumTransition';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import LeftSideMenuItems from './main/LeftSideMenuItems';

type OwnProps = {
  onContentChange: (content: LeftColumnContent) => void;
};

export default function MainMenuDropdown({ onContentChange }: OwnProps) {
  const oldLang = useOldLang();
  const { isMobile, isDesktop } = useAppLayout();
  const [isBotMenuOpen, markBotMenuOpen, unmarkBotMenuOpen] = useFlag();

  const content = LeftColumnContent.ChatList;

  const hasMenu = content === LeftColumnContent.ChatList;

  const versionString = IS_BETA ? `${APP_VERSION} Beta (${APP_REVISION})` : (DEBUG ? APP_REVISION : APP_VERSION);

  const isFullscreen = useFullscreenStatus();

  // Disable dropdown menu RTL animation for resize

  const shouldHideSearch = false;

  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(!shouldHideSearch);

  const handleSelectSettings = useLastCallback(() => {
    onContentChange(LeftColumnContent.Settings);
  });

  const handleSelectContacts = useLastCallback(() => {
    onContentChange(LeftColumnContent.Contacts);
  });

  const handleSelectArchived = useLastCallback(() => {
    onContentChange(LeftColumnContent.Archived);
    // closeForumPanel();
  });

  const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={hasMenu && !isMobile}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        // eslint-disable-next-line react/jsx-no-bind
        // onClick={hasMenu ? onTrigger : () => onReset()}
        onClick={onTrigger}
        ariaLabel={hasMenu ? oldLang('AccDescrOpenMenu2') : 'Return to chat list'}
      >
        <div className={buildClassName(
          'animated-menu-icon',
          !hasMenu && 'state-back',
          // shouldSkipTransition && 'no-animation',
        )}
        />
      </Button>
    );
  // }, [hasMenu, isMobile, oldLang, onReset, shouldSkipTransition]);
  }, [hasMenu, isMobile, oldLang]);

  return (
    <DropdownMenu
      trigger={MainButton}
      footer={`${APP_NAME} ${versionString}`}
      className={buildClassName(
        'main-menu',
        oldLang.isRtl && 'rtl',
        // shouldHideSearch && oldLang.isRtl && 'right-aligned',
        shouldDisableDropdownMenuTransitionRef.current && oldLang.isRtl && 'disable-transition',
      )}
      forceOpen={isBotMenuOpen}
      // positionX={shouldHideSearch && oldLang.isRtl ? 'right' : 'left'}
      transformOriginX={IS_ELECTRON && IS_MAC_OS && !isFullscreen ? 90 : undefined}
      onTransitionEnd={oldLang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
    >
      <LeftSideMenuItems
        onSelectArchived={handleSelectArchived}
        onSelectContacts={handleSelectContacts}
        onSelectSettings={handleSelectSettings}
        onBotMenuOpened={markBotMenuOpen}
        onBotMenuClosed={unmarkBotMenuOpen}
      />
    </DropdownMenu>
  );
}
