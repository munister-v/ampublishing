let lockCount = 0;

export const setDocumentScrollLock = (locked: boolean) => {
  if (typeof document === 'undefined') return;

  lockCount = Math.max(0, lockCount + (locked ? 1 : -1));
  document.documentElement.classList.toggle('scroll-locked', lockCount > 0);
  document.body.classList.toggle('scroll-locked', lockCount > 0);
};
