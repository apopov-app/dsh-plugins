window.__ModuleLoader__.load({
  id: '@apopov-app/dsh-tts-ru',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Locale namespace for this plugin's visible text. */
    const NS = 'tts-ru';
    /** Document-relative form of the Host route. */
    const ROUTE = 'api/tts-ru';
    /** This plugin's package name, used to target its page in the Plugins manager. */
    const PLUGIN_PACKAGE = '@apopov-app/dsh-tts-ru';

    const en = {
      'dock.title': 'Voice replies',
      'dock.aria': 'Voice replies: speak short summaries',
      'dock.unavailable': 'Voice replies are unavailable',
      'settings.hint': 'When enabled, every answer is followed by a short spoken takeaway synthesized on this machine. The composer speaker button does the same.',
      'panel.title': 'Voice replies',
      'panel.hint': 'When enabled, the model sends a 2–3 sentence takeaway to the speak_summary tool and it is spoken locally after the answer. The full answer is never read.',
      'panel.enabled': 'Speak short summaries',
      'panel.voice': 'Voice',
      'panel.intonation': 'Intonation',
      'panel.rate': 'Tempo',
      'intonation.calm': 'Calm',
      'intonation.neutral': 'Neutral',
      'intonation.expressive': 'Expressive',
      'rate.slow': 'Slow',
      'rate.normal': 'Normal',
      'rate.fast': 'Fast',
      'panel.ready': 'Ready',
      'panel.preparing': 'Preparing…',
      'panel.missing': 'Not downloaded',
      'panel.downloadHint': 'The voice model downloads once (~63 MB); no cloud service is used.',
      'panel.loading': 'Loading voice replies…',
      'panel.error': 'Voice replies failed: {message}',
      'panel.refresh': 'Refresh',
      'summary.running': 'Preparing the spoken summary…',
      'summary.title': 'Spoken summary',
      'summary.intro': 'Intro',
      'summary.progress': 'Progress',
      'summary.seconds': '{seconds} s',
      'summary.play': 'Play',
      'summary.queued': 'Queued',
      'summary.stop': 'Stop',
      'summary.loading': 'Loading audio…',
      'summary.failed': 'The spoken summary could not be played.',
      'summary.skipped': 'No spoken summary for this answer.',
    };

    const ru = {
      'dock.title': 'Голосовые ответы',
      'dock.aria': 'Голосовые ответы: озвучивать краткие выжимки',
      'dock.unavailable': 'Голосовые ответы недоступны',
      'settings.hint': 'Когда включено, каждый ответ сопровождается краткой озвученной выжимкой; синтез идёт локально. Кнопка динамика в композере делает то же самое.',
      'panel.title': 'Голосовые ответы',
      'panel.hint': 'Когда режим включён, модель отправляет краткую выжимку (2–3 предложения) в инструмент speak_summary, и она озвучивается локально после ответа. Весь ответ целиком не читается.',
      'panel.enabled': 'Озвучивать краткие выжимки',
      'panel.voice': 'Голос',
      'panel.intonation': 'Интонация',
      'panel.rate': 'Темп',
      'intonation.calm': 'Спокойная',
      'intonation.neutral': 'Обычная',
      'intonation.expressive': 'Выразительная',
      'rate.slow': 'Медленно',
      'rate.normal': 'Обычно',
      'rate.fast': 'Быстро',
      'panel.ready': 'Готов',
      'panel.preparing': 'Готовится…',
      'panel.missing': 'Не скачан',
      'panel.downloadHint': 'Модель голоса скачается один раз (~63 МБ); облачные сервисы не используются.',
      'panel.loading': 'Загрузка голосовых ответов…',
      'panel.error': 'Голосовые ответы не работают: {message}',
      'panel.refresh': 'Обновить',
      'summary.running': 'Готовлю озвучку выжимки…',
      'summary.title': 'Выжимка голосом',
      'summary.intro': 'Вступление',
      'summary.progress': 'Ход работы',
      'summary.seconds': '{seconds} с',
      'summary.play': 'Прослушать',
      'summary.queued': 'В очереди',
      'summary.stop': 'Остановить',
      'summary.loading': 'Загружаю аудио…',
      'summary.failed': 'Не удалось воспроизвести озвученную выжимку.',
      'summary.skipped': 'Для этого ответа озвучки нет.',
    };

    const zh = {
      'dock.title': '语音回复',
      'dock.aria': '语音回复：朗读简短要点',
      'dock.unavailable': '语音回复不可用',
      'settings.hint': '启用后每个回答都会附带一段本地合成的简短语音要点；输入框中的扬声器按钮效果相同。',
      'panel.title': '语音回复',
      'panel.hint': '启用后，模型会把 2–3 句要点发送给 speak_summary 工具，并在回答后于本地朗读。不会朗读完整回答。',
      'panel.enabled': '朗读简短要点',
      'panel.voice': '声音',
      'panel.intonation': '语调',
      'panel.rate': '语速',
      'intonation.calm': '平稳',
      'intonation.neutral': '自然',
      'intonation.expressive': '生动',
      'rate.slow': '慢',
      'rate.normal': '正常',
      'rate.fast': '快',
      'panel.ready': '就绪',
      'panel.preparing': '准备中…',
      'panel.missing': '未下载',
      'panel.downloadHint': '声音模型只会下载一次（约 63 MB）；不使用云端服务。',
      'panel.loading': '正在加载语音回复…',
      'panel.error': '语音回复失败：{message}',
      'panel.refresh': '刷新',
      'summary.running': '正在准备朗读要点…',
      'summary.title': '语音要点',
      'summary.intro': '开场说明',
      'summary.progress': '进展',
      'summary.seconds': '{seconds} 秒',
      'summary.play': '播放',
      'summary.queued': '等待播放',
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
      '.tts-set-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-width:0;padding:2px 0}',
      '.tts-set-text{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.tts-set-title{font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary)}',
      '.tts-set-hint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px}',
      '.tts-set-controls{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap;min-width:0}',
      '.tts-set-switch{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap;cursor:pointer;user-select:none}',
      '.tts-set-switch input{width:15px;height:15px;margin:0;accent-color:var(--dsw-alias-brand-primary)}',
      '.tts-set-select{max-width:200px;height:28px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}',
      '.tts-set-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.tts-pop-selects{display:flex;gap:8px}',
      '.tts-pop-selects .tts-set-select{flex:1 1 0;max-width:none;min-width:0}',
      '.tts-set-section{display:flex;flex-direction:column;gap:10px}',
      '.tts-set-section-title{margin:0;font-size:14px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary)}',
      '.tts-set-section .tts-set-controls{justify-content:flex-start}',
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

    /**
     * Serial playback queue for spoken lines. Intro, progress and summary lines
     * can arrive back-to-back, and playing them on top of each other makes them
     * unintelligible, so every clip waits for the previous one to finish.
     */
    const playback = {
      queue: [],
      active: null,
      /** Append a clip job; a row's stable key makes cancellation safe. */
      enqueue(job) {
        if (this.active !== null && this.active.key === job.key) return false;
        if (this.queue.some((waiting) => waiting.key === job.key)) return false;
        this.queue.push(job);
        this.advance();
        return true;
      },
      /** Drop a queued job or stop the active one; the next job then starts. */
      cancel(key) {
        const index = this.queue.findIndex((job) => job.key === key);
        if (index !== -1) this.queue.splice(index, 1);
        const active = this.active;
        if (active === null || active.key !== key) return;
        this.active = null;
        active.audio.removeEventListener('ended', active.onEnded);
        active.audio.pause();
        this.advance();
      },
      /** Hand the active clip over to the queue (its row is going away). */
      detach(key) {
        const active = this.active;
        if (active !== null && active.key === key) active.detached = true;
      },
      /** Release an element the queue kept alive after its row unmounted. */
      release(job) {
        job.audio.pause();
        if (typeof job.url === 'string' && job.url !== '') URL.revokeObjectURL(job.url);
      },
      /** Start the next job when nothing is playing. */
      advance() {
        if (this.active !== null) return;
        const job = this.queue.shift();
        if (job === undefined) return;
        this.active = job;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          job.audio.removeEventListener('ended', job.onEnded);
          if (this.active === job) {
            this.active = null;
            this.advance();
          }
          if (job.detached === true) this.release(job);
        };
        job.onEnded = () => {
          job.ended();
          finish();
        };
        job.audio.addEventListener('ended', job.onEnded);
        if (job.audio.ended) job.audio.currentTime = 0;
        const started = job.audio.play();
        if (started !== undefined) {
          started.then(() => job.started()).catch(() => {
            job.failed();
            finish();
          });
        }
      },
    };

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
      const panelRef = React.useRef(null);
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
          if (event.type === 'pointerdown') {
            const button = buttonRef.current;
            const panel = panelRef.current;
            if (button !== null && button.contains(event.target)) return;
            if (panel !== null && panel.contains(event.target)) return;
          }
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
              ref: panelRef,
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
                h(
                  'div',
                  { className: 'tts-pop-selects' },
                  h('select', {
                    className: 'tts-set-select',
                    value: state.intonation ?? 'neutral',
                    disabled: !state.loaded,
                    'aria-label': t('panel.intonation'),
                    title: t('panel.intonation'),
                    onChange: (event) => void configure({ intonation: event.target.value }),
                  }, (state.intonations ?? ['calm', 'neutral', 'expressive']).map((id) => h('option', { key: id, value: id }, t(`intonation.${id}`)))),
                  h('select', {
                    className: 'tts-set-select',
                    value: state.rate ?? 'normal',
                    disabled: !state.loaded,
                    'aria-label': t('panel.rate'),
                    title: t('panel.rate'),
                    onChange: (event) => void configure({ rate: event.target.value }),
                  }, (state.rates ?? ['slow', 'normal', 'fast']).map((id) => h('option', { key: id, value: id }, t(`rate.${id}`)))),
                ),
                h('p', { className: 'tts-pop-hint' }, t('panel.downloadHint')),
                state.error !== '' ? h('p', { className: 'tts-error' }, t('panel.error', { message: state.error })) : null,
              ),
          )
          : null,
      );
    }

    /** Poll the shared preference snapshot while a settings surface is mounted. */
    function useVoiceSettings() {
      const state = useSnapshot();
      React.useEffect(() => {
        void refresh();
        const timer = setInterval(() => void refresh(), 3000);
        return () => clearInterval(timer);
      }, []);
      return state;
    }

    /** The enable switch and voice picker shared by every settings surface. */
    function VoiceSettingsControls({ t, state }) {
      const voices = state.voices ?? [];
      const active = state.enabled === true;
      return h(
        'div',
        { className: 'tts-set-controls' },
        h(
          'label',
          { className: 'tts-set-switch' },
          h('input', {
            type: 'checkbox',
            checked: active,
            disabled: !state.loaded,
            onChange: (event) => void configure({ enabled: event.target.checked }),
          }),
          t('panel.enabled'),
        ),
        h(
          'select',
          {
            className: 'tts-set-select',
            value: state.voice,
            disabled: !state.loaded || voices.length === 0,
            'aria-label': t('panel.voice'),
            onChange: (event) => void configure({ voice: event.target.value }),
          },
          voices.map((voice) => h(
            'option',
            { key: voice.id, value: voice.id },
            voice.ready ? voice.title : `${voice.title} (${t('panel.missing')})`,
          )),
        ),
        h(
          'select',
          {
            className: 'tts-set-select',
            value: state.intonation ?? 'neutral',
            disabled: !state.loaded,
            'aria-label': t('panel.intonation'),
            title: t('panel.intonation'),
            onChange: (event) => void configure({ intonation: event.target.value }),
          },
          (state.intonations ?? ['calm', 'neutral', 'expressive']).map((id) => h(
            'option',
            { key: id, value: id },
            t(`intonation.${id}`),
          )),
        ),
        h(
          'select',
          {
            className: 'tts-set-select',
            value: state.rate ?? 'normal',
            disabled: !state.loaded,
            'aria-label': t('panel.rate'),
            title: t('panel.rate'),
            onChange: (event) => void configure({ rate: event.target.value }),
          },
          (state.rates ?? ['slow', 'normal', 'fast']).map((id) => h(
            'option',
            { key: id, value: id },
            t(`rate.${id}`),
          )),
        ),
        state.preparing === true ? h('span', { className: 'tts-set-hint' }, t('panel.preparing')) : null,
        state.error !== '' ? h('span', { className: 'tts-error' }, t('panel.error', { message: state.error })) : null,
      );
    }

    /**
     * Settings → General row: the same enable switch and voice choice as the
     * composer panel, so the preference can be changed without opening the dock.
     */
    function VoiceSettingsRow({ t = (key) => key }) {
      const state = useVoiceSettings();
      return h(
        'div',
        { className: 'tts-set-row' },
        h(
          'div',
          { className: 'tts-set-text' },
          h('div', { className: 'tts-set-title' }, t('dock.title')),
          h('div', { className: 'tts-set-hint' }, t('settings.hint')),
        ),
        h(VoiceSettingsControls, { t, state }),
      );
    }

    /** Whether a Plugins-page subject is this plugin's own bundle or row. */
    function isOwnSubject(subject) {
      if (subject === null || typeof subject !== 'object') return false;
      if (subject.kind !== 'bundle' && subject.kind !== 'row') return false;
      return subject.pkg?.name === PLUGIN_PACKAGE;
    }

    /** Plugin page section: the voice controls on this bundle's Plugins page. */
    function VoiceSettingsSection({ t = (key) => key, subject }) {
      if (!isOwnSubject(subject)) return null;
      // Mounted only on this plugin's own page, so the polling lives in the panel.
      return h(VoiceSettingsPanel, { t });
    }

    /** Mounted section body; separate so hooks run only when the section shows. */
    function VoiceSettingsPanel({ t }) {
      const state = useVoiceSettings();
      return h(
        'section',
        { className: 'tts-set-section', 'data-plugin-tts-settings': true },
        h(
          'div',
          { className: 'tts-set-text' },
          h('h4', { className: 'tts-set-section-title' }, t('dock.title')),
          h('p', { className: 'tts-set-hint' }, t('settings.hint')),
        ),
        h(VoiceSettingsControls, { t, state }),
      );
    }

    /**
     * Chat row for one speak_summary call: shows the spoken line and plays its
     * cached clip through the serial queue.
     *
     * Only a reply that is still streaming in auto-plays. A row mounted already
     * finished came from the restored transcript (another session, a page
     * refresh), so it loads nothing until the user asks to play it — otherwise
     * every visit to an old chat would replay all of its saved clips.
     */
    function SpokenSummaryRow(props) {
      const t = props.t ?? ((key, params) => key);
      const phase = props.phase;
      const block = props.block ?? {};
      const meta = phase === 'result' && block !== null && typeof block === 'object' ? block.meta : undefined;
      const audioId = typeof meta?.audioId === 'string' ? meta.audioId : '';
      const seconds = typeof meta?.seconds === 'number' ? meta.seconds : 0;
      const preview = typeof meta?.text === 'string' ? meta.text : '';
      const kind = meta?.kind === 'intro' ? 'intro' : meta?.kind === 'progress' ? 'progress' : 'summary';
      const failed = phase === 'result' && (block.isError === true || audioId === '');
      /** Whether this row appeared while the call was running (live reply). */
      const liveRef = React.useRef(phase !== 'result');
      const autoPlayedRef = React.useRef(false);
      const aliveRef = React.useRef(true);
      const attemptRef = React.useRef(0);
      const jobKeyRef = React.useRef({});
      const [status, setStatus] = React.useState('idle');
      const [error, setError] = React.useState('');
      const audioRef = React.useRef(null);
      const urlRef = React.useRef('');

      /** Fetch the clip once and keep the element for later replays. */
      const load = React.useCallback(async () => {
        if (audioRef.current !== null) return audioRef.current;
        const response = await request({ action: 'audio', id: audioId });
        const blob = await response.blob();
        if (!aliveRef.current) throw new Error('the spoken summary row was unmounted');
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        urlRef.current = url;
        audioRef.current = audio;
        return audio;
      }, [audioId]);

      /** Load the clip if needed, then hand it to the serial playback queue. */
      const start = React.useCallback(async () => {
        const attempt = attemptRef.current + 1;
        attemptRef.current = attempt;
        setStatus('loading');
        setError('');
        let audio;
        try {
          audio = await load();
        } catch (failure) {
          if (!aliveRef.current || attemptRef.current !== attempt) return;
          setStatus('failed');
          setError(failureText(failure));
          return;
        }
        if (!aliveRef.current || attemptRef.current !== attempt) {
          if (!aliveRef.current) playback.release({ audio, url: urlRef.current });
          return;
        }
        const queued = playback.enqueue({
          key: jobKeyRef.current,
          audio,
          url: urlRef.current,
          started: () => {
            if (aliveRef.current && attemptRef.current === attempt) setStatus('playing');
          },
          ended: () => {
            if (aliveRef.current && attemptRef.current === attempt) setStatus('ready');
          },
          failed: () => {
            if (aliveRef.current && attemptRef.current === attempt) setStatus('ready');
          },
        });
        if (queued) setStatus('queued');
        else if (playback.active !== null && playback.active.key === jobKeyRef.current) setStatus('playing');
        else setStatus('ready');
      }, [load]);

      React.useEffect(() => {
        aliveRef.current = true;
        if (audioId === '') return undefined;
        setStatus('idle');
        setError('');
        if (liveRef.current && !autoPlayedRef.current && read().enabled === true) {
          autoPlayedRef.current = true;
          void start();
        }
        return () => {
          aliveRef.current = false;
          attemptRef.current += 1;
          const active = playback.active;
          if (active !== null && active.key === jobKeyRef.current) {
            // Switching sessions must not cut a clip mid-sentence: hand the
            // playing element to the queue and let it finish, then clean up.
            playback.detach(jobKeyRef.current);
            audioRef.current = null;
            urlRef.current = '';
            return;
          }
          playback.cancel(jobKeyRef.current);
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
      }, [audioId, start]);

      const playing = status === 'playing';
      const toggle = () => {
        if (status === 'loading' || status === 'failed') return;
        if (playing || status === 'queued') {
          attemptRef.current += 1;
          playback.cancel(jobKeyRef.current);
          const audio = audioRef.current;
          if (audio !== null) audio.pause();
          setStatus('ready');
          return;
        }
        void start();
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

      const label = status === 'loading'
        ? t('summary.loading')
        : status === 'queued'
          ? t('summary.queued')
          : playing ? t('summary.stop') : t('summary.play');

      return h(
        'div',
        { className: 'tts-summary-row' },
        h('span', { 'aria-hidden': true }, h(SpeakerIcon, { active: true })),
        kind !== 'summary' && preview !== '' ? h('span', { className: 'tts-summary-meta' }, t(kind === 'intro' ? 'summary.intro' : 'summary.progress')) : null,
        h('span', { className: 'tts-summary-text', title: preview }, preview === '' ? t(kind === 'intro' ? 'summary.intro' : kind === 'progress' ? 'summary.progress' : 'summary.title') : preview),
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
          h('span', null, label),
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

        ctx.slots.inject('settings.general.item', () =>
          ctx.slots.register(
            {
              name: 'settings.general.item',
              id: 'tts-ru-voice',
              order: 25,
              locale: NS,
            },
            VoiceSettingsRow,
          ),
        );

        ctx.slots.inject('plugins.detail.section', () =>
          ctx.slots.register(
            {
              name: 'plugins.detail.section',
              id: 'tts-ru-voice',
              order: 20,
              locale: NS,
            },
            VoiceSettingsSection,
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
