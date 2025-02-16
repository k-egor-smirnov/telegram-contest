import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useRef, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';
import type { IAnchorPosition } from '../../../../types';

import { EDITABLE_INPUT_CSS_SELECTOR, EDITABLE_INPUT_MODAL_CSS_SELECTOR } from '../../../../config';
import buildClassName from '../../../../util/buildClassName';
import { getFolderIconSrcByEmoji } from '../../../../util/folderIconsMap';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

import CustomEmojiPicker from '../../../common/CustomEmojiPicker';
import Icon from '../../../common/icons/Icon';
import MaskIcon from '../../../common/icons/MaskIcon';
import SymbolMenu from '../../../middle/composer/SymbolMenu';
import Button from '../../../ui/Button';
import Menu from '../../../ui/Menu';
import Portal from '../../../ui/Portal';
import ResponsiveHoverButton from '../../../ui/ResponsiveHoverButton';
import Spinner from '../../../ui/Spinner';

const MOBILE_KEYBOARD_HIDE_DELAY_MS = 100;

type OwnProps = {
  isMobile?: boolean;
  isReady?: boolean;
  isSymbolMenuOpen?: boolean;
  isMessageComposer?: boolean;
  idPrefix: string;
  forceDarkTheme?: boolean;
  openSymbolMenu: VoidFunction;
  closeSymbolMenu: VoidFunction;
  onCustomEmojiSelect: (emoji: ApiSticker) => void;
  onRemoveSymbol: VoidFunction;
  onEmojiSelect: (emoji: string) => void;
  isSymbolMenuForced?: boolean;
  isAttachmentModal?: boolean;
  canSendPlainText?: boolean;
  className?: string;
  inputCssSelector?: string;
  emoticon?: string;
};

const SettingsFoldersSymbolMenuButton: FC<OwnProps> = ({
  isMobile,
  isMessageComposer,
  isReady,
  isSymbolMenuOpen,
  idPrefix,
  isSymbolMenuForced,
  className,
  forceDarkTheme,
  inputCssSelector = EDITABLE_INPUT_CSS_SELECTOR,
  openSymbolMenu,
  closeSymbolMenu,
  onCustomEmojiSelect,
  onRemoveSymbol,
  onEmojiSelect,
  closeSendAsMenu,
  emoticon,
}) => {
  const {
    setStickerSearchQuery,
    setGifSearchQuery,
    addRecentEmoji,
    addRecentCustomEmoji,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const triggerRef = useRef<HTMLDivElement>(null);

  const [isSymbolMenuLoaded, onSymbolMenuLoadingComplete] = useFlag();
  const [contextMenuAnchor, setContextMenuAnchor] = useState<IAnchorPosition | undefined>(undefined);

  const symbolMenuButtonClassName = buildClassName(
    'mobile-symbol-menu-button',
    !isReady && 'not-ready',
    isSymbolMenuLoaded
      ? (isSymbolMenuOpen && 'menu-opened')
      : (isSymbolMenuOpen && 'is-loading'),
  );

  const handleActivateSymbolMenu = useLastCallback(() => {
    closeSendAsMenu?.();
    openSymbolMenu();
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;
    const { x, y } = triggerEl.getBoundingClientRect();
    setContextMenuAnchor({ x, y });
  });

  const handleSymbolMenuOpen = useLastCallback(() => {
    const messageInput = document.querySelector<HTMLDivElement>(
      EDITABLE_INPUT_MODAL_CSS_SELECTOR,
    );

    if (!isMobile || messageInput !== document.activeElement) {
      openSymbolMenu();
      return;
    }

    messageInput?.blur();
    setTimeout(() => {
      openSymbolMenu();
    }, MOBILE_KEYBOARD_HIDE_DELAY_MS);
  });

  const getTriggerElement = useLastCallback(() => triggerRef.current);
  const getRootElement = useLastCallback(() => triggerRef.current?.closest('#Settings'));
  const getMenuElement = useLastCallback(() => document.querySelector('#portals .SymbolMenu .bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const isOpen = isSymbolMenuOpen || Boolean(isSymbolMenuForced);

  return (
    <>
      {isMobile ? (
        <Button
          className={symbolMenuButtonClassName}
          round
          color="translucent"
          onClick={isSymbolMenuOpen ? closeSymbolMenu : handleSymbolMenuOpen}
          ariaLabel="Choose emoji, sticker or GIF"
        >
          <MaskIcon src={getFolderIconSrcByEmoji(emoticon!)} className="symbol-menu-icon" />
          {isSymbolMenuOpen && !isSymbolMenuLoaded && <Spinner color="gray" />}
        </Button>
      ) : (
        <ResponsiveHoverButton
          className={buildClassName('symbol-menu-button', isSymbolMenuOpen && 'activated')}
          round
          color="translucent"
          onActivate={handleActivateSymbolMenu}
          ariaLabel="Choose emoji, sticker or GIF"
        >
          <div ref={triggerRef} className="symbol-menu-trigger" />
          <MaskIcon src={getFolderIconSrcByEmoji(emoticon!)} className="symbol-menu-icon" />
        </ResponsiveHoverButton>
      )}

      <Portal>
        <Menu
          isOpen={isOpen}
          noCompact
          positionX="right"
          onClose={closeSymbolMenu}
          // bubbleClassName={styles.menuContent}
          // transformOriginX={transformOriginX.current}
          // noCloseOnBackdrop={isContextMenuShown}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getTriggerElement={getTriggerElement}
          getLayout={getLayout}
          anchor={contextMenuAnchor}
          withPortal
        >
          <CustomEmojiPicker
            idPrefix="folder-icon-emoji-set-"
            loadAndPlay={isOpen}
            isHidden={!isOpen}
            isFolderIconPicker
            isTranslucent
            // onContextMenuOpen={markContextMenuShown}
            // onContextMenuClose={unmarkContextMenuShown}
            onCustomEmojiSelect={onCustomEmojiSelect}
            // onContextMenuClick={onClose}
          />
        </Menu>
      </Portal>
    </>
  );
};

export default memo(SettingsFoldersSymbolMenuButton);
