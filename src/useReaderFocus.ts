import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

type Collector = { value: string; setValue(value: string): void; clear(): void };
const editable = (element: Element | null) => element?.closest('input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])');
type ReaderState = 'ready' | 'inactive' | 'unfocused' | 'paused';

export function useReaderFocus(input: RefObject<HTMLInputElement | null>, active: boolean, collector: Collector) {
  const enabled = useRef(active);
  const [readerState, setReaderState] = useState<ReaderState>('unfocused');
  enabled.current = active;
  const focus = useCallback(() => {
    if (enabled.current && document.visibilityState !== 'hidden') input.current?.focus({ preventScroll: true });
  }, [input]);

  useEffect(() => {
    if (!active) return;
    let timer: number | undefined;
    function restore(allowButton: boolean) {
      const current = document.activeElement;
      if (current !== input.current && editable(current)) return;
      // Keep deliberate Tab navigation usable. A reader's first printable key
      // will return to the scan field without activating the focused button.
      if (!allowButton && current?.closest('button, a, summary, [role="button"]')) return;
      focus();
    }
    function schedule(allowButton: boolean) {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => restore(allowButton), 0);
    }
    const pointer = () => schedule(true);
    const blur = () => schedule(false);
    const resume = () => restore(true);
    const leave = () => collector.clear();
    function key(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey
        || event.key.length !== 1 || !event.key.trim() || editable(event.target instanceof Element ? event.target : null)
        || document.visibilityState === 'hidden') return;
      // Recover the first character as well as focus when a HID reader starts
      // while a button/body is focused. Do not intercept other editable fields.
      event.preventDefault();
      focus();
      collector.setValue(collector.value + event.key);
    }
    focus();
    document.addEventListener('pointerup', pointer);
    document.addEventListener('focusout', blur);
    document.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('blur', leave);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerup', pointer);
      document.removeEventListener('focusout', blur);
      document.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('blur', leave);
    };
  }, [active, collector, focus, input]);

  useEffect(() => {
    let foreground = document.hasFocus();
    function update() {
      setReaderState(document.visibilityState === 'hidden' || !foreground ? 'inactive'
        : !active ? 'paused' : document.activeElement === input.current ? 'ready' : 'unfocused');
    }
    const activate = () => { foreground = true; update(); };
    const deactivate = () => { foreground = false; update(); };
    const visibility = () => { foreground = document.hasFocus(); update(); };
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', activate);
    window.addEventListener('blur', deactivate);
    window.addEventListener('pageshow', visibility);
    update();
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', activate);
      window.removeEventListener('blur', deactivate);
      window.removeEventListener('pageshow', visibility);
    };
  }, [active, input]);

  return { focus, readerState };
}
