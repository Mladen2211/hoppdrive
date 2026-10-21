'use client';

/**
 * Warns before unsaved changes are lost:
 *  - closing / reloading the tab or leaving the site: the browser's own beforeunload prompt
 *  - clicking a link to another page of the admin (sidebar, bottom nav, top bar): a confirm dialog
 *    (Next's app router has no navigation blocker, so internal links are intercepted in the capture phase)
 *
 *   useUnsavedGuard(dirty);
 */
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useConfirm } from '@/components/ui';
import { tr } from '@/i18n/active';

export function useUnsavedGuard(dirty: boolean, description = tr('content.ihreAenderungenSindNoch')) {
  const router = useRouter();
  const confirm = useConfirm();
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ''; // required by some browsers to show the prompt
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      event.preventDefault();
      event.stopPropagation();
      void confirmRef
        .current({
          title: tr('common.aenderungenVerwerfen'),
          description,
          confirmLabel: tr('content.verwerfenUndWeiter'),
          cancelLabel: tr('content.hierBleiben'),
        })
        .then((ok) => {
          if (ok) routerRef.current.push(`${url.pathname}${url.search}${url.hash}`);
        });
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, description]);
}
