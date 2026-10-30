window.__ModuleLoader__.load({
  id: '@apopov-app/dsh-tts-ru',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Locale namespace for this plugin's visible text. */
    const NS = 'tts-ru';
    /** Document-relative form of the Host route. */
    const ROUTE = 'api/tts-ru';

    const en = {
      'dock.title': 'Voice replies',
      'dock.aria': 'Voice replies: speak short summaries',
      'dock.unavailable': 'Voice replies are unavailable',
      'panel.title': 'Voice replies',
      'panel.hint': 'When enabled, the model sends a 2–3 sentence takeaway to the speak_summary tool and it is spoken locally after the answer. The full answer is never read.',
      'panel.enabled': 'Speak short summaries',
      'panel.voice': 'Voice',
      'panel.ready': 'Ready',
      'panel.preparing': 'Preparing…',
      'panel.missing': 'Not downloaded',
      'panel.downloadHint': 'The voice model downloads once (~63 MB); no cloud service is used.',
      'panel.loading': 'Loading voice replies…',
      'panel.error': 'Voice replies failed: {message}',
      'panel.refresh': 'Refresh',
      'summary.running': 'Preparing the spoken summary…',
      'summary.title': 'Spoken summary',
      'summary.seconds': '{seconds} s',
      'summary.play': 'Play',
      'summary.stop': 'Stop',
      'summary.loading': 'Loading audio…',
      'summary.failed': 'The spoken summary could not be played.',
      'summary.skipped': 'No spoken summary for this answer.',
    };

    const ru = {
      'dock.title': 'Голосовые ответы',
      'dock.aria': 'Голосовые ответы: озвучивать краткие выжимки',
      'dock.unavailable': 'Голосовые ответы недоступны',
      'panel.title': 'Голосовые ответы',
      'panel.hint': 'Когда режим включён, модель отправляет краткую выжимку (2–3 предложения) в инструмент speak_summary, и она озвучивается локально после ответа. Весь ответ целиком не читается.',
      'panel.enabled': 'Озвучивать краткие выжимки',
      'panel.voice': 'Голос',
      'panel.ready': 'Готов',
      'panel.preparing': 'Готовится…',
      'panel.missing': 'Не скачан',
      'panel.downloadHint': 'Модель голоса скачается один раз (~63 МБ); облачные сервисы не используются.',
      'panel.loading': 'Загрузка голосовых ответов…',
      'panel.error': 'Голосовые ответы не работают: {message}',
      'panel.refresh': 'Обновить',
      'summary.running': 'Готовлю озвучку выжимки…',
      'summary.title': 'Выжимка голосом',
      'summary.seconds': '{seconds} с',
      'summary.play': 'Прослушать',
      'summary.stop': 'Остановить',
      'summary.loading': 'Загружаю аудио…',
      'summary.failed': 'Не удалось воспроизвести озвученную выжимку.',
      'summary.skipped': 'Для этого ответа озвучки нет.',
    };

    const zh = {
      'dock.title': '语音回复',
      'dock.aria': '语音回复：朗读简短要点',
      'dock.unavailable': '语音回复不可用',
      'panel.title': '语音回复',
      'panel.hint': '启用后，模型会把 2–3 句要点发送给 speak_summary 工具，并在回答后于本地朗读。不会朗读完整回答。',
      'panel.enabled': '朗读简短要点',
      'panel.voice': '声音',
      'panel.ready': '就绪',
      'panel.preparing': '准备中…',
      'panel.missing': '未下载',
      'panel.downloadHint': '声音模型只会下载一次（约 63 MB）；不使用云端服务。',
      'panel.loading': '正在加载语音回复…',
      'panel.error': '语音回复失败：{message}',
      'panel.refresh': '刷新',
      'summary.running': '正在准备朗读要点…',
      'summary.title': '语音要点',
      'summary.seconds': '{seconds} 秒',
      'summary.play': '播放',
      'summary.stop': '停止',
      'summary.loading': '正在加载音频…',
      'summary.failed': '无法播放语音要点。',
      'summary.skipped': '此回答没有语音要点。',
    };

    const CSS = [
      '.tts-dock{position:relative;display:inline-flex;align-items:center}',
      '.tts-dock-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit}',
      '.tts-dock-btn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}',
      '.tts-dock-btn[data-active="true"]{color:var(--dsw-alias-brand-primary)}',
      '.tts-dock-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.tts-pop{position:fixed;z-index:60;display:flex;flex-direction:column;gap:10px;min-width:288px;max-width:340px;padding:12px 14px;border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 12px 32px rgb(0 0 0 / .16);color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px}',
      '.tts-pop h4{margin:0;font-size:13px;font-weight:600}',
      '.tts-pop-hint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px}',
      '.tts-pop-row{display:flex;flex-direction:column;gap:6px}',
      '.tts-pop-switch{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;font-weight:500}',
      '.tts-pop-switch input{width:15px;height:15px;margin:0;accent-color:var(--dsw-alias-brand-primary)}',
      '.tts-voice{display:flex;align-items:center;gap:8px;padding:4px 6px;margin:0 -6px;border-radius:8px;cursor:pointer}',
      '.tts-voice:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
      '.tts-voice input{margin:0;accent-color:var(--dsw-alias-brand-primary)}',
      '.tts-voice-name{flex:1 1 auto}',
      '.tts-voice-state{color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap}',
      '.tts-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:17px;overflow-wrap:anywhere}',
      '.tts-summary-row{display:flex;align-items:center;gap:8px;min-width:0;padding:2px 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}',
      '.tts-summary-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}',
      '.tts-summary-meta{color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap}',
      '.tts-summary-btn{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:13px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}',
      '.tts-summary-btn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
      '.tts-summary-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '@media (prefers-reduced-motion:no-preference){.tts-spin{animation:tts-spin .9s linear infinite}}',
      '@keyframes tts-spin{to{transform:rotate(360deg)}}',
    ].join('\n');

    /** Module-level preference snapshot shared by the dock and every tool row. */
    let snapshot = { loaded: false, enabled: false, voice: 'irina', voices: [], preparing: false, error: '' };
    const listeners = new Set();

    /** Replace part of the shared snapshot and wake subscribers. */
    function update(patch) {
      snapshot = { ...snapshot, ...patch };
      for (const listener of [...listeners]) listener();
    }

    /** Subscribe to shared snapshot changes. */
    function subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }

    /** Current shared snapshot. */
    function read() {
      return snapshot;
    }

    /** Read the shared snapshot inside a component. */
    function useSnapshot() {
      return React.useSyncExternalStore(subscribe, read, read);
    }

    /** Format a failure for the panel. */
    function failureText(error) {
      return error instanceof Error ? error.message : String(error);
    }

    /** One authenticated Host request against this plugin's route. */
    async function request(body) {
      const response = await fetch(ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
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
      return response;
    }

    /** Refresh the shared snapshot from the Host. */
    async function refresh() {
      try {
        const response = await request({ action: 'state' });
        const state = await response.json();
        update({ ...state, loaded: true, error: '' });
      } catch (error) {
        update({ loaded: true, error: failureText(error) });
      }
    }

    /** Persist a preference patch and adopt the Host's new snapshot. */
    async function configure(patch) {
      try {
        const response = await request({ action: 'config', ...patch });
        const state = await response.json();
        update({ ...state, loaded: true, error: '' });
      } catch (error) {
        update({ error: failureText(error) });
      }
    }

    /** Speaker glyph: sound waves; the accent colour carries the on state. */
    function SpeakerIcon({ active }) {
      return h(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: 'false', 'data-tts-icon': active ? 'on' : 'off' },
        h('path', {
          d: 'M2.2 6.1h2.2L7 3.3c.3-.3.8-.1.8.3v8.8c0 .4-.5.6-.8.3L4.4 9.9H2.2a.9.9 0 0 1-.9-.9V7a.9.9 0 0 1 .9-.9Z',
          fill: 'currentColor',
        }),
        h('path', {
          d: active ? 'M10.4 5.1a4.2 4.2 0 0 1 0 5.8M12.6 3.2a7.2 7.2 0 0 1 0 9.6' : 'M10.4 5.1a4.2 4.2 0 0 1 0 5.8',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
        }),
      );
    }

    /** Play/stop glyph for a spoken-summary row. */
    function PlayIcon({ playing }) {
      return playing
        ? h('svg', { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true }, h('rect', { x: 2, y: 1.5, width: 3, height: 9, rx: 1, fill: 'currentColor' }), h('rect', { x: 7, y: 1.5, width: 3, height: 9, rx: 1, fill: 'currentColor' }))
        : h('svg', { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true }, h('path', { d: 'M2.6 1.9c0-.5.5-.8 1-.5l7 3.9c.5.3.5 1 0 1.3l-7 3.9c-.5.3-1 0-1-.5V1.9Z', fill: 'currentColor' }));
    }

    /**
     * Composer-dock entry: the speaker toggle plus a small preference popover
     * with the enabled switch and the Russian voice list.
     */
    function VoiceRepliesDock(props) {
      const t = props.t ?? ((key, params) => key);
      const state = useSnapshot();
      const [open, setOpen] = React.useState(false);
      const [position, setPosition] = React.useState({ left: 0, top: 0 });
      const buttonRef = React.useRef(null);
      const aliveRef = React.useRef(true);

      React.useEffect(() => {
        aliveRef.current = true;
        void refresh();
        return () => {
          aliveRef.current = false;
        };
      }, []);

      React.useEffect(() => {
        if (!open) return undefined;
        const close = (event) => {
          if (event.type === 'keydown' && event.key !== 'Escape') return;
          if (event.type === 'pointerdown' && buttonRef.current !== null && buttonRef.current.contains(event.target)) return;
          setOpen(false);
        };
        document.addEventListener('pointerdown', close, true);
        document.addEventListener('keydown', close, true);
        return () => {
          document.removeEventListener('pointerdown', close, true);
          document.removeEventListener('keydown', close, true);
        };
      }, [open]);

      React.useEffect(() => {
        if (!open) return undefined;
        const timer = setInterval(() => {
          if (aliveRef.current) void refresh();
        }, 2500);
        return () => clearInterval(timer);
      }, [open]);

      const toggle = () => {
        if (buttonRef.current !== null) {
          const rect = buttonRef.current.getBoundingClientRect();
          setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 348)), top: Math.max(8, rect.top - 10) });
        }
        setOpen((value) => !value);
      };

      const active = state.enabled === true;
      return h(
        'div',
        { className: 'tts-dock' },
        h('button', {
          ref: buttonRef,
          type: 'button',
          className: 'tts-dock-btn',
          'data-active': active ? 'true' : 'false',
          'aria-label': t('dock.aria'),
          'aria-expanded': open,
          title: t('dock.title'),
          onClick: toggle,
        }, h(SpeakerIcon, { active })),
        open
          ? h(
            'div',
            {
              className: 'tts-pop',
              role: 'dialog',
              'aria-label': t('panel.title'),
              style: { left: `${position.left}px`, top: `${position.top}px`, transform: 'translateY(-100%)' },
            },
            h('h4', null, t('panel.title')),
            !state.loaded
              ? h('p', { className: 'tts-pop-hint' }, t('panel.loading'))
              : h(
                React.Fragment,
                null,
                h('p', { className: 'tts-pop-hint' }, t('panel.hint')),
                h(
                  'label',
                  { className: 'tts-pop-switch' },
                  h('input', {
                    type: 'checkbox',
                    checked: active,
                    disabled: !state.loaded,
                    onChange: (event) => void configure({ enabled: event.target.checked }),
                  }),
                  t('panel.enabled'),
                ),
                h(
                  'div',
                  { className: 'tts-pop-row', role: 'radiogroup', 'aria-label': t('panel.voice') },
                  h('span', { className: 'tts-pop-hint' }, t('panel.voice')),
                  (state.voices ?? []).map((voice) => h(
                    'label',
                    { className: 'tts-voice', key: voice.id },
                    h('input', {
                      type: 'radio',
                      name: 'tts-ru-voice',
                      value: voice.id,
                      checked: state.voice === voice.id,
                      disabled: !state.loaded,
                      onChange: () => void configure({ voice: voice.id }),
                    }),
                    h('span', { className: 'tts-voice-name' }, voice.title),
                    h('span', { className: 'tts-voice-state' }, voice.ready ? t('panel.ready') : (state.preparing ? t('panel.preparing') : t('panel.missing'))),
                  )),
                ),
                h('p', { className: 'tts-pop-hint' }, t('panel.downloadHint')),
                state.error !== '' ? h('p', { className: 'tts-error' }, t('panel.error', { message: state.error })) : null,
              ),
          )
          : null,
      );
    }

    /**
     * Chat row for one speak_summary call: shows the spoken takeaway and plays
     * the cached clip, automatically when voice replies are enabled.
     */
    function SpokenSummaryRow(props) {
      const t = props.t ?? ((key, params) => key);
      const phase = props.phase;
      const block = props.block ?? {};
      const meta = phase === 'result' && block !== null && typeof block === 'object' ? block.meta : undefined;
      const audioId = typeof meta?.audioId === 'string' ? meta.audioId : '';
      const seconds = typeof meta?.seconds === 'number' ? meta.seconds : 0;
      const preview = typeof meta?.text === 'string' ? meta.text : '';
      const failed = phase === 'result' && (block.isError === true || audioId === '');
      const [status, setStatus] = React.useState('idle');
      const [error, setError] = React.useState('');
      const audioRef = React.useRef(null);
      const urlRef = React.useRef('');
      const startedRef = React.useRef(false);

      React.useEffect(() => {
        if (audioId === '') return undefined;
        let cancelled = false;
        setStatus('loading');
        setError('');
        (async () => {
          try {
            const response = await request({ action: 'audio', id: audioId });
            const blob = await response.blob();
            if (cancelled) return;
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            urlRef.current = url;
            audioRef.current = audio;
            audio.addEventListener('ended', () => setStatus('ready'));
            setStatus('ready');
            if (read().enabled === true && !startedRef.current) {
              startedRef.current = true;
              audio.play().then(() => setStatus('playing')).catch(() => setStatus('ready'));
            }
          } catch (failure) {
            if (cancelled) return;
            setStatus('failed');
            setError(failureText(failure));
          }
        })();
        return () => {
          cancelled = true;
          const audio = audioRef.current;
          if (audio !== null) {
            audio.pause();
            audioRef.current = null;
          }
          if (urlRef.current !== '') {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = '';
          }
        };
      }, [audioId]);

      const playing = status === 'playing';
      const toggle = () => {
        const audio = audioRef.current;
        if (audio === null) return;
        if (playing) {
          audio.pause();
          setStatus('ready');
        } else {
          audio.play().then(() => setStatus('playing')).catch((failure) => {
            setStatus('failed');
            setError(failureText(failure));
          });
        }
      };

      if (phase !== 'result') {
        return h(
          'div',
          { className: 'tts-summary-row' },
          h('span', { 'aria-hidden': true }, h(SpeakerIcon, { active: true })),
          h('span', { className: 'tts-summary-text' }, t('summary.running')),
        );
      }

      if (failed) {
        return h(
          'div',
          { className: 'tts-summary-row' },
          h('span', { 'aria-hidden': true }, h(SpeakerIcon, { active: false })),
          h('span', { className: 'tts-summary-text' }, t('summary.skipped')),
        );
      }

      return h(
        'div',
        { className: 'tts-summary-row' },
        h('span', { 'aria-hidden': true }, h(SpeakerIcon, { active: true })),
        h('span', { className: 'tts-summary-text', title: preview }, preview === '' ? t('summary.title') : preview),
        seconds > 0 ? h('span', { className: 'tts-summary-meta' }, t('summary.seconds', { seconds })) : null,
        h(
          'button',
          {
            type: 'button',
            className: 'tts-summary-btn',
            disabled: status === 'loading' || status === 'failed',
            title: playing ? t('summary.stop') : t('summary.play'),
            onClick: toggle,
          },
          h(PlayIcon, { playing }),
          h('span', null, status === 'loading' ? t('summary.loading') : (playing ? t('summary.stop') : t('summary.play'))),
        ),
        error !== '' ? h('span', { className: 'tts-summary-meta' }, t('summary.failed')) : null,
      );
    }

    /** Make the Russian language available when no language pack registered it. */
    function ensureRussian(locale) {
      const localeSnapshot = locale.getLocale();
      const present = Array.isArray(localeSnapshot?.locales) && localeSnapshot.locales.some((entry) => String(entry?.id).toLowerCase() === 'ru');
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

        ctx.effect(() => ctx.locale.register(NS, { en, ru, zh }), 'tts-ru: dictionaries');
        ctx.effect(() => ensureRussian(ctx.locale), 'tts-ru: russian language');

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = '@apopov-app/dsh-tts-ru';
          tag.dataset.pluginCss = '@apopov-app/dsh-tts-ru/client.css';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => {
            tag.remove();
          };
        }, 'tts-ru: styles');

        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.composer.dock',
              id: 'tts-ru',
              order: 2,
              locale: NS,
              label: () => translate('dock.title'),
            },
            VoiceRepliesDock,
          ),
        );

        ctx.slots.inject('tool.call.toolview', () =>
          ctx.slots.register(
            {
              name: 'tool.call.toolview',
              key: 'speak_summary',
              locale: NS,
            },
            SpokenSummaryRow,
          ),
        );
      },
    };
  },
});
