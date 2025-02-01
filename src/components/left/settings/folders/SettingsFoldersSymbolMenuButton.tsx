import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useRef, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';
import type { IAnchorPosition } from '../../../../types';

import { EDITABLE_INPUT_CSS_SELECTOR, EDITABLE_INPUT_MODAL_CSS_SELECTOR } from '../../../../config';
import buildClassName from '../../../../util/buildClassName';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

import Icon from '../../../common/icons/Icon';
import SymbolMenu from '../../../middle/composer/SymbolMenu';
import Button from '../../../ui/Button';
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

  const handleSearchOpen = useLastCallback((type: 'stickers' | 'gifs') => {
    if (type === 'stickers') {
      setStickerSearchQuery({ query: '' });
      setGifSearchQuery({ query: undefined });
    } else {
      setGifSearchQuery({ query: '' });
      setStickerSearchQuery({ query: undefined });
    }
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
  const getRootElement = useLastCallback(() => triggerRef.current?.closest('.title-container'));
  const getMenuElement = useLastCallback(() => document.querySelector('#portals .SymbolMenu .bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true }));

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
          <Icon name="smile" />
          <Icon name="keyboard" />
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
          <Icon name="smile" />
        </ResponsiveHoverButton>
      )}

      <SymbolMenu
        isOpen={isSymbolMenuOpen || Boolean(isSymbolMenuForced)}
        canSendGifs={false}
        canSendStickers={false}
        isMessageComposer={isMessageComposer}
        idPrefix={idPrefix}
        onLoad={onSymbolMenuLoadingComplete}
        onClose={closeSymbolMenu}
        onEmojiSelect={onEmojiSelect}
        onCustomEmojiSelect={onCustomEmojiSelect}
        onRemoveSymbol={onRemoveSymbol}
        onSearchOpen={handleSearchOpen}
        isAttachmentModal
        canSendPlainText
        className={buildClassName(className, forceDarkTheme && 'component-theme-dark')}
        anchor={contextMenuAnchor}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getMenuElement={getMenuElement}
        getLayout={getLayout}
      />
    </>
  );
};

export default memo(SettingsFoldersSymbolMenuButton);
