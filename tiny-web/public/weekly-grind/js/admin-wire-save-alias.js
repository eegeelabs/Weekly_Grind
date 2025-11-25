/* admin-wire-save-alias.js — make every Save button call the real (bottom) Save */
(() => {
  if (window.__ADMIN_SAVE_ALIAS__) return;
  window.__ADMIN_SAVE_ALIAS__ = true;

  const looksSave = (el) => {
    const txt = [
      el?.innerText, el?.value, el?.getAttribute?.('aria-label'),
      el?.title, el?.id, el?.name, el?.className
    ].filter(Boolean).join(' ');
    return /\b(save|commit|persist|apply|submit|write|upload|update)\b/i.test(txt);
  };

  const findSaveCandidates = () => {
    const sels = 'button,[role="button"],a[href],input[type=button],input[type=submit]';
    return [...document.querySelectorAll(sels)]
      .filter(looksSave)
      .sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  };

  const wire = () => {
    const candidates = findSaveCandidates();
    if (candidates.length < 2) return; // only one Save — nothing to alias
    const primary = candidates[candidates.length - 1]; // bottom-most = real save
    candidates.slice(0, -1).forEach(btn => {
      if (btn.__wgAliasWired) return;
      btn.__wgAliasWired = true;
      btn.addEventListener('click', (e) => {
        // Make the top button behave exactly like the real one
        e.preventDefault();
        e.stopPropagation();

        const form = primary.closest?.('form');
        if (form && form.requestSubmit) {
          // Submit the same form using the primary as submitter (fires its listeners)
          form.requestSubmit(primary);
        } else {
          // Fall back to a synthetic click on the primary
          primary.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
      }, true);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  // Re-apply if the DOM re-renders
  new MutationObserver(() => wire()).observe(document.body, { childList: true, subtree: true });
})();
