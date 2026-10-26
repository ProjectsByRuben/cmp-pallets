// Only unconfirmed screen state is kept here. Saved business data is never undone.
export function createNavigation(makeHome) {
  let current = makeHome(), trail = [];
  function visit(next) {
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      trail.push(structuredClone(current));
      if (trail.length > 40) trail.shift();
      current = structuredClone(next);
    }
    return current;
  }
  function home() { trail = []; current = makeHome(); return current; }
  return {
    get current() { return current; },
    get canGoBack() { return trail.length > 0; },
    visit,
    back() { current = trail.pop() || makeHome(); return current; },
    home,
    restart(next) { home(); return visit(next); },
  };
}
