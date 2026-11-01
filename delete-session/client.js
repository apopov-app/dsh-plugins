window.__ModuleLoader__.load({
  id: '@apopov-app/dsh-delete-session',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const {
      Button,
      IconTrashOutlineRegular,
      MenuItemButton,
      Modal,
    } = require('@deepseek-ai/dsh-client-ui-primitives');

    const h = React.createElement;

    /** Locale namespace for this plugin's visible text. */
    const NS = 'delete-session';
    /** Document-relative form of the Host route. */
    const ROUTE = 'api/delete-session';

    const en = {
      'menu.deleteSession': 'Delete dialog permanently',
      'confirm.title': 'Delete this dialog permanently?',
      'confirm.desc': '“{title}” and its entire history will be erased from disk. This cannot be undone.',
      'confirm.activityTitle': 'Currently running:',
      'confirm.activityNote': 'That work will be stopped.',
      'confirm.descendants': 'Subagent dialogs will be deleted with it: {n}.',
      'confirm.pending': 'Deleting…',
      'confirm.action': 'Delete permanently',
      'cancel': 'Cancel',
      'close': 'Close',
      'loading': 'Checking the dialog…',
      'inspectFailed': 'Could not inspect the dialog: {message}',
      'deleteFailed': 'Could not delete the dialog: {message}',
      'notFound': 'This dialog is no longer on disk.',
      'toast.deleted': 'Dialog deleted permanently.',
      'activity.turn': 'An answer is still being produced',
      'activity.jobs': 'Background jobs: {n}',
      'activity.subagents': 'Subagents: {n}',
      'activity.schedules': 'Scheduled tasks: {n}',
      'activity.other': 'Active work: {kind}',
    };

    const ru = {
      'menu.deleteSession': 'Удалить диалог навсегда',
      'confirm.title': 'Удалить диалог навсегда?',
      'confirm.desc': '«{title}» и вся его история будут стёрты с диска. Восстановить диалог нельзя.',
      'confirm.activityTitle': 'Сейчас выполняется:',
      'confirm.activityNote': 'Эта работа будет остановлена.',
      'confirm.descendants': 'Вместе с ним будут удалены дочерние диалоги подагентов: {n}.',
      'confirm.pending': 'Удаляю…',
      'confirm.action': 'Удалить навсегда',
      'cancel': 'Отмена',
      'close': 'Закрыть',
      'loading': 'Проверяю диалог…',
      'inspectFailed': 'Не удалось проверить диалог: {message}',
      'deleteFailed': 'Не удалось удалить диалог: {message}',
      'notFound': 'Этого диалога уже нет на диске.',
      'toast.deleted': 'Диалог удалён навсегда.',
      'activity.turn': 'Идёт ответ на сообщение',
      'activity.jobs': 'Фоновые задачи: {n}',
      'activity.subagents': 'Подагенты: {n}',
      'activity.schedules': 'Запланированные задачи: {n}',
      'activity.other': 'Активная работа: {kind}',
    };

    const zh = {
      'menu.deleteSession': '永久删除对话',
      'confirm.title': '永久删除此对话？',
      'confirm.desc': '“{title}”及其全部历史将从磁盘上抹除，且无法恢复。',
      'confirm.activityTitle': '当前正在运行：',
      'confirm.activityNote': '这些工作将被停止。',
      'confirm.descendants': '子代理对话也会一并删除：{n} 个。',
      'confirm.pending': '正在删除…',
      'confirm.action': '永久删除',
      'cancel': '取消',
      'close': '关闭',
      'loading': '正在检查对话…',
      'inspectFailed': '无法检查对话：{message}',
      'deleteFailed': '无法删除对话：{message}',
      'notFound': '此对话在磁盘上已不存在。',
      'toast.deleted': '对话已永久删除。',
      'activity.turn': '仍在生成回答',
      'activity.jobs': '后台任务：{n}',
      'activity.subagents': '子代理：{n}',
      'activity.schedules': '计划任务：{n}',
      'activity.other': '活动中的工作：{kind}',
    };

    const CSS = [
      '.dsd-danger:not(:disabled){color:var(--dsw-alias-state-error-primary)}',
      '.dsd-activity{margin:0;padding-left:18px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}',
      '.dsd-activity li{margin:2px 0}',
      '.dsd-label{margin:0 0 4px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;font-weight:500}',
      '.dsd-note{margin:8px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}',
      '.dsd-alert{margin:8px 0 0;color:var(--dsw-alias-state-error-primary);font-size:13px;line-height:20px;white-space:pre-wrap}',
      '.dsd-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000;max-width:min(420px,calc(100vw - 32px));box-sizing:border-box;padding:10px 16px;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;box-shadow:0 8px 24px var(--dsw-alias-shadow-l2,rgba(0,0,0,.18));pointer-events:none}',
    ].join('\n');

    /** The Client context, kept for service reads at dialog action time. */
    let runtime;

    /** Pending confirmation shared by the menu row and the shell overlay. */
    let pending = null;
    /** Transient success notice. */
    let notice = null;
    let nextRequestId = 0;
    let noticeTimer;
    const listeners = new Set();

    function emitChange() {
      for (const listener of [...listeners]) listener();
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }

    function pendingSnapshot() {
      return pending;
    }

    function noticeSnapshot() {
      return notice;
    }

    /** Open the confirmation for one row. */
    function requestDelete(sessionId, displayTitle) {
      nextRequestId += 1;
      pending = { sessionId, displayTitle, requestId: nextRequestId };
      emitChange();
    }

    /** Close the confirmation. */
    function settleDelete() {
      if (pending === null) return;
      pending = null;
      emitChange();
    }

    /** Show one transient success notice. */
    function showNotice(message) {
      notice = { message, requestId: nextRequestId };
      emitChange();
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        notice = null;
        emitChange();
      }, 4000);
    }

    /**
     * One authenticated Host call. A refusal keeps its stable code so the
     * dialog can distinguish a dialog that is already gone from a failure.
     * @param body - the JSON request body.
     * @returns the decoded response object.
     */
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

    /** Readable error text for a localized message template. */
    function failureText(t, key, error) {
      const message = error instanceof Error && error.message !== ''
        ? error.message
        : 'unknown failure';
      return t(key, { message });
    }

    /** True while the main view shows this Session, so deleting it must navigate away. */
    function mainViewHolds(sessionId) {
      const sessions = runtime?.get('sessions');
      if (sessions === undefined) return false;
      try {
        const summary = sessions.list?.getSnapshot?.().byId?.[sessionId];
        if (summary !== undefined) return (summary.retainedBy?.mainView ?? 0) > 0;
        return (sessions.retainInfo?.(sessionId)?.getSnapshot?.().retainedBy?.mainView ?? 0) > 0;
      } catch {
        return false;
      }
    }

    /** One activity family, localized by its kind. */
    function activityLine(entry, t) {
      const count = Array.isArray(entry?.items) ? entry.items.length : 0;
      switch (entry?.kind) {
        case 'turn':
          return t('activity.turn');
        case 'job':
          return t('activity.jobs', { n: count });
        case 'subagent':
          return t('activity.subagents', { n: count });
        case 'schedule':
          return t('activity.schedules', { n: count });
        default:
          return t('activity.other', { kind: String(entry?.kind ?? '') });
      }
    }

    /**
     * One Session row in the "..." menu. Destructive, so it is separated from
     * the ordinary actions and opens an explicit confirmation before any Host
     * call.
     */
    function DeleteSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, t }) {
      const [, setMenuOpen] = useMenuOpenState();
      return h(
        MenuItemButton,
        {
          danger: true,
          separatorBefore: true,
          icon: h(IconTrashOutlineRegular, { size: 14 }),
          onSelect: () => {
            setMenuOpen(false);
            requestDelete(sessionId, typeof displayTitle === 'string' && displayTitle !== '' ? displayTitle : sessionId);
          },
        },
        t('menu.deleteSession'),
      );
    }

    /** The confirmation body: inspect the dialog, then erase it on request. */
    function DeleteSessionForm({ request, t }) {
      const [state, setState] = React.useState({ phase: 'loading', info: null, error: '' });
      const aliveRef = React.useRef(true);
      const translateRef = React.useRef(t);
      translateRef.current = t;

      React.useEffect(() => {
        aliveRef.current = true;
        callHost({ action: 'inspect', sessionId: request.sessionId })
          .then((info) => {
            if (!aliveRef.current) return;
            setState({ phase: 'ready', info, error: '' });
          })
          .catch((error) => {
            if (!aliveRef.current) return;
            const translate = translateRef.current;
            const gone = error?.code === 'SESSION_NOT_FOUND';
            setState({
              phase: gone ? 'gone' : 'failed',
              info: null,
              error: gone ? translate('notFound') : failureText(translate, 'inspectFailed', error),
            });
          });
        return () => {
          aliveRef.current = false;
        };
      }, [request.sessionId]);

      const busy = state.phase === 'deleting';

      const close = () => {
        if (busy) return;
        settleDelete();
      };

      const confirm = () => {
        if (state.phase !== 'ready') return;
        const wasCurrent = mainViewHolds(request.sessionId);
        setState(current => ({ ...current, phase: 'deleting', error: '' }));
        callHost({ action: 'delete', sessionId: request.sessionId })
          .then(() => {
            settleDelete();
            showNotice(t('toast.deleted'));
            if (!wasCurrent) return;
            try {
              runtime?.get('uiWorkspace')?.startSession();
            } catch (error) {
              console.warn('delete-session: opening the New Session view failed:', error);
            }
          })
          .catch((error) => {
            if (!aliveRef.current) return;
            setState(current => ({
              phase: 'ready',
              info: current.info,
              error: failureText(t, 'deleteFailed', error),
            }));
          });
      };

      const activity = Array.isArray(state.info?.activity) ? state.info.activity : [];
      const body = [];
      if (state.phase === 'loading') {
        body.push(h('p', { key: 'loading', className: 'dsd-note', role: 'status' }, t('loading')));
      }
      if (activity.length > 0) {
        body.push(h(
          'div',
          { key: 'activity' },
          h('p', { className: 'dsd-label' }, t('confirm.activityTitle')),
          h(
            'ul',
            { className: 'dsd-activity', 'aria-label': t('confirm.activityTitle') },
            activity.map((entry, index) => h('li', { key: `${entry?.kind ?? 'entry'}-${String(index)}` }, activityLine(entry, t))),
          ),
          h('p', { className: 'dsd-note' }, t('confirm.activityNote')),
        ));
      }
      if ((state.info?.descendants ?? 0) > 0) {
        body.push(h(
          'p',
          { key: 'descendants', className: 'dsd-note' },
          t('confirm.descendants', { n: state.info.descendants }),
        ));
      }
      if (state.error !== '') {
        body.push(h('p', { key: 'error', className: 'dsd-alert', role: 'alert' }, state.error));
      }

      return h(
        Modal,
        {
          open: true,
          onClose: close,
          closeLabel: t('close'),
          title: t('confirm.title'),
          description: t('confirm.desc', { title: request.displayTitle }),
          footer: h(
            React.Fragment,
            null,
            h(Button, { variant: 'outline', disabled: busy, onClick: close }, t('cancel')),
            h(
              Button,
              {
                variant: 'outline',
                className: 'dsd-danger',
                disabled: busy || state.phase !== 'ready',
                onClick: confirm,
              },
              busy ? t('confirm.pending') : t('confirm.action'),
            ),
          ),
        },
        ...body,
      );
    }

    /** Shell overlay: the open confirmation and the transient success notice. */
    function DeleteSessionOverlay(props) {
      const request = React.useSyncExternalStore(subscribe, pendingSnapshot);
      const notification = React.useSyncExternalStore(subscribe, noticeSnapshot);
      return h(
        React.Fragment,
        null,
        request === null
          ? null
          : h(DeleteSessionForm, { key: request.requestId, request, t: props.t }),
        notification === null
          ? null
          : createPortal(
            h('div', { className: 'dsd-toast', role: 'status' }, notification.message),
            document.body,
          ),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        runtime = ctx;

        ctx.effect(() => ctx.locale.register(NS, { en, ru, zh }), 'delete-session: dictionaries');

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = '@apopov-app/dsh-delete-session';
          tag.dataset.pluginCss = '@apopov-app/dsh-delete-session/dialog.css';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => {
            tag.remove();
          };
        }, 'delete-session: styles');

        ctx.slots.inject('sidebar.workspaces.session.menu.item', () =>
          ctx.slots.register(
            {
              name: 'sidebar.workspaces.session.menu.item',
              id: 'delete-session',
              order: 500,
              locale: NS,
            },
            DeleteSessionMenuItem,
          ));

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'delete-session.confirm',
              locale: NS,
            },
            DeleteSessionOverlay,
          ));

        ctx.effect(() => () => {
          clearTimeout(noticeTimer);
          pending = null;
          notice = null;
          listeners.clear();
        }, 'delete-session: state');
      },
    };
  },
});
