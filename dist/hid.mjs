// HID readers send ordinary keyboard/input events. No Bluetooth or WebHID API.
// A terminator is preferred. Idle completion is allowed only for known codes.
export function createHidCollector({ onRead, isKnown, onPartial = () => {}, delay = 600,
  schedule = setTimeout, unschedule = clearTimeout, now = () => Date.now() }) {
  let value = '', timer = null, lastTerminator = -Infinity;
  function clear() {
    if (timer !== null) unschedule(timer);
    timer = null; value = ''; onPartial('');
  }
  function submit() {
    const code = value.trim(); clear();
    if (code) onRead(code);
  }
  function setValue(raw) {
    if (timer !== null) unschedule(timer);
    value = String(raw).slice(0, 256); onPartial(value);
    timer = schedule(() => { timer = null; if (isKnown(value.trim())) submit(); }, delay);
  }
  function key(event) {
    if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return false;
    if (event.key === 'Enter' || event.key === 'Tab') {
      if (value || now() - lastTerminator < 300) {
        event.preventDefault(); lastTerminator = now(); submit(); return true;
      }
      return false;
    }
    if (event.key === 'Escape') { clear(); return false; }
    return false;
  }
  return { setValue, key, clear, get value() { return value; } };
}
