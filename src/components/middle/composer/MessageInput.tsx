import { type RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiFormattedText, ApiInputMessageReplyInfo } from '../../../api/types';
import type { AnyNode, TelegramObjectModel } from '../../../lib/MarkdownParser';
import type { ISettings, ThreadId } from '../../../types';
import type { Signal } from '../../../util/signals';
import { ApiMessageEntityTypes } from '../../../api/types';

import { EDITABLE_INPUT_ID } from '../../../config';
import { MarkdownParser } from '../../../lib/MarkdownParser';
import {
  selectCanPlayAnimatedEmojis,
  selectDraft,
  selectIsInSelectMode,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { generateRandomInt } from '../../../api/gramjs/gramjsBuilders';
import renderText from '../../common/helpers/renderText';

import useDerivedState from '../../../hooks/useDerivedState';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import TextTimer from '../../ui/TextTimer';
import MarkdownEditor from './MarkdownEditor';

import styles from './MessageInput.module.scss';

// const CONTEXT_MENU_CLOSE_DELAY_MS = 100;
// // Focus slows down animation, also it breaks transition layout in Chrome
// const FOCUS_DELAY_MS = 350;
// const TRANSITION_DURATION_FACTOR = 50;

const SCROLLER_CLASS = 'input-scroller';
// const INPUT_WRAPPER_CLASS = 'message-input-wrapper';

function getNextNode(node) {
  if (node.firstChild) return node.firstChild;
  while (node) {
    if (node.nextSibling) return node.nextSibling;
    node = node.parentNode;
  }
}

const markersByType = {
  [ApiMessageEntityTypes.Bold]: '**',
  [ApiMessageEntityTypes.Italic]: '__',
  block: '',
  [ApiMessageEntityTypes.Code]: '```',
  [ApiMessageEntityTypes.Blockquote]: '>',
};

function getPreviousNode(node) {
  if (node.previousSibling) return node.previousSibling;
  while (node) {
    if (node.previousSibling) return node.previousSibling;
    node = node.parentNode;
  }
}

function getBlockNodes(el: HTMLElement) {
  const { type } = el.dataset;

  const nodes = [];

  if (type === ApiMessageEntityTypes.Code) {
    let startNode = el;
    while (startNode && !startNode.classList.contains('code-block-start')) {
      startNode = getPreviousNode(startNode);
    }

    let nextNode = startNode;
    while (nextNode && nextNode.dataset.type === ApiMessageEntityTypes.Code) {
      nodes.push(nextNode);

      nextNode = nextNode.nextElementSibling as HTMLElement;
    }
  }

  return nodes;
}

function getNodesInRange(range: Range) {
  const start = range.startContainer;
  const end = range.endContainer;
  const commonAncestor = range.commonAncestorContainer;
  const nodes = new Set<Node>();
  let node;

  // walk parent nodes from start to common ancestor
  for (node = start.parentNode; node; node = node.parentNode) {
    nodes.add(node);
    if (node === commonAncestor) break;
  }

  // walk children and siblings from start until end is found
  for (node = start; node; node = getNextNode(node)) {
    nodes.add(node);
    if (node === end) break;
  }
  if (range.endOffset === range.endContainer.textContent?.length) {
    if (range.endContainer.nextSibling) {
      nodes.add(range.endContainer.nextSibling);
    } else if (range.endContainer.parentNode?.nextSibling) {
      nodes.add(range.endContainer.parentNode.nextSibling);
    }
  }

  if (range.startOffset === 0) {
    if (range.startContainer.previousSibling) {
      nodes.add(range.startContainer.previousSibling);
    } else if (range.startContainer.parentNode?.previousSibling) {
      nodes.add(range.startContainer.parentNode.previousSibling);
    }
  }

  if (range.startContainer.nodeType === 1) {
    const prevSibling = range.startContainer.childNodes[range.startOffset]?.previousSibling;
    if (prevSibling) {
      nodes.add(prevSibling);
    }
  }

  if (range.endContainer.nodeType === 1) {
    const nextSibling = range.endContainer.childNodes[range.endOffset]?.nextSibling;
    if (nextSibling) {
      nodes.add(nextSibling);
    }
  }

  return [...nodes]
    .map((v) => (v?.nodeType === 3 ? v.parentNode : v))
    .filter(Boolean);
}

function getNodesAroundRange(range: Range) {
  const start = range.startContainer;
  const end = range.endContainer;

  let startNode = getPreviousNode(start);
  while (startNode && !startNode?.dataset?.type) {
    startNode = getPreviousNode(startNode);
  }

  let endNode = getNextNode(end);
  while (endNode && !endNode?.dataset?.type) {
    endNode = getNextNode(endNode);
  }

  return [startNode, endNode];
}

type OwnProps = {
  ref?: RefObject<HTMLDivElement>;
  id: string;
  chatId: string;
  threadId: ThreadId;
  isAttachmentModalInput?: boolean;
  isStoryInput?: boolean;
  customEmojiPrefix: string;
  editableInputId?: string;
  isReady: boolean;
  isActive: boolean;
  getApiText: Signal<string>;
  placeholder: string;
  timedPlaceholderLangKey?: string;
  timedPlaceholderDate?: number;
  forcedPlaceholder?: string;
  noFocusInterception?: boolean;
  canAutoFocus: boolean;
  shouldSuppressFocus?: boolean;
  shouldSuppressTextFormatter?: boolean;
  canSendPlainText?: boolean;
  onUpdate: (text: ApiFormattedText) => void;
  onSuppressedFocus?: () => void;
  onSend: () => void;
  onScroll?: (event: React.UIEvent<HTMLElement>) => void;
  captionLimit?: number;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
  isNeedPremium?: boolean;
};

type StateProps = {
  replyInfo?: ApiInputMessageReplyInfo;
  isSelectModeActive?: boolean;
  messageSendKeyCombo?: ISettings['messageSendKeyCombo'];
  canPlayAnimatedEmojis: boolean;
};

const MessageInput: FC<OwnProps & StateProps> = ({
  ref,
  id,
  chatId,
  captionLimit,
  isAttachmentModalInput,
  isStoryInput,
  customEmojiPrefix,
  editableInputId,
  isReady,
  isActive,
  getApiText,
  placeholder,
  timedPlaceholderLangKey,
  timedPlaceholderDate,
  forcedPlaceholder,
  canSendPlainText,
  canAutoFocus,
  noFocusInterception,
  shouldSuppressFocus,
  shouldSuppressTextFormatter,
  replyInfo,
  isSelectModeActive,
  canPlayAnimatedEmojis,
  messageSendKeyCombo,
  onUpdate,
  onSuppressedFocus,
  onSend,
  onScroll,
  onFocus,
  onBlur,
  isNeedPremium,
}) => {
  const {
    editLastMessage,
    replyToNextMessage,
    showAllowedMessageTypesNotification,
    openPremiumModal,
  } = getActions();

  const mouseLockedRef = useRef(false);

  // eslint-disable-next-line no-null/no-null
  let inputRef = useRef<HTMLDivElement>(null);
  const commits = useRef<
  Array<{
    type: 'addNode' | 'modifyNode' | 'deleteNode';
    nodeType: 'text';
    value: string;
    pos: number;
    dir: -1 | 1;
    selection: Range;
  }>
  >([
    {
      type: 'addNode',
      nodeType: 'text',
      value: 'hello ',
      pos: 0,
      // for rtl reasons
      dir: 1,
      selection: new Range(),
    },
    {
      type: 'addNode',
      nodeType: 'text',
      value: ' world ',
      pos: 4,
      // for rtl reasons
      dir: 1,
      selection: new Range(),
    },
  ]);
  const commitsOffset = useRef(0);
  const prevSelectionNodes = useRef<[HTMLElement?, HTMLElement?]>([]);

  if (ref) {
    inputRef = ref;
  }

  // eslint-disable-next-line no-null/no-null
  const selectionTimeoutRef = useRef<number>(null);
  // eslint-disable-next-line no-null/no-null
  const cloneRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const scrollerCloneRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const absoluteContainerRef = useRef<HTMLDivElement>(null);

  // const lang = useOldLang();
  // const isContextMenuOpenRef = useRef(false);
  // const [isTextFormatterOpen, openTextFormatter, closeTextFormatter] = useFlag();
  // const [textFormatterAnchorPosition, setTextFormatterAnchorPosition] = useState<IAnchorPosition>();
  // const [selectedRange, setSelectedRange] = useState<Range>();
  // const [isTextFormatterDisabled, setIsTextFormatterDisabled] = useState<boolean>(false);
  // const { isMobile } = useAppLayout();
  // const isMobileDevice = isMobile && (IS_IOS || IS_ANDROID);

  const [shouldDisplayTimer, setShouldDisplayTimer] = useState(false);

  useEffect(() => {
    setShouldDisplayTimer(Boolean(timedPlaceholderLangKey && timedPlaceholderDate));
  }, [timedPlaceholderDate, timedPlaceholderLangKey]);

  const handleTimerEnd = useLastCallback(() => {
    setShouldDisplayTimer(false);
  });

  // useInputCustomEmojis(
  //   getApiText,
  //   inputRef,
  //   sharedCanvasRef,
  //   sharedCanvasHqRef,
  //   absoluteContainerRef,
  //   customEmojiPrefix,
  //   canPlayAnimatedEmojis,
  //   isReady,
  //   isActive,
  // );

  // const maxInputHeight = isAttachmentModalInput
  //   ? MAX_ATTACHMENT_MODAL_INPUT_HEIGHT
  //   : isStoryInput ? MAX_STORY_MODAL_INPUT_HEIGHT : (isMobile ? 256 : 416);
  // const updateInputHeight = useLastCallback((willSend = false) => {
  //   requestForcedReflow(() => {
  //     const scroller = inputRef.current!.closest<HTMLDivElement>(`.${SCROLLER_CLASS}`)!;
  //     const currentHeight = Number(scroller.style.height.replace('px', ''));
  //     const clone = scrollerCloneRef.current!;
  //     const { scrollHeight } = clone;
  //     const newHeight = Math.min(scrollHeight, maxInputHeight);

  //     if (newHeight === currentHeight) {
  //       return undefined;
  //     }

  //     const isOverflown = scrollHeight > maxInputHeight;

  //     function exec() {
  //       const transitionDuration = Math.round(
  //         TRANSITION_DURATION_FACTOR * Math.log(Math.abs(newHeight - currentHeight)),
  //       );
  //       scroller.style.height = `${newHeight}px`;
  //       scroller.style.transitionDuration = `${transitionDuration}ms`;
  //       scroller.classList.toggle('overflown', isOverflown);
  //     }

  //     if (willSend) {
  //       // Delay to next frame to sync with sending animation
  //       requestMutation(exec);
  //       return undefined;
  //     } else {
  //       return exec;
  //     }
  //   });
  // });

  // useLayoutEffect(() => {
  //   if (!isAttachmentModalInput) return;
  //   updateInputHeight(false);
  // }, [isAttachmentModalInput, updateInputHeight]);

  // const htmlRef = useRef(getApiText());
  // useLayoutEffect(() => {
  //   const html = isActive ? getApiText() : '';

  //   if (html !== inputRef.current!.innerHTML) {
  //     // inputRef.current!.innerHTML = html;
  //   }

  //   if (html !== cloneRef.current!.innerHTML) {
  //     // cloneRef.current!.innerHTML = html;
  //   }

  //   if (html !== htmlRef.current) {
  //     htmlRef.current = html;

  //     updateInputHeight(!html);
  //   }
  // }, [getApiText, isActive, updateInputHeight]);

  // const chatIdRef = useRef(chatId);
  // chatIdRef.current = chatId;
  // const focusInput = useLastCallback(() => {
  //   if (!inputRef.current || isNeedPremium) {
  //     return;
  //   }

  //   if (getIsHeavyAnimating()) {
  //     setTimeout(focusInput, FOCUS_DELAY_MS);
  //     return;
  //   }

  //   focusEditableElement(inputRef.current!);
  // });

  // const handleCloseTextFormatter = useLastCallback(() => {
  //   closeTextFormatter();
  //   clearSelection();
  // });

  // function checkSelection() {
  //   // Disable the formatter on iOS devices for now.
  //   if (IS_IOS) {
  //     return false;
  //   }

  //   const selection = window.getSelection();
  //   if (!selection || !selection.rangeCount || isContextMenuOpenRef.current) {
  //     closeTextFormatter();
  //     if (IS_ANDROID) {
  //       setIsTextFormatterDisabled(false);
  //     }
  //     return false;
  //   }

  //   const selectionRange = selection.getRangeAt(0);
  //   const selectedText = selectionRange.toString().trim();
  //   if (
  //     shouldSuppressTextFormatter
  //     || !isSelectionInsideInput(selectionRange, editableInputId || EDITABLE_INPUT_ID)
  //     || !selectedText
  //     || parseEmojiOnlyString(selectedText)
  //     || !selectionRange.START_TO_END
  //   ) {
  //     closeTextFormatter();
  //     return false;
  //   }

  //   return true;
  // }

  // function processSelection() {
  //   if (!checkSelection()) {
  //     return;
  //   }

  //   if (isTextFormatterDisabled) {
  //     return;
  //   }

  //   const selectionRange = window.getSelection()!.getRangeAt(0);
  //   const selectionRect = selectionRange.getBoundingClientRect();
  //   const scrollerRect = inputRef.current!.closest<HTMLDivElement>(`.${SCROLLER_CLASS}`)!.getBoundingClientRect();

  //   let x = (selectionRect.left + selectionRect.width / 2) - scrollerRect.left;

  //   if (x < TEXT_FORMATTER_SAFE_AREA_PX) {
  //     x = TEXT_FORMATTER_SAFE_AREA_PX;
  //   } else if (x > scrollerRect.width - TEXT_FORMATTER_SAFE_AREA_PX) {
  //     x = scrollerRect.width - TEXT_FORMATTER_SAFE_AREA_PX;
  //   }

  //   setTextFormatterAnchorPosition({
  //     x,
  //     y: selectionRect.top - scrollerRect.top,
  //   });

  //   setSelectedRange(selectionRange);
  //   openTextFormatter();
  // }

  // function processSelectionWithTimeout() {
  //   if (selectionTimeoutRef.current) {
  //     window.clearTimeout(selectionTimeoutRef.current);
  //   }
  //   // Small delay to allow browser properly recalculate selection
  //   selectionTimeoutRef.current = window.setTimeout(processSelection, SELECTION_RECALCULATE_DELAY_MS);
  // }

  // function handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
  //   if (e.button !== 2) {
  //     const listenerEl = e.currentTarget.closest(`.${INPUT_WRAPPER_CLASS}`) || e.target;

  //     listenerEl.addEventListener('mouseup', processSelectionWithTimeout, { once: true });
  //     return;
  //   }

  //   if (isContextMenuOpenRef.current) {
  //     return;
  //   }

  //   isContextMenuOpenRef.current = true;

  //   function handleCloseContextMenu(e2: KeyboardEvent | MouseEvent) {
  //     if (e2 instanceof KeyboardEvent && e2.key !== 'Esc' && e2.key !== 'Escape') {
  //       return;
  //     }

  //     setTimeout(() => {
  //       isContextMenuOpenRef.current = false;
  //     }, CONTEXT_MENU_CLOSE_DELAY_MS);

  //     window.removeEventListener('keydown', handleCloseContextMenu);
  //     window.removeEventListener('mousedown', handleCloseContextMenu);
  //   }

  //   document.addEventListener('mousedown', handleCloseContextMenu);
  //   document.addEventListener('keydown', handleCloseContextMenu);
  // }

  // function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  //   // https://levelup.gitconnected.com/javascript-events-handlers-keyboard-and-load-events-1b3e46a6b0c3#1960
  //   const { isComposing } = e;

  //   const html = getApiText();
  //   if (!isComposing && !html && (e.metaKey || e.ctrlKey)) {
  //     const targetIndexDelta = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : undefined;
  //     if (targetIndexDelta) {
  //       e.preventDefault();

  //       replyToNextMessage({ targetIndexDelta });
  //       return;
  //     }
  //   }

  //   if (!isComposing && e.key === 'Enter' && !e.shiftKey) {
  //     if (
  //       !isMobileDevice
  //       && (
  //         (messageSendKeyCombo === 'enter' && !e.shiftKey)
  //         || (messageSendKeyCombo === 'ctrl-enter' && (e.ctrlKey || e.metaKey))
  //       )
  //     ) {
  //       e.preventDefault();

  //       closeTextFormatter();
  //       onSend();
  //     }
  //   } else if (!isComposing && e.key === 'ArrowUp' && !html && !e.metaKey && !e.ctrlKey && !e.altKey) {
  //     e.preventDefault();
  //     editLastMessage();
  //   } else {
  //     e.target.addEventListener('keyup', processSelectionWithTimeout, { once: true });
  //   }
  // }

  // function undo() {
  //   const commit = commits.current[commits.current.length - 1 + commitsOffset.current];
  //   console.log('commit', commit, inputRef.current);
  //   if (!commit) {
  //     console.log('no undo');
  //     return;
  //   }

  //   switch (commit.type) {
  //     case 'addNode':
  //       console.log('remove', inputRef.current.childNodes[commit.pos]);
  //       inputRef.current.childNodes[commit.pos].remove();
  //   }

  //   commitsOffset.current--;
  // }

  // function redo() {
  //   const commit = commits.current[commits.current.length - 1 + commitsOffset.current + 1];

  //   console.log('redo', commit);
  //   switch (commit.type) {
  //     case 'addNode': {
  //       const element = document.createElement('span');
  //       element.dataset.type = commit.nodeType;
  //       element.innerText = commit.value;

  //       // don't parse markdown here cause it's a new commit

  //       const posNode = inputRef.current!.childNodes[commit.pos];

  //       if (commit.dir === 1) {
  //         inputRef.current!.insertBefore(element, posNode);
  //       } else if (posNode) {
  //         console.log(posNode);
  //         posNode.parentElement!.insertBefore(element, posNode.nextSibling);
  //       } else {
  //         inputRef.current!.after(element);
  //       }

  //       break;
  //     }
  //   }

  //   commitsOffset.current++;
  // }

  useEffect(() => {
    const input = inputRef.current!;

    function suppressFocus() {
      input.blur();
    }

    if (shouldSuppressFocus) {
      input.addEventListener('focus', suppressFocus);
    }

    return () => {
      input.removeEventListener('focus', suppressFocus);
    };
  }, [shouldSuppressFocus]);

  const isTouched = useDerivedState(
    () => Boolean(isActive && getApiText()),
    [isActive, getApiText],
  );

  const className = buildClassName(
    styles.form,
    'form-control allow-selection',
    isTouched && 'touched',
    shouldSuppressFocus && 'focus-disabled',
  );

  const inputScrollerContentClass = buildClassName(
    'input-scroller-content',
    isNeedPremium && 'is-need-premium',
  );

  return (
    <div id={id} onClick={shouldSuppressFocus ? onSuppressedFocus : undefined}>
      <div
        className={buildClassName(
          'custom-scroll',
          SCROLLER_CLASS,
          isNeedPremium && 'is-need-premium',
        )}
        onScroll={onScroll}
        // onClick={!isAttachmentModalInput && !canSendPlainText ? handleClick : undefined}
      >
        <div className={inputScrollerContentClass}>
          <MarkdownEditor
            ref={ref}
            className={className}
            aria-label={placeholder}
            onFocus={!isNeedPremium ? onFocus : undefined}
            onBlur={!isNeedPremium ? onBlur : undefined}
            role="textbox"
            dir="auto"
            onUpdate={onUpdate}
            tabIndex={0}
          />
          {!forcedPlaceholder && (
            <span
              className={buildClassName(
                'placeholder-text',
                !isAttachmentModalInput && !canSendPlainText && 'with-icon',
                isNeedPremium && 'is-need-premium',
              )}
              dir="auto"
            >
              {!isAttachmentModalInput && !canSendPlainText
                && <Icon name="lock-badge" className="placeholder-icon" />}
              {shouldDisplayTimer ? (
                <TextTimer langKey={timedPlaceholderLangKey!} endsAt={timedPlaceholderDate!} onEnd={handleTimerEnd} />
              ) : placeholder}
              {/* {isStoryInput && isNeedPremium && (
                <Button className="unlock-button" size="tiny" color="adaptive" onClick={handleOpenPremiumModal}>
                  {lang('StoryRepliesLockedButton')}
                </Button>
              )} */}
            </span>
          )}
          <canvas ref={sharedCanvasRef} className="shared-canvas" />
          <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
          <div
            ref={absoluteContainerRef}
            className="absolute-video-container"
          />
        </div>
      </div>
      <div
        ref={scrollerCloneRef}
        className={buildClassName(
          'custom-scroll',
          SCROLLER_CLASS,
          'clone',
          isNeedPremium && 'is-need-premium',
        )}
      >
        <div className={inputScrollerContentClass}>
          <div
            ref={cloneRef}
            className={buildClassName(className, 'clone')}
            dir="auto"
          />
        </div>
      </div>
      {captionLimit !== undefined && (
        <div className="max-length-indicator" dir="auto">
          {captionLimit}
        </div>
      )}
      {/* <TextFormatter
        isOpen={isTextFormatterOpen}
        anchorPosition={textFormatterAnchorPosition}
        selectedRange={selectedRange}
        setSelectedRange={setSelectedRange}
        onClose={handleCloseTextFormatter}
      /> */}
      {forcedPlaceholder && (
        <span className="forced-placeholder">
          {renderText(forcedPlaceholder!)}
        </span>
      )}
    </div>
  );
};

export default memo(
  withGlobal<OwnProps>((global, { chatId, threadId }: OwnProps): StateProps => {
    const { messageSendKeyCombo } = global.settings.byKey;

    return {
      messageSendKeyCombo,
      replyInfo:
        chatId && threadId
          ? selectDraft(global, chatId, threadId)?.replyInfo
          : undefined,
      isSelectModeActive: selectIsInSelectMode(global),
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
    };
  })(MessageInput),
);
