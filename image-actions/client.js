window.__ModuleLoader__.load({
  id: '@app-apopov/dsh-image-actions',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const {
      Menu,
      IconCopyOutlineRegular,
      IconDownloadOutlineRegular,
      IconEllipsisOutlineRegular,
      IconFolderOpenOutlineRegular,
      IconLinkOutlineRegular,
      IconLoadingOutlineRegular,
    } = require('@deepseek-ai/dsh-client-ui-primitives');

    const h = React.createElement;

    /** Locale namespace for this plugin's visible text. */
    const NS = 'image-actions';
    /** Document-relative form of the Host route. */
    const ROUTE = 'api/image-actions';
    /** Largest image the browser uploads to the Host; bigger sources use the Host path. */
    const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
    /** How long a completed notice stays on screen. */
    const NOTICE_MS = 6000;

    const en = {
      'actions': 'Image actions',
      'menu.copy': 'Copy image',
      'menu.save': 'Save to Downloads',
      'menu.revealFinder': 'Show in Finder',
      'menu.revealExplorer': 'Show in Explorer',
      'menu.revealFiles': 'Show in file manager',
      'menu.copyPath': 'Copy path',
      'menu.copyLink': 'Copy link',
      'toast.copied': 'Image copied',
      'toast.saved': 'Saved: {name}',
      'toast.reveal': 'Show',
      'toast.pathCopied': 'Path copied',
      'toast.linkCopied': 'Link copied',
      'error.copy': 'Could not copy the image: {message}',
      'error.save': 'Could not save the image: {message}',
      'error.reveal': 'Could not show the image: {message}',
      'error.tooLarge': 'This image is too large to copy or save.',
      'error.unsupported': 'This image format is not supported.',
      'error.notFound': 'The image file no longer exists.',
      'error.generic': 'Image action failed: {message}',
      'error.clipboardUnavailable': 'This browser cannot copy images to the clipboard.',
      'error.clipboardDenied': 'The browser did not allow copying the image to the clipboard.',
    };

    const ru = {
      'actions': 'Действия с изображением',
      'menu.copy': 'Копировать изображение',
      'menu.save': 'Сохранить в «Загрузки»',
      'menu.revealFinder': 'Показать в Finder',
      'menu.revealExplorer': 'Показать в Проводнике',
      'menu.revealFiles': 'Показать в файловом менеджере',
      'menu.copyPath': 'Скопировать путь',
      'menu.copyLink': 'Скопировать ссылку',
      'toast.copied': 'Изображение скопировано',
      'toast.saved': 'Сохранено: {name}',
      'toast.reveal': 'Показать',
      'toast.pathCopied': 'Путь скопирован',
      'toast.linkCopied': 'Ссылка скопирована',
      'error.copy': 'Не удалось скопировать изображение: {message}',
      'error.save': 'Не удалось сохранить изображение: {message}',
      'error.reveal': 'Не удалось показать изображение: {message}',
      'error.tooLarge': 'Изображение слишком большое для копирования или сохранения.',
      'error.unsupported': 'Этот формат изображения не поддерживается.',
      'error.notFound': 'Файла изображения больше нет.',
      'error.generic': 'Действие с изображением не удалось: {message}',
      'error.clipboardUnavailable': 'Этот браузер не умеет копировать изображения в буфер.',
      'error.clipboardDenied': 'Браузер не разрешил скопировать изображение в буфер.',
    };

    const zh = {
      'actions': '图像操作',
      'menu.copy': '复制图像',
      'menu.save': '保存到“下载”',
      'menu.revealFinder': '在访达中显示',
      'menu.revealExplorer': '在资源管理器中显示',
      'menu.revealFiles': '在文件管理器中显示',
      'menu.copyPath': '复制路径',
      'menu.copyLink': '复制链接',
      'toast.copied': '图像已复制',
      'toast.saved': '已保存：{name}',
      'toast.reveal': '显示',
      'toast.pathCopied': '路径已复制',
      'toast.linkCopied': '链接已复制',
      'error.copy': '无法复制图像：{message}',
      'error.save': '无法保存图像：{message}',
      'error.reveal': '无法显示图像：{message}',
      'error.tooLarge': '图像太大，无法复制或保存。',
      'error.unsupported': '不支持此图像格式。',
      'error.notFound': '图像文件已不存在。',
      'error.generic': '图像操作失败：{message}',
      'error.clipboardUnavailable': '此浏览器无法将图像复制到剪贴板。',
      'error.clipboardDenied': '浏览器不允许将图像复制到剪贴板。',
    };

    const CSS = [
      '.dsia-toolbar{position:fixed;z-index:1001;display:inline-flex;pointer-events:auto}',
      '.dsia-trigger{display:grid;place-items:center;width:36px;height:36px;padding:0;border:.5px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:999px;corner-shape:round;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);cursor:pointer}',
      '.dsia-trigger:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.dsia-trigger:disabled{cursor:default;opacity:.7}',
      '.dsia-trigger:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:3px}',
      '.dsia-trigger[data-busy="true"] svg{animation:dsia-spin .8s linear infinite}',
      '@keyframes dsia-spin{to{transform:rotate(360deg)}}',
      '@media (prefers-reduced-motion:reduce){.dsia-trigger[data-busy="true"] svg{animation:none}}',
      '.dsia-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1102;display:flex;align-items:center;gap:12px;box-sizing:border-box;max-width:min(520px,calc(100vw - 32px));padding:10px 14px;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;box-shadow:0 8px 24px var(--dsw-alias-shadow-l2,rgba(0,0,0,.18))}',
      '.dsia-toast[data-tone="error"]{color:var(--dsw-alias-state-error-primary)}',
      '.dsia-toast-text{min-width:0;overflow-wrap:anywhere}',
      '.dsia-toast-action{flex:none;padding:0;border:0;border-radius:4px;background:none;color:var(--dsw-alias-brand-primary);font:inherit;font-weight:500;cursor:pointer}',
      '.dsia-toast-action:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}',
    ].join('\n');

    /** A failure whose text is a localized message key, not a raw Host string. */
    class UserError extends Error {
      constructor(key, params) {
        super(key);
        this.name = 'UserError';
        this.key = key;
        this.params = params;
      }
    }

    /** The shortcut state published to the window-level key handler while a preview is open. */
    let shortcuts = null;

    /** Platform family used for shortcut labels and the reveal wording. */
    function platformFamily() {
      const platform = typeof navigator === 'undefined' ? '' : navigator.platform;
      if (/^Mac/i.test(platform)) return 'mac';
      if (/^Win/i.test(platform)) return 'win';
      return 'other';
    }

    /**
     * Labels for one shortcut on this platform.
     * @param key - the letter pressed with the primary modifier.
     * @param shift - whether Shift is part of the binding.
     * @returns keycap labels and the `aria-keyshortcuts` value.
     */
    function shortcutFor(key, shift) {
      const mac = platformFamily() === 'mac';
      const keys = [];
      if (shift) keys.push(mac ? '⇧' : 'Shift');
      keys.push(mac ? '⌘' : 'Ctrl');
      keys.push(key);
      return { keys, aria: `${mac ? 'Meta' : 'Control'}${shift ? '+Shift' : ''}+${key}` };
    }

    /** True for a lightbox root: a dialog with one picture, one close control, and no text. */
    function isLightbox(node) {
      if (!(node instanceof Element)) return false;
      if (node.getAttribute('role') !== 'dialog' || node.getAttribute('aria-modal') !== 'true') return false;
      if (node.textContent.trim() !== '') return false;
      if (node.querySelectorAll('img').length !== 1) return false;
      if (node.querySelectorAll('button').length !== 1) return false;
      return true;
    }

    /** The currently open image lightbox, if any. */
    function findLightbox() {
      for (const node of document.querySelectorAll('[role="dialog"][aria-modal="true"]')) {
        if (isLightbox(node)) return node;
      }
      return null;
    }

    /** Read the previewed picture's URL and alt text. */
    function pictureOf(root) {
      const image = root.querySelector('img');
      if (image === null) return null;
      const src = typeof image.currentSrc === 'string' && image.currentSrc !== ''
        ? image.currentSrc
        : image.getAttribute('src') ?? '';
      if (src === '') return null;
      return { src, alt: image.getAttribute('alt') ?? '' };
    }

    /**
     * The absolute local file behind a `/api/file?path=` preview URL.
     * @param src - the picture URL.
     * @returns the absolute path, or null when this picture is not a local file.
     */
    function filePathOf(src) {
      try {
        const url = new URL(src, document.baseURI);
        if (url.origin !== window.location.origin) return null;
        if (!url.pathname.endsWith('/api/file')) return null;
        const path = url.searchParams.get('path');
        if (path === null || path === '') return null;
        return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) ? path : null;
      } catch {
        return null;
      }
    }

    /**
     * The address worth copying for one preview: the original local path,
     * otherwise the remote URL, otherwise the last saved copy.
     * @returns a kind and its text, or null for an unsaved non-file picture.
     */
    function addressOf(src, savedPath) {
      const path = filePathOf(src);
      if (path !== null) return { kind: 'path', value: path };
      if (/^https?:/i.test(src)) return { kind: 'link', value: src };
      if (savedPath !== null) return { kind: 'path', value: savedPath };
      return null;
    }

    /** Basename of an absolute path without decoding surprises. */
    function baseName(path) {
      const normalized = path.replace(/\\/g, '/');
      return normalized.slice(normalized.lastIndexOf('/') + 1);
    }

    /**
     * A readable file name hint for the Host: the source file, the URL's last
     * segment, or the alt text when it looks like a name.
     * @returns a name without a guaranteed extension; the Host sniffs the type.
     */
    function nameHint(src, alt) {
      const path = filePathOf(src);
      if (path !== null && baseName(path) !== '') return baseName(path);
      try {
        const url = new URL(src, document.baseURI);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          const segment = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
          let decoded = segment;
          try { decoded = decodeURIComponent(segment); } catch { decoded = segment; }
          if (decoded !== '' && /\.[A-Za-z0-9]{1,8}$/.test(decoded)) return decoded;
        }
      } catch {
        // Not a URL: fall through to the alt text.
      }
      const text = alt.trim();
      if (text !== '' && text.length <= 100 && !/[\r\n]/.test(text)) return text;
      return 'image';
    }

    /** A DOM-rect-compatible object for a point, used as a menu anchor. */
    function rectAtPoint(x, y) {
      return { left: x, top: y, right: x, bottom: y, width: 0, height: 0, x, y };
    }

    /** A DOM-rect-compatible plain copy of a measured rect. */
    function rectOf(rect) {
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        x: rect.left,
        y: rect.top,
      };
    }

    /** One authenticated Host call. A refusal keeps its stable code. */
    async function callHost(body) {
      const response = await fetch(ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      if (!response.ok) {
        const message = typeof payload?.message === 'string' && payload.message !== ''
          ? payload.message
          : `HTTP ${response.status}`;
        const failure = new Error(message);
        failure.code = typeof payload?.code === 'string' ? payload.code : '';
        throw failure;
      }
      return payload;
    }

    /** Fetch the picture bytes; a CORS-blocked remote picture falls back to the Host. */
    async function imageBlob(record) {
      try {
        const response = await fetch(record.src, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.blob();
      } catch (error) {
        if (!/^https?:/i.test(record.src)) throw error;
        const reply = await callHost({ action: 'read', src: record.src });
        const data = typeof reply?.data === 'string' ? reply.data : '';
        if (data === '') throw error;
        const mime = typeof reply?.mime === 'string' ? reply.mime : 'image/png';
        return base64ToBlob(data, mime);
      }
    }

    /** Base64 text for one blob, through the FileReader every target browser has. */
    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === 'string' ? reader.result : '';
          const comma = result.indexOf(',');
          resolve(comma === -1 ? '' : result.slice(comma + 1));
        };
        reader.onerror = () => reject(reader.error ?? new Error('could not read the image'));
        reader.readAsDataURL(blob);
      });
    }

    /** Decode host-provided base64 into a blob. */
    function base64ToBlob(data, mime) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return new Blob([bytes], { type: mime });
    }

    /** Re-encode any decodable picture as PNG, the only clipboard image type Chromium accepts. */
    async function toPngBlob(blob) {
      if (blob.type === 'image/png') return blob;
      const url = URL.createObjectURL(blob);
      try {
        const image = await new Promise((resolve, reject) => {
          const element = new Image();
          element.onload = () => resolve(element);
          element.onerror = () => reject(new UserError('error.unsupported'));
          element.src = url;
        });
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        if (width === 0 || height === 0) throw new UserError('error.unsupported');
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (context === null) throw new UserError('error.unsupported');
        context.drawImage(image, 0, 0);
        return await new Promise((resolve, reject) => {
          canvas.toBlob(
            result => result === null ? reject(new UserError('error.unsupported')) : resolve(result),
            'image/png',
          );
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    /** Copy the picture itself to the system clipboard. */
    async function copyImage(record) {
      if (typeof ClipboardItem === 'undefined' || typeof navigator.clipboard?.write !== 'function') {
        throw new UserError('error.clipboardUnavailable');
      }
      const blob = await imageBlob(record);
      if (blob.size > MAX_UPLOAD_BYTES) throw new UserError('error.tooLarge');
      const png = await toPngBlob(blob);
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      } catch {
        throw new UserError('error.clipboardDenied');
      }
    }

    /**
     * Save the picture through the Host. A local file is copied on disk; every
     * other source goes as bytes, with the Host fetching a CORS-blocked URL.
     * @returns the Host reply with `path` and `name`.
     */
    async function saveImage(record) {
      const path = filePathOf(record.src);
      const name = nameHint(record.src, record.alt);
      if (path !== null) return callHost({ action: 'save-path', path, name });
      try {
        const blob = await imageBlob(record);
        if (blob.size > MAX_UPLOAD_BYTES) throw new UserError('error.tooLarge');
        return callHost({
          action: 'save',
          name,
          data: await blobToBase64(blob),
        });
      } catch (error) {
        if (error instanceof UserError) throw error;
        if (!/^https?:/i.test(record.src)) throw error;
        return callHost({ action: 'save-src', src: record.src, name });
      }
    }

    /** Ask the Host to reveal a file in the platform's file manager. */
    function revealPath(path) {
      return callHost({ action: 'reveal', path });
    }

    /** Copy text, with the legacy selection fallback for hosts without the async API. */
    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (error) {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.inset = '0';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try {
          if (!document.execCommand('copy')) throw error;
        } finally {
          area.remove();
        }
      }
    }

    /** Resolve a caught value into operator-facing text. */
    function errorText(t, error, key) {
      if (error instanceof UserError) return t(error.key, error.params);
      const code = typeof error?.code === 'string' ? error.code : '';
      const known = {
        TOO_LARGE: 'error.tooLarge',
        UNSUPPORTED_IMAGE: 'error.unsupported',
        NOT_FOUND: 'error.notFound',
        NOT_FILE: 'error.notFound',
      }[code];
      if (known !== undefined) return t(known);
      const message = error instanceof Error && error.message !== '' ? error.message : 'unknown failure';
      return t(key, { message });
    }

    /**
     * The shell overlay: detects the shipped image lightbox, adds an actions
     * trigger beside its close control, and owns the menu, notices, and
     * keyboard shortcuts until the preview closes.
     */
    function ImageActionsOverlay({ t }) {
      const [active, setActive] = React.useState(null);
      const [menu, setMenu] = React.useState(null);
      const [toolbar, setToolbar] = React.useState(null);
      const [busy, setBusy] = React.useState(null);
      const [notice, setNotice] = React.useState(null);
      const [savedPath, setSavedPath] = React.useState(null);
      const activeRef = React.useRef(null);
      const busyRef = React.useRef(null);
      const triggerRef = React.useRef(null);
      const noticeSeq = React.useRef(0);
      activeRef.current = active;
      busyRef.current = busy;

      /** Show one transient notice; its timer restarts for every new notice. */
      const notify = React.useCallback((next) => {
        noticeSeq.current += 1;
        setNotice({ ...next, id: noticeSeq.current });
      }, []);

      /** Run one action with a busy state and a notice for a failure. */
      const run = React.useCallback((task, key) => {
        if (busyRef.current !== null) return;
        setMenu(null);
        setBusy(key);
        void task()
          .catch((error) => {
            const failure = {
              copy: 'error.copy',
              save: 'error.save',
              reveal: 'error.reveal',
            }[key] ?? 'error.generic';
            notify({ tone: 'error', text: errorText(t, error, failure) });
          })
          .finally(() => {
            setBusy(null);
          });
      }, [notify, t]);

      /** Copy the previewed picture to the clipboard. */
      const copy = React.useCallback(() => {
        const record = activeRef.current;
        if (record === null) return;
        run(async () => {
          await copyImage(record);
          notify({ tone: 'success', text: t('toast.copied') });
        }, 'copy');
      }, [notify, run, t]);

      /** Save the picture into Downloads and offer to reveal it. */
      const save = React.useCallback(() => {
        const record = activeRef.current;
        if (record === null) return;
        run(async () => {
          const reply = await saveImage(record);
          if (typeof reply?.path === 'string') setSavedPath(reply.path);
          const name = typeof reply?.name === 'string' ? reply.name : nameHint(record.src, record.alt);
          notify({
            tone: 'success',
            text: t('toast.saved', { name }),
            actionLabel: typeof reply?.path === 'string' ? t('toast.reveal') : undefined,
            onAction: typeof reply?.path === 'string'
              ? () => { run(() => revealPath(reply.path), 'reveal'); }
              : undefined,
          });
        }, 'save');
      }, [notify, run, t]);

      /** Reveal the saved copy, or the original local file; materialize first when neither exists. */
      const reveal = React.useCallback(() => {
        const record = activeRef.current;
        if (record === null) return;
        run(async () => {
          const existing = savedPath ?? filePathOf(record.src);
          if (existing !== null) {
            await revealPath(existing);
            return;
          }
          const reply = await saveImage(record);
          const path = typeof reply?.path === 'string' ? reply.path : null;
          if (path === null) return;
          setSavedPath(path);
          await revealPath(path);
          notify({ tone: 'success', text: t('toast.saved', { name: reply.name ?? '' }) });
        }, 'reveal');
      }, [notify, run, savedPath, t]);

      /** Copy the local path, or the URL when the picture is remote. */
      const copyAddress = React.useCallback(() => {
        const record = activeRef.current;
        if (record === null) return;
        const address = addressOf(record.src, savedPath);
        if (address === null) return;
        run(async () => {
          await copyText(address.value);
          notify({ tone: 'success', text: t(address.kind === 'path' ? 'toast.pathCopied' : 'toast.linkCopied') });
        }, 'address');
      }, [notify, run, savedPath, t]);

      // Watch the body portal for the shipped preview opening and closing.
      React.useEffect(() => {
        let alive = true;
        const sync = () => {
          if (!alive) return;
          const root = findLightbox();
          if (root === null) {
            setActive(null);
            setMenu(null);
            return;
          }
          const picture = pictureOf(root);
          if (picture === null) return;
          const current = activeRef.current;
          if (current === null || current.root !== root || current.src !== picture.src) {
            setSavedPath(null);
            setMenu(null);
            setActive({ root, ...picture });
          }
        };
        const observer = new MutationObserver(sync);
        observer.observe(document.body, { childList: true });
        sync();
        return () => {
          alive = false;
          observer.disconnect();
        };
      }, []);

      // Place the trigger next to the preview's own close control, including
      // the Windows caption offset the stage reserves.
      React.useLayoutEffect(() => {
        if (active === null) {
          setToolbar(null);
          return;
        }
        const place = () => {
          const close = active.root.querySelector('button');
          const rect = close === null ? null : close.getBoundingClientRect();
          if (rect === null || rect.width === 0) {
            setToolbar(current => current ?? { top: 20, right: 68 });
            return;
          }
          const top = Math.round(rect.top);
          const left = Math.max(8, Math.round(rect.left - rect.width - 8));
          setToolbar(current => current !== null && current.top === top && current.left === left
            ? current
            : { top, left });
        };
        place();
        const frame = requestAnimationFrame(place);
        window.addEventListener('resize', place);
        let observer;
        if (typeof ResizeObserver === 'function') {
          observer = new ResizeObserver(place);
          observer.observe(active.root);
        }
        return () => {
          cancelAnimationFrame(frame);
          window.removeEventListener('resize', place);
          observer?.disconnect();
        };
      }, [active]);

      // The preview's own Escape/Tab handling runs on window capture before
      // this component mounts, so right-click gets its own menu here and a
      // non-primary press never reaches the backdrop's close handler.
      React.useEffect(() => {
        const onContextMenu = (event) => {
          const record = activeRef.current;
          if (record === null || !(event.target instanceof Node) || !record.root.contains(event.target)) return;
          event.preventDefault();
          event.stopPropagation();
          setMenu({ align: 'start', rect: rectAtPoint(event.clientX, event.clientY) });
        };
        const onMouseDown = (event) => {
          const record = activeRef.current;
          if (record === null || event.button === 0) return;
          if (event.target instanceof Node && record.root.contains(event.target)) event.stopPropagation();
        };
        document.addEventListener('contextmenu', onContextMenu, true);
        document.addEventListener('mousedown', onMouseDown, true);
        return () => {
          document.removeEventListener('contextmenu', onContextMenu, true);
          document.removeEventListener('mousedown', onMouseDown, true);
        };
      }, []);

      // Publish the shortcuts only while a picture is under the actions menu
      // and no action is already running.
      React.useEffect(() => {
        if (active === null || busy !== null) {
          shortcuts = null;
          return;
        }
        shortcuts = { copy, save };
        return () => {
          shortcuts = null;
        };
      }, [active, busy, copy, save]);

      // One timer per notice; a new notice replaces the previous one.
      React.useEffect(() => {
        if (notice === null) return;
        const timer = setTimeout(() => { setNotice(null); }, NOTICE_MS);
        return () => { clearTimeout(timer); };
      }, [notice]);

      if (active === null) {
        return notice === null ? null : createPortal(
          h(Notice, { notice, onDismiss: () => { setNotice(null); } }),
          document.body,
        );
      }

      const address = addressOf(active.src, savedPath);
      const items = [
        {
          id: 'copy',
          label: t('menu.copy'),
          icon: h(IconCopyOutlineRegular, { size: 14 }),
          shortcut: shortcutFor('C', false),
          disabled: busy !== null,
        },
        {
          id: 'save',
          label: t('menu.save'),
          icon: h(IconDownloadOutlineRegular, { size: 14 }),
          shortcut: shortcutFor('S', false),
          disabled: busy !== null,
        },
        { type: 'separator', id: 'separator-reveal' },
        {
          id: 'reveal',
          label: t(platformFamily() === 'mac'
            ? 'menu.revealFinder'
            : platformFamily() === 'win' ? 'menu.revealExplorer' : 'menu.revealFiles'),
          icon: h(IconFolderOpenOutlineRegular, { size: 14 }),
          disabled: busy !== null,
        },
        ...address === null ? [] : [{
          id: 'address',
          label: t(address.kind === 'path' ? 'menu.copyPath' : 'menu.copyLink'),
          icon: h(IconLinkOutlineRegular, { size: 14 }),
          disabled: busy !== null,
        }],
      ];

      const openTriggerMenu = () => {
        if (menu !== null) {
          setMenu(null);
          return;
        }
        const trigger = triggerRef.current;
        const rect = trigger === null ? null : trigger.getBoundingClientRect();
        setMenu({ align: 'end', rect: rect === null ? null : rectOf(rect) });
      };

      const trigger = h(
        'button',
        {
          type: 'button',
          ref: triggerRef,
          className: 'dsia-trigger',
          title: t('actions'),
          'aria-label': t('actions'),
          'aria-haspopup': 'menu',
          'aria-expanded': menu !== null,
          'aria-busy': busy !== null || undefined,
          'data-busy': busy !== null ? 'true' : undefined,
          disabled: busy !== null,
          onClick: openTriggerMenu,
        },
        busy !== null
          ? h(IconLoadingOutlineRegular, { size: 16 })
          : h(IconEllipsisOutlineRegular, { size: 16 }),
      );

      const onSelect = (id) => {
        setMenu(null);
        if (id === 'copy') copy();
        else if (id === 'save') save();
        else if (id === 'reveal') reveal();
        else if (id === 'address') copyAddress();
      };

      const toolbarStyle = toolbar === null
        ? { top: 20, right: 68 }
        : { top: toolbar.top, ...(toolbar.right === undefined ? { left: toolbar.left } : { right: toolbar.right }) };

      return h(
        React.Fragment,
        null,
        createPortal(
          h('div', { className: 'dsia-toolbar', style: toolbarStyle },
            h(Menu, {
              open: menu !== null,
              anchor: trigger,
              items,
              align: menu?.align ?? 'end',
              portal: true,
              getAnchorRect: () => menu?.rect ?? null,
              onSelect,
              onClose: () => { setMenu(null); },
            })),
          document.body,
        ),
        notice === null
          ? null
          : createPortal(h(Notice, { notice, onDismiss: () => { setNotice(null); } }), document.body),
      );
    }

    /** One transient result notice with an optional follow-up action. */
    function Notice({ notice, onDismiss }) {
      return h(
        'div',
        {
          className: 'dsia-toast',
          'data-tone': notice.tone,
          role: notice.tone === 'error' ? 'alert' : 'status',
        },
        h('span', { className: 'dsia-toast-text' }, notice.text),
        notice.actionLabel === undefined
          ? null
          : h(
            'button',
            {
              type: 'button',
              className: 'dsia-toast-action',
              onClick: () => {
                onDismiss();
                notice.onAction?.();
              },
            },
            notice.actionLabel,
          ),
      );
    }

    /** Window-level bindings that precede the preview's own capture listener. */
    function onShortcut(event) {
      if (shortcuts === null || event.repeat) return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      // `code` keeps the binding on the physical key under a non-Latin layout.
      if (event.code !== 'KeyC' && event.code !== 'KeyS') return;
      event.preventDefault();
      if (event.code === 'KeyC') shortcuts.copy();
      else shortcuts.save();
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, ru, zh }), 'image-actions: dictionaries');

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = '@app-apopov/dsh-image-actions';
          tag.dataset.pluginCss = '@app-apopov/dsh-image-actions/image-actions.css';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => {
            tag.remove();
          };
        }, 'image-actions: styles');

        ctx.effect(() => {
          window.addEventListener('keydown', onShortcut, true);
          return () => {
            window.removeEventListener('keydown', onShortcut, true);
            shortcuts = null;
          };
        }, 'image-actions: shortcuts');

        ctx.slots.inject('shell.overlay', () => ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'image-actions',
            order: 400,
            locale: NS,
          },
          ImageActionsOverlay,
        ));
      },
    };
  },
});
