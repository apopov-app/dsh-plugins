window.__ModuleLoader__.load({
  id: '@app-apopov/dsh-engram-memory',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Locale namespace for every visible string of this plugin. */
    const NS = 'engram-memory';
    /** Document-relative form of the Host route. */
    const ROUTE = 'api/engram-memory';
    /** Package name this section belongs to. */
    const PACKAGE_NAME = '@app-apopov/dsh-engram-memory';
    /** Stylesheet id, so a re-mount never duplicates the style element. */
    const STYLE_ID = 'engram-memory-settings-style';

    const en = {
      'section.title': 'Memory',
      'section.hint': 'Memories the agent has stored for this machine. Edit or delete any entry.',
      'project.label': 'Database',
      'project.global': 'Shared (global)',
      'action.refresh': 'Refresh',
      'action.edit': 'Edit',
      'action.delete': 'Delete',
      'action.save': 'Save',
      'action.cancel': 'Cancel',
      'column.title': 'Title',
      'column.type': 'Type',
      'column.scope': 'Scope',
      'column.date': 'Created',
      'column.actions': '',
      'empty': 'No memories yet.',
      'loading': 'Loading…',
      'failed': 'Could not read memory: {message}',
      'saved': 'Saved',
      'deleted': 'Deleted',
      'confirmDelete': 'Delete this memory? This cannot be undone.',
      'edit.title': 'Title',
      'edit.content': 'Content',
    };
    const ru = {
      'section.title': 'Память',
      'section.hint': 'Записи, которые агент сохранил на этой машине. Любую можно отредактировать или удалить.',
      'project.label': 'База',
      'project.global': 'Общая (global)',
      'action.refresh': 'Обновить',
      'action.edit': 'Изменить',
      'action.delete': 'Удалить',
      'action.save': 'Сохранить',
      'action.cancel': 'Отмена',
      'column.title': 'Название',
      'column.type': 'Тип',
      'column.scope': 'Область',
      'column.date': 'Создано',
      'column.actions': '',
      'empty': 'Записей пока нет.',
      'loading': 'Загружаю…',
      'failed': 'Не удалось прочитать память: {message}',
      'saved': 'Сохранено',
      'deleted': 'Удалено',
      'confirmDelete': 'Удалить эту запись? Восстановить не получится.',
      'edit.title': 'Название',
      'edit.content': 'Содержание',
    };
    const zh = {
      'section.title': '记忆',
      'section.hint': '代理在这台机器上保存的记忆，可以编辑或删除任意一条。',
      'project.label': '数据库',
      'project.global': '共享（global）',
      'action.refresh': '刷新',
      'action.edit': '编辑',
      'action.delete': '删除',
      'action.save': '保存',
      'action.cancel': '取消',
      'column.title': '标题',
      'column.type': '类型',
      'column.scope': '范围',
      'column.date': '创建时间',
      'column.actions': '',
      'empty': '还没有记忆。',
      'loading': '加载中…',
      'failed': '无法读取记忆：{message}',
      'saved': '已保存',
      'deleted': '已删除',
      'confirmDelete': '删除这条记忆？无法恢复。',
      'edit.title': '标题',
      'edit.content': '内容',
    };

    /** One authenticated Host request against this plugin's route. */
    async function request(body) {
      const response = await fetch(ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const payload = await response.json();
      if (payload?.ok !== true) throw new Error(String(payload?.error ?? 'request failed'));
      return payload;
    }

    /** Render one memory body as a short single-line preview. */
    function preview(text) {
      const value = typeof text === 'string' ? text.replace(/\s+/gu, ' ').trim() : '';
      return value.length <= 140 ? value : value.slice(0, 140) + '…';
    }

    /** Mount the table once the page actually shows this plugin's section. */
    function MemorySection({ t = (key) => key, subject }) {
      const name = subject !== null && typeof subject === 'object' && (subject.kind === 'bundle' || subject.kind === 'row')
        ? subject.pkg?.name
        : undefined;
      if (name !== PACKAGE_NAME) return null;
      return h(MemoryPanel, { t });
    }

    /** The table itself: database picker, entries, inline edit, delete. */
    function MemoryPanel({ t }) {
      const [projects, setProjects] = React.useState([]);
      const [key, setKey] = React.useState('global');
      const [entries, setEntries] = React.useState([]);
      const [status, setStatus] = React.useState('loading');
      const [error, setError] = React.useState('');
      const [editing, setEditing] = React.useState(null);
      const [notice, setNotice] = React.useState('');
      const keyRef = React.useRef('global');
      keyRef.current = key;

      const loadEntries = React.useCallback(async (target) => {
        setStatus('loading');
        setError('');
        try {
          const payload = await request({ action: 'list', key: target });
          setEntries(Array.isArray(payload.entries) ? payload.entries : []);
          setStatus('ready');
        } catch (failure) {
          setError(String(failure?.message ?? failure));
          setStatus('failed');
        }
      }, []);

      React.useEffect(() => {
        let cancelled = false;
        void (async () => {
          try {
            const payload = await request({ action: 'projects' });
            if (cancelled) return;
            const list = Array.isArray(payload.projects) ? payload.projects : [];
            setProjects(list);
            const preferred = list.some((project) => project.key === keyRef.current)
              ? keyRef.current
              : (list.find((project) => project.kind === 'global') ?? list[0])?.key ?? 'global';
            setKey(preferred);
            await loadEntries(preferred);
          } catch (failure) {
            if (cancelled) return;
            setError(String(failure?.message ?? failure));
            setStatus('failed');
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [loadEntries]);

      const refresh = () => {
        setNotice('');
        void loadEntries(keyRef.current);
      };

      const startEdit = (entry) => {
        setNotice('');
        setEditing({ id: entry.id, title: String(entry.title ?? ''), content: String(entry.content ?? '') });
      };

      const save = async () => {
        if (editing === null) return;
        try {
          await request({ action: 'update', key: keyRef.current, id: editing.id, title: editing.title, content: editing.content });
          setEditing(null);
          setNotice(t('saved'));
          await loadEntries(keyRef.current);
        } catch (failure) {
          setError(String(failure?.message ?? failure));
        }
      };

      const remove = async (entry) => {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(t('confirmDelete'))) return;
        try {
          await request({ action: 'delete', key: keyRef.current, id: entry.id });
          setNotice(t('deleted'));
          await loadEntries(keyRef.current);
        } catch (failure) {
          setError(String(failure?.message ?? failure));
        }
      };

      const rows = entries.map((entry) => {
        const isEditing = editing !== null && editing.id === entry.id;
        if (isEditing) {
          return h('tr', { key: entry.id, className: 'em-row em-row-editing' },
            h('td', { colSpan: 5 },
              h('div', { className: 'em-field' },
                h('label', { className: 'em-label' }, t('edit.title')),
                h('input', {
                  className: 'em-input',
                  value: editing.title,
                  onChange: (event) => setEditing({ ...editing, title: event.target.value }),
                })),
              h('div', { className: 'em-field' },
                h('label', { className: 'em-label' }, t('edit.content')),
                h('textarea', {
                  className: 'em-textarea',
                  rows: 5,
                  value: editing.content,
                  onChange: (event) => setEditing({ ...editing, content: event.target.value }),
                })),
              h('div', { className: 'em-actions' },
                h('button', { type: 'button', className: 'em-button em-primary', onClick: () => void save() }, t('action.save')),
                h('button', { type: 'button', className: 'em-button', onClick: () => setEditing(null) }, t('action.cancel')))));
        }
        return h('tr', { key: entry.id, className: 'em-row' },
          h('td', { className: 'em-cell-title' },
            h('div', { className: 'em-title' }, String(entry.title ?? '')),
            h('div', { className: 'em-preview' }, preview(entry.content))),
          h('td', { className: 'em-cell-meta' }, String(entry.type ?? '')),
          h('td', { className: 'em-cell-meta' }, String(entry.scope ?? '')),
          h('td', { className: 'em-cell-meta' }, String(entry.created_at ?? '').slice(0, 16)),
          h('td', { className: 'em-cell-actions' },
            h('button', { type: 'button', className: 'em-button', onClick: () => startEdit(entry) }, t('action.edit')),
            h('button', { type: 'button', className: 'em-button em-danger', onClick: () => void remove(entry) }, t('action.delete'))));
      });

      const select = h('select', {
        className: 'em-select',
        value: key,
        onChange: (event) => {
          const next = event.target.value;
          setKey(next);
          setEditing(null);
          void loadEntries(next);
        },
      }, projects.map((project) => h('option', { key: project.key, value: project.key },
        project.kind === 'global' ? t('project.global') : String(project.label ?? project.key))));

      return h('section', { className: 'em-section', 'data-engram-memory-settings': true },
        h('div', { className: 'em-head' },
          h('div', null,
            h('h3', { className: 'em-heading' }, t('section.title')),
            h('p', { className: 'em-hint' }, t('section.hint'))),
          h('div', { className: 'em-controls' },
            h('label', { className: 'em-label em-inline' }, t('project.label')),
            select,
            h('button', { type: 'button', className: 'em-button', onClick: refresh }, t('action.refresh')))),
        notice === '' ? null : h('p', { className: 'em-notice' }, notice),
        status === 'failed' ? h('p', { className: 'em-error' }, t('failed').replace('{message}', error)) : null,
        status === 'loading' && entries.length === 0 ? h('p', { className: 'em-hint' }, t('loading')) : null,
        status === 'ready' && entries.length === 0 ? h('p', { className: 'em-hint' }, t('empty')) : null,
        entries.length === 0 ? null : h('table', { className: 'em-table' },
          h('thead', null,
            h('tr', null,
              h('th', null, t('column.title')),
              h('th', null, t('column.type')),
              h('th', null, t('column.scope')),
              h('th', null, t('column.date')),
              h('th', null, t('column.actions')))),
          h('tbody', null, rows)));
    }

    /** One stylesheet for the section, removed with the plugin. */
    function ensureStyles() {
      if (typeof document === 'undefined' || document.head === null) return () => {};
      const existing = document.getElementById(STYLE_ID);
      if (existing !== null) return () => {};
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = [
        '.em-section { display: flex; flex-direction: column; gap: 12px; padding: 16px 0; }',
        '.em-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }',
        '.em-heading { margin: 0 0 4px; font-size: 15px; font-weight: 600; }',
        '.em-hint { margin: 0; font-size: 12px; opacity: 0.7; }',
        '.em-controls { display: flex; align-items: center; gap: 8px; }',
        '.em-label { font-size: 12px; opacity: 0.7; }',
        '.em-inline { margin-right: 2px; }',
        '.em-select, .em-input, .em-textarea { font: inherit; font-size: 13px; padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(127,127,127,0.35); background: transparent; color: inherit; }',
        '.em-textarea { width: 100%; resize: vertical; }',
        '.em-input { width: 100%; margin-bottom: 6px; }',
        '.em-table { width: 100%; border-collapse: collapse; font-size: 13px; }',
        '.em-table th { text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.55; padding: 6px 8px; border-bottom: 1px solid rgba(127,127,127,0.25); }',
        '.em-table td { padding: 8px; border-bottom: 1px solid rgba(127,127,127,0.15); vertical-align: top; }',
        '.em-title { font-weight: 600; }',
        '.em-preview { opacity: 0.7; font-size: 12px; margin-top: 2px; }',
        '.em-cell-meta { font-size: 12px; opacity: 0.8; white-space: nowrap; }',
        '.em-cell-actions { white-space: nowrap; text-align: right; }',
        '.em-button { font: inherit; font-size: 12px; padding: 5px 10px; border-radius: 8px; border: 1px solid rgba(127,127,127,0.35); background: transparent; color: inherit; cursor: pointer; margin-left: 6px; }',
        '.em-button:hover { background: rgba(127,127,127,0.12); }',
        '.em-primary { border-color: rgba(80,140,255,0.6); }',
        '.em-danger:hover { background: rgba(220,70,70,0.15); }',
        '.em-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }',
        '.em-error { color: #d9534f; font-size: 12px; margin: 0; }',
        '.em-notice { font-size: 12px; opacity: 0.7; margin: 0; }',
      ].join('\n');
      document.head.appendChild(style);
      return () => {
        if (style.parentNode !== null) style.parentNode.removeChild(style);
      };
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, ru, zh }), 'engram-memory: dictionaries');
        ctx.effect(() => ensureStyles(), 'engram-memory: styles');
        ctx.slots.inject('plugins.detail.section', () => ctx.slots.register(
          {
            name: 'plugins.detail.section',
            id: 'engram-memory-table',
            order: 30,
            locale: NS,
          },
          MemorySection,
        ));
      },
    };
  },
});
