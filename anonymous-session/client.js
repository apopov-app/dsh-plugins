window.__ModuleLoader__.load({
  id: '@apopov-app/dsh-anonymous-session',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Id shared by the sidebar launcher and the main seat it selects. */
    const PANEL_ID = 'anonymous-session';
    /** Locale namespace for this plugin's visible text. */
    const NS = 'anonymous-session';
    /** Document-relative form of the Host route that prepares the workspace. */
    const ROUTE = 'api/anonymous-session';
    /** How long to wait for the Client's workspace stream to learn a new workspace. */
    const RETRY_DELAY_MS = 80;
    /** Bounded retries: the Host commit usually arrives before the click ends. */
    const RETRY_LIMIT = 12;

    const en = {
      'panel': 'New anonymous session',
      'title': 'Anonymous session',
      'starting': 'Opening an anonymous session…',
      'detail': 'A regular conversation in its own workspace — no project folder to pick.',
      'error.generic': 'Could not open an anonymous session.',
      'action.retry': 'Try again',
      'workspace.title': 'Anonymous sessions',
    };

    const ru = {
      'panel': 'Новая анонимная сессия',
      'title': 'Анонимная сессия',
      'starting': 'Открываю анонимную сессию…',
      'detail': 'Обычный диалог в отдельном рабочем пространстве — папку проекта выбирать не нужно.',
      'error.generic': 'Не удалось открыть анонимную сессию.',
      'action.retry': 'Повторить',
      'workspace.title': 'Анонимные сессии',
    };

    const zh = {
      'panel': '新建匿名会话',
      'title': '匿名会话',
      'starting': '正在打开匿名会话…',
      'detail': '在独立工作区中开始常规对话，无需选择项目目录。',
      'error.generic': '无法打开匿名会话。',
      'action.retry': '重试',
      'workspace.title': '匿名会话',
    };

    const CSS = [
      '.as-page{box-sizing:border-box;height:100%;min-height:0;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:32px}',
      '.as-card{display:flex;flex-direction:column;align-items:center;gap:12px;max-width:420px;text-align:center}',
      '.as-spinner{width:20px;height:20px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:as-spin .8s linear infinite}',
      '@keyframes as-spin{to{transform:rotate(360deg)}}',
      '@media (prefers-reduced-motion:reduce){.as-spinner{animation:none}}',
      '.as-title{margin:0;font-size:16px;font-weight:500;line-height:24px}',
      '.as-detail{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}',
      '.as-error{white-space:pre-wrap;overflow-wrap:anywhere;margin:0;color:var(--dsw-alias-state-error-primary);font-size:13px;line-height:20px}',
      '.as-retry{height:32px;padding:0 16px;border:.5px solid var(--dsw-alias-border-l2);border-radius:16px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;cursor:pointer}',
      '.as-retry:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.as-page :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      // The sidebar renders a panel row as its own nav button. This plugin's
      // launcher should read as a second primary action like the shipped
      // New Session bar, so the row is restyled to that geometry (38px bar,
      // theme radius, elevated fill, centered icon + label) through :has() on
      // the glyph we own; collapsed rail keeps the plain icon control.
      'button[class*="_panelRow"]:has(svg[data-anon-session-icon]){justify-content:center;gap:6px;height:38px;min-height:38px;padding:8px 12px;margin:0 2px 10px;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-md,12px);color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px;--as-launcher-bg:var(--dsw-alias-button-elevated-fill,var(--dsw-alias-bg-layer-1));--as-launcher-hover:var(--dsw-alias-button-floating-hover,var(--dsw-alias-bg-layer-2));background:var(--as-launcher-bg)}',
      'button[class*="_panelRow"]:has(svg[data-anon-session-icon]):hover{background:var(--as-launcher-hover)}',
      // macOS paints the shipped bar as a white wash over the vibrancy tint,
      // not the elevated theme fill: match it exactly, light and dark.
      '[data-platform="darwin"] button[class*="_panelRow"]:has(svg[data-anon-session-icon]){--as-launcher-bg:rgb(255 255 255 / .55);--as-launcher-hover:rgb(255 255 255 / .3)}',
      '[data-platform="darwin"] :where([data-ds-dark-theme]) button[class*="_panelRow"]:has(svg[data-anon-session-icon]){--as-launcher-bg:rgb(255 255 255 / .15);--as-launcher-hover:rgb(255 255 255 / .2)}',
      '[data-sidebar-collapsed] button[class*="_panelRow"]:has(svg[data-anon-session-icon]){width:36px;height:36px;min-height:36px;padding:0;margin:0;border:0;background:transparent;justify-content:center;gap:0}',
      '[data-sidebar-collapsed] button[class*="_panelRow"]:has(svg[data-anon-session-icon]):hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
    ].join('\n');

    /** Sidebar glyph: a speech bubble whose tail carries a plus — "new chat". */
    function SidebarIcon({ size }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          'aria-hidden': true,
          focusable: 'false',
          'data-anon-session-icon': 'true',
        },
        h('path', {
          d: 'M2.4 4.9A2.3 2.3 0 0 1 4.7 2.6h6.6a2.3 2.3 0 0 1 2.3 2.3v3.5a2.3 2.3 0 0 1-2.3 2.3H7.6l-2.5 2.3a.4.4 0 0 1-.68-.3v-2h.08a2.3 2.3 0 0 1-2.1-2.3Z',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        h('path', { d: 'M8 4.9v4.4M5.8 7.1h4.4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
      );
    }

    /** Delay helper for waiting on the Client's workspace stream. */
    function delay(milliseconds) {
      return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
      });
    }

    /** Error text for a failed start, never empty. */
    function failureText(t, error) {
      const message = error instanceof Error ? error.message : String(error);
      return message === '' ? t('error.generic') : message;
    }

    /**
     * Open the anonymous workspace through the shipped Workspace flow.
     *
     * The Host commits the workspace before answering, but the browser learns
     * it from the workspace stream; a click right after the first creation can
     * therefore land before the stream frame. Retry only that specific
     * "unknown workspace" refusal, and let every other failure through.
     */
    async function openAfterCommit(uiWorkspace, workspaceId) {
      let lastError;
      for (let attempt = 0; attempt < RETRY_LIMIT; attempt += 1) {
        try {
          await uiWorkspace.openWorkspace(workspaceId);
          return;
        } catch (error) {
          lastError = error;
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes('unknown workspace')) throw error;
          await delay(RETRY_DELAY_MS);
        }
      }
      throw lastError;
    }

    /**
     * Starter body: prepares the workspace on the Host, then hands the click to
     * the shipped New Session flow for that workspace. The panel unmounts as
     * soon as `openWorkspace` reveals the Conversation.
     */
    function AnonymousSessionStarter(props) {
      const t = props.t ?? props.fallbackT ?? ((key) => key);
      const [status, setStatus] = React.useState('starting');
      const [error, setError] = React.useState('');
      const aliveRef = React.useRef(true);
      const busyRef = React.useRef(false);
      const startRef = React.useRef(props.onStart);
      const translateRef = React.useRef(t);
      startRef.current = props.onStart;
      translateRef.current = t;

      const start = React.useCallback(() => {
        if (busyRef.current) return;
        busyRef.current = true;
        setStatus('starting');
        setError('');
        Promise.resolve()
          .then(() => startRef.current())
          .then(() => {
            busyRef.current = false;
            if (aliveRef.current) setStatus('idle');
          })
          .catch((reason) => {
            busyRef.current = false;
            if (!aliveRef.current) return;
            setError(failureText(translateRef.current, reason));
            setStatus('error');
          });
      }, []);

      React.useEffect(() => {
        aliveRef.current = true;
        start();
        return () => {
          aliveRef.current = false;
        };
      }, [start]);

      return h(
        'section',
        { className: 'as-page', 'aria-label': t('title') },
        h(
          'div',
          { className: 'as-card', role: 'status', 'aria-live': 'polite' },
          status === 'error'
            ? [
                h('h1', { key: 'title', className: 'as-title' }, t('title')),
                h('p', { key: 'error', className: 'as-error' }, error),
                h('button', { key: 'retry', type: 'button', className: 'as-retry', onClick: start }, t('action.retry')),
              ]
            : [
                h('div', { key: 'spinner', className: 'as-spinner' }),
                h('h1', { key: 'title', className: 'as-title' }, t('title')),
                h('p', { key: 'detail', className: 'as-detail' }, t('starting')),
                h('p', { key: 'hint', className: 'as-detail' }, t('detail')),
              ],
        ),
      );
    }

    /** Add Russian to the shared language catalog when the deployment lacks it. */
    function ensureRussian(locale) {
      const snapshot = locale.getLocale();
      const present = Array.isArray(snapshot?.locales) && snapshot.locales.some((entry) => String(entry?.id).toLowerCase() === 'ru');
      if (present) return () => {};
      try {
        return locale.addLanguage({ id: 'ru', label: 'Русский', fallback: 'en' });
      } catch {
        return () => {};
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const translate = ctx.locale.bind(NS);

        ctx.effect(() => ctx.locale.register(NS, { en, ru, zh }), 'anonymous-session: dictionaries');
        ctx.effect(() => ensureRussian(ctx.locale), 'anonymous-session: russian language');

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = '@apopov-app/dsh-anonymous-session';
          tag.dataset.pluginCss = '@apopov-app/dsh-anonymous-session/starter.css';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => {
            tag.remove();
          };
        }, 'anonymous-session: styles');

        // One operation, invoked by the panel seat: prepare the project-free
        // workspace on the Host, then let the shipped flow open a Session in it.
        const start = async () => {
          const uiWorkspace = ctx.get('uiWorkspace');
          if (uiWorkspace === undefined) throw new Error('anonymous sessions need the workspace service');
          const response = await fetch(ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: translate('workspace.title') }),
          });
          if (!response.ok) {
            let detail = '';
            try {
              const payload = await response.json();
              detail = typeof payload?.message === 'string' ? payload.message : '';
            } catch {
              detail = '';
            }
            throw new Error(detail === '' ? `HTTP ${response.status}` : detail);
          }
          const payload = await response.json();
          const workspaceId = typeof payload?.workspaceId === 'string' ? payload.workspaceId : '';
          if (workspaceId === '') throw new Error('the Host returned no anonymous workspace');
          await openAfterCommit(uiWorkspace, workspaceId);
        };

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: -10,
              locale: NS,
              label: () => translate('panel'),
            },
            SidebarIcon,
          ),
        );

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
              inject: () => ({ onStart: start, fallbackT: translate }),
            },
            AnonymousSessionStarter,
          ),
        );
      },
    };
  },
});
