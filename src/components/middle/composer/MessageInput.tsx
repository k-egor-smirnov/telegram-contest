import type { ChangeEvent, RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect,
  useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiInputMessageReplyInfo } from '../../../api/types';
import type { AnyNode, TelegramObjectModel } from '../../../lib/MarkdownParser';
import type { ISettings, ThreadId } from '../../../types';
import type { Signal } from '../../../util/signals';

import { EDITABLE_INPUT_ID } from '../../../config';
import { MarkdownParser } from '../../../lib/MarkdownParser';
import { selectCanPlayAnimatedEmojis, selectDraft, selectIsInSelectMode } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { generateRandomInt } from '../../../api/gramjs/gramjsBuilders';
import renderText from '../../common/helpers/renderText';

import useDerivedState from '../../../hooks/useDerivedState';

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

function getPreviousNode(node) {
  if (node.previousSibling) return node.previousSibling;
  while (node) {
    if (node.previousSibling) return node.previousSibling;
    node = node.parentNode;
  }
}

function getNodesBetween(start: HTMLElement, end: HTMLElement) {
  const nodes = new Set<Node>();
  let node = start;

  while (node && node !== end) {
    if (node?.dataset?.id) {
      nodes.add(node);
    }
    node = getNextNode(node);
  }

  return [...nodes].map((v) => (v?.nodeType === 3 ? v.parentNode : v)).filter(Boolean);
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

  return [...nodes].map((v) => (v?.nodeType === 3 ? v.parentNode : v)).filter(Boolean);
}

function getNodesAroundRange(range: Range) {
  const start = range.startContainer;
  const end = range.endContainer;

  let startNode = getPreviousNode(start);
  while (startNode && !startNode?.dataset?.id) {
    startNode = getPreviousNode(startNode);
  }

  let endNode = getNextNode(end);
  while (endNode && !endNode?.dataset?.id) {
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
  getHtml: Signal<string>;
  placeholder: string;
  timedPlaceholderLangKey?: string;
  timedPlaceholderDate?: number;
  forcedPlaceholder?: string;
  noFocusInterception?: boolean;
  canAutoFocus: boolean;
  shouldSuppressFocus?: boolean;
  shouldSuppressTextFormatter?: boolean;
  canSendPlainText?: boolean;
  onUpdate: (html: string) => void;
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

function clearSelection() {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  if (selection.removeAllRanges) {
    selection.removeAllRanges();
  } else if (selection.empty) {
    selection.empty();
  }
}

function getTypedNodeFromSelection() {
  const focusNode = document.getSelection()?.focusNode as HTMLElement;
  if (!focusNode) {
    return undefined;
  }
  const focusNodeElement: HTMLElement | null = focusNode.nodeType === 3 ? focusNode.parentElement : focusNode;

  const closestTypedNode = focusNodeElement?.dataset?.id
    ? focusNodeElement
    : (focusNodeElement?.closest?.('[data-id]:not(span)') as HTMLElement);

  return closestTypedNode;
}

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
  getHtml,
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

  // const [shouldDisplayTimer, setShouldDisplayTimer] = useState(false);

  // useEffect(() => {
  //   setShouldDisplayTimer(Boolean(timedPlaceholderLangKey && timedPlaceholderDate));
  // }, [timedPlaceholderDate, timedPlaceholderLangKey]);

  // const handleTimerEnd = useLastCallback(() => {
  //   setShouldDisplayTimer(false);
  // });

  // useInputCustomEmojis(
  //   getHtml,
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

  // const htmlRef = useRef(getHtml());
  // useLayoutEffect(() => {
  //   const html = isActive ? getHtml() : '';

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
  // }, [getHtml, isActive, updateInputHeight]);

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

  //   const html = getHtml();
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

  useEffect(() => {
    inputRef.current.innerHTML = new MarkdownParser().parse('hello **bold** or __italic__ world').html;
  }, []);

  function handleChange(e: ChangeEvent<HTMLDivElement>) {
    // console.log(document.getSelection()?.focusNode, document.getSelection()?.anchorNode);

    // inputRef.current.innerHTML = new MarkdownParser().toHTML(new MarkdownParser().parse(inputRef.current?.innerHTML ?? ''));
    // console.log(e,
    //   inputRef.current,
    //   new MarkdownParser().toHTML(new MarkdownParser().parse(inputRef.current?.innerHTML ?? '')));

    // const closestTypedNode = getTypedNodeFromSelection();
    // const messageNode = textModel.current?.getNodeById(closestTypedNode?.dataset.id);

    // if (messageNode) {
    //   messageNode.text = closestTypedNode?.textContent ?? '';
    // }

    // console.log(textModel.current?.children);

    // при удалении маркера раскрывать сообщение на составные части, чтобы маркер стал частью обычного текста

    // функция валидации и сравнения модели с HTML

    // [...inputRef.current?.childNodes].forEach((child: Node) => {
    //   if (child.nodeType === 3) {
    //     const nodeId = generateRandomInt().toString();
    //     const node: TextMessageNode = {
    //       id: nodeId,
    //       text: child.textContent ?? '',
    //       type: 'text',
    //       children: [],
    //     };

    //     textModel.current.push(node);

    //     const spanNode = document.createElement('span');
    //     spanNode.dataset.id = nodeId;
    //     child.parentNode?.insertBefore(spanNode, child);
    //     spanNode.appendChild(child);
    //   }
    // });
  }

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

  useEffect(() => {
    function selectNodes() {
      const selection = document.getSelection();

      if (!selection?.rangeCount) {
        return;
      }

      const allMarkers = inputRef.current?.querySelectorAll('.marker');
      const keepMarkers = new Set<HTMLElement>();

      getNodesInRange(selection?.getRangeAt(0)).filter((v) => v.dataset?.id).forEach((el: HTMLElement) => {
        const nodeModel = textModel.current?.getNodeById(el.dataset.id);

        if (nodeModel?.type === 'text') {
          return;
        }

        const marker = nodeModel?.marker;

        if (marker) {
          if (el.firstChild?.classList.contains('marker')) {
            keepMarkers.add(el.firstChild as HTMLElement);
          } else {
            const leftMarkerNode = document.createElement('span');
            leftMarkerNode.className = 'marker';
            leftMarkerNode.innerHTML = nodeModel?.marker;
            el?.insertBefore(leftMarkerNode, el.firstChild);
          }

          if (el.lastChild?.classList.contains('marker')) {
            keepMarkers.add(el.lastChild as HTMLElement);
          } else {
            const rightMarkerNode = document.createElement('span');
            rightMarkerNode.className = 'marker';
            rightMarkerNode.innerHTML = nodeModel?.marker;
            el?.appendChild(rightMarkerNode);
          }
        } else {
          console.warn('not found marker', nodeModel, el);
        }
      });

      allMarkers?.forEach((marker) => {
        if (!keepMarkers.has(marker)) {
          marker.remove();
        }
      });
    }

    function handleSelectionChange() {
      const scanStart = prevSelectionNodes.current[0];
      const scanEnd = prevSelectionNodes.current[1];

      let scanNode = scanStart;
      let scanNodeModel = textModel.current?.getNodeById!(scanNode?.dataset?.id);

      // TODO: if marker is changed, ungroup node to text nodes

      // add new nodes first between start and end

      console.log(getNodesBetween(scanStart, scanEnd));

      while (scanNodeModel && scanNodeModel?.id !== scanEnd?.dataset?.id) {
        const nextSibling = scanNodeModel?.nextSibling;

        if (scanNodeModel && !inputRef.current?.querySelector(`[data-id="${scanNodeModel?.id}"]`)) {
          // maybe forward delete
          scanNodeModel.remove();
        }

        scanNodeModel = nextSibling;
        scanNode = inputRef.current?.querySelector(`[data-id="${scanNodeModel?.id}"]`);

        if (scanNodeModel && !scanNode) {
          scanNodeModel.remove();
        }

        // TODO add nodes after undo
      }

      console.log(textModel.current);

      // const nextNodeModel = scanNodeModel?.nextSibling;

      // console.log(scanNode, scanNodeModel, nextNodeModel);
      // if (!inputRef.current?.querySelector(`[data-id="${nextNodeModel?.id}"]`)) {
      //   console.log('not found next', nextNodeModel?.type);
      // }

      prevSelectionNodes.current = getNodesAroundRange(document.getSelection()?.getRangeAt(0));

      if (mouseLockedRef.current) {
        return;
      }

      selectNodes();
    }

    function handleMouseUp() {
      mouseLockedRef.current = false;
      selectNodes();
    }

    function handleMouseDown() {
      mouseLockedRef.current = true;
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const isTouched = useDerivedState(() => Boolean(isActive && getHtml()), [isActive, getHtml]);

  const className = buildClassName(
    'form-control allow-selection',
    isTouched && 'touched',
    shouldSuppressFocus && 'focus-disabled',
  );

  const inputScrollerContentClass = buildClassName('input-scroller-content', isNeedPremium && 'is-need-premium');

  return (
    <div id={id} onClick={shouldSuppressFocus ? onSuppressedFocus : undefined}>
      <div
        className={buildClassName('custom-scroll', SCROLLER_CLASS, isNeedPremium && 'is-need-premium')}
        onScroll={onScroll}
        // onClick={!isAttachmentModalInput && !canSendPlainText ? handleClick : undefined}
      >
        <div className={inputScrollerContentClass}>
          <div
            ref={inputRef}
            id={editableInputId || EDITABLE_INPUT_ID}
            className={className}
            contentEditable={isAttachmentModalInput || canSendPlainText}
            role="textbox"
            dir="auto"
            tabIndex={0}
            // onClick={focusInput}
            onChange={handleChange}
            // onKeyDown={handleKeyDown}
            // onMouseDown={handleMouseDown}
            // onContextMenu={IS_ANDROID ? handleAndroidContextMenu : undefined}
            // onTouchCancel={IS_ANDROID ? processSelectionWithTimeout : undefined}
            aria-label={placeholder}
            onFocus={!isNeedPremium ? onFocus : undefined}
            onBlur={!isNeedPremium ? onBlur : undefined}
          />
          {/* {!forcedPlaceholder && (
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
              {isStoryInput && isNeedPremium && (
                <Button className="unlock-button" size="tiny" color="adaptive" onClick={handleOpenPremiumModal}>
                  {lang('StoryRepliesLockedButton')}
                </Button>
              )}
            </span>
          )} */}
          <canvas ref={sharedCanvasRef} className="shared-canvas" />
          <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
          <div ref={absoluteContainerRef} className="absolute-video-container" />
        </div>
      </div>
      <div
        ref={scrollerCloneRef}
        className={buildClassName('custom-scroll',
          SCROLLER_CLASS,
          'clone',
          isNeedPremium && 'is-need-premium')}
      >
        <div className={inputScrollerContentClass}>
          <div ref={cloneRef} className={buildClassName(className, 'clone')} dir="auto" />
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
      {forcedPlaceholder && <span className="forced-placeholder">{renderText(forcedPlaceholder!)}</span>}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }: OwnProps): StateProps => {
    const { messageSendKeyCombo } = global.settings.byKey;

    return {
      messageSendKeyCombo,
      replyInfo: chatId && threadId ? selectDraft(global, chatId, threadId)?.replyInfo : undefined,
      isSelectModeActive: selectIsInSelectMode(global),
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
    };
  },
)(MessageInput));
