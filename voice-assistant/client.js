window.__ModuleLoader__.load({
  id: '@app-apopov/dsh-voice-assistant',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    /** react-dom is a baseline module, but the bundle must survive a stripped host. */
    const ReactDOM = (function loadReactDom() {
      try {
        return require('react-dom');
      } catch (error) {
        return null;
      }
    })();
    const renderPortal = ReactDOM !== null && typeof ReactDOM.createPortal === 'function' ? ReactDOM.createPortal : null;

    /** Locale namespace for every visible string of this plugin. */
    const NS = 'voice-assistant';
    /** Document-relative form of the Host route. */
    const ROUTE = 'api/voice-assistant';
    /** Package name, used for the injected stylesheet bookkeeping. */
    const PACKAGE_NAME = '@app-apopov/dsh-voice-assistant';

    /** Microphone voice activity detection, in RMS units. */
    const VAD_OPEN = 0.02;
    const VAD_BARGE = 0.035;
    const VAD_CLOSE = 0.013;
    const VAD_OPEN_FRAMES = 3;
    const VAD_END_SILENCE_MS = 900;
    const VAD_MIN_UTTERANCE_MS = 350;
    const VAD_TICK_MS = 16;
    /** A turn that produced no assistant_say clip within this window resumes listening. */
    const THINK_TIMEOUT_MS = 90000;
    const FALLBACK_VOICES = [
      { id: 'irina', title: '' },
      { id: 'dmitri', title: '' },
      { id: 'denis', title: '' },
      { id: 'ruslan', title: '' },
      { id: 'en-lessac', title: '' },
    ];

    const en = {
      'orb.title': 'Voice assistant',
      'orb.aria': 'Voice assistant: toggle voice mode',
      'orb.recording': 'Recording — release to send',
      'panel.title': 'Voice assistant',
      'panel.close': 'Close',
      'panel.voice': 'Voice',
      'panel.intonation': 'Intonation',
      'panel.rate': 'Tempo',
      'intonation.calm': 'Calm',
      'intonation.neutral': 'Neutral',
      'intonation.expressive': 'Expressive',
      'rate.slow': 'Slow',
      'rate.normal': 'Normal',
      'rate.fast': 'Fast',
      'settings.title': 'Voice assistant',
      'settings.hint': 'Microphone mode, voice, intonation and tempo for the voice mode.',
      'settings.voice': 'Voice model',
      'settings.ready': 'Ready',
      'settings.missing': 'Not downloaded',
      'settings.prepare': 'Download voice',
      'settings.prepareFailed': 'Could not start the download',
      'settings.preparing': 'Preparing…',
      'settings.mic': 'Microphone',
      'settings.micDefault': 'System default',
      'settings.sensitivity': 'Noise sensitivity',
      'sensitivity.low': 'Low',
      'sensitivity.normal': 'Normal',
      'sensitivity.high': 'High',
      'sensitivity.hint': 'Only for always-listening mode: lower values ignore more background noise.',
      'listen.label': 'Microphone',
      'listen.push': 'Hold to talk',
      'listen.continuous': 'Always listening',
      'push.hold': 'Hold to talk',
      'push.recording': 'Speak — release to send',
      'push.hint': 'The microphone is armed only while the button is held, so movie or TV audio is ignored.',
      'panel.heard': 'Heard',
      'panel.spoken': 'Said',
      'panel.retry': 'Try again',
      'state.off': 'Tap to talk',
      'state.starting': 'Connecting the microphone…',
      'state.preparing': 'Preparing the model…',
      'state.listening': 'Listening…',
      'state.recording': 'Listening…',
      'state.transcribing': 'Recognizing…',
      'state.thinking': 'Thinking…',
      'state.speaking': 'Speaking…',
      'hint.off': 'Tap the orb to start a conversation',
      'hint.starting': 'Allow microphone access if the browser asks',
      'hint.preparing': 'Downloading the recognition model — once',
      'hint.listening': 'Speak — a pause ends the utterance',
      'hint.recording': 'Recording the utterance…',
      'hint.transcribing': 'Turning the recording into words',
      'hint.thinking': 'You can interrupt by voice',
      'hint.speaking': 'You can interrupt by voice',
      'voice.irina': 'Irina',
      'voice.dmitri': 'Dmitri',
      'voice.denis': 'Denis',
      'voice.ruslan': 'Ruslan',
      'voice.en-lessac': 'English (Lessac)',
      'error.speech': 'Speech recognition is unavailable in this app.',
      'error.catalog': 'Could not read the speech settings: {message}',
      'error.prepare': 'Could not prepare the recognition model: {message}',
      'error.permission': 'Microphone access is required.',
      'error.device': 'No microphone was found.',
      'error.microphone': 'Could not turn the microphone on.',
      'error.unsupported': 'This browser cannot record from the microphone.',
      'error.transcribe': 'Speech recognition failed: {message}',
      'error.tooLarge': 'That utterance was too long — please say it shorter.',
      'error.composer': 'Could not send the message to the composer.',
      'error.audio': 'Could not play the answer.',
      'error.failed': 'Voice mode did not start: {message}',
    };

    const ru = {
      'orb.title': 'Голосовой ассистент',
      'orb.aria': 'Голосовой ассистент: включить голосовой режим',
      'orb.recording': 'Идёт запись — отпустите, чтобы отправить',
      'panel.title': 'Голосовой ассистент',
      'panel.close': 'Закрыть',
      'panel.voice': 'Голос',
      'panel.intonation': 'Интонация',
      'panel.rate': 'Темп',
      'intonation.calm': 'Спокойная',
      'intonation.neutral': 'Обычная',
      'intonation.expressive': 'Выразительная',
      'rate.slow': 'Медленно',
      'rate.normal': 'Обычно',
      'rate.fast': 'Быстро',
      'settings.title': 'Голосовой ассистент',
      'settings.hint': 'Режим микрофона, голос, интонация и темп для голосового режима.',
      'settings.voice': 'Модель голоса',
      'settings.ready': 'Готова',
      'settings.missing': 'Не скачана',
      'settings.prepare': 'Скачать голос',
      'settings.prepareFailed': 'Не удалось начать загрузку',
      'settings.preparing': 'Готовится…',
      'settings.mic': 'Микрофон',
      'settings.micDefault': 'Системный по умолчанию',
      'settings.sensitivity': 'Чувствительность к шуму',
      'sensitivity.low': 'Низкая',
      'sensitivity.normal': 'Обычная',
      'sensitivity.high': 'Высокая',
      'sensitivity.hint': 'Только для режима «Постоянно»: ниже — сильнее игнорируется фоновый шум.',
      'listen.label': 'Микрофон',
      'listen.push': 'По удержанию',
      'listen.continuous': 'Постоянно',
      'push.hold': 'Держите, чтобы говорить',
      'push.recording': 'Говорите — отпустите, чтобы отправить',
      'push.hint': 'Микрофон включается только пока кнопка удерживается — звук из колонок игнорируется.',
      'panel.heard': 'Услышал',
      'panel.spoken': 'Сказал',
      'panel.retry': 'Повторить',
      'state.off': 'Нажмите, чтобы говорить',
      'state.starting': 'Подключаю микрофон…',
      'state.preparing': 'Готовлю модель…',
      'state.listening': 'Слушаю…',
      'state.recording': 'Слушаю…',
      'state.transcribing': 'Распознаю…',
      'state.thinking': 'Думаю…',
      'state.speaking': 'Говорю…',
      'hint.off': 'Нажмите на шар, чтобы начать разговор',
      'hint.starting': 'Разрешите доступ к микрофону, если браузер спросит',
      'hint.preparing': 'Загружаю модель распознавания — это один раз',
      'hint.listening': 'Говорите — пауза завершит фразу',
      'hint.recording': 'Записываю фразу…',
      'hint.transcribing': 'Разбираю запись на слова',
      'hint.thinking': 'Можно перебить голосом',
      'hint.speaking': 'Можно перебить голосом',
      'voice.irina': 'Ирина',
      'voice.dmitri': 'Дмитрий',
      'voice.denis': 'Денис',
      'voice.ruslan': 'Руслан',
      'voice.en-lessac': 'Английский (Lessac)',
      'error.speech': 'Распознавание речи недоступно в этом приложении.',
      'error.catalog': 'Не удалось прочитать настройки распознавания: {message}',
      'error.prepare': 'Не удалось подготовить модель распознавания: {message}',
      'error.permission': 'Нужен доступ к микрофону.',
      'error.device': 'Микрофон не найден.',
      'error.microphone': 'Не удалось включить микрофон.',
      'error.unsupported': 'Браузер не поддерживает запись с микрофона.',
      'error.transcribe': 'Не удалось распознать речь: {message}',
      'error.tooLarge': 'Фраза слишком длинная — скажите короче.',
      'error.composer': 'Не удалось отправить сообщение в композер.',
      'error.audio': 'Не удалось воспроизвести ответ.',
      'error.failed': 'Голосовой режим не запустился: {message}',
    };

    const zh = {
      'orb.title': '语音助手',
      'orb.aria': '语音助手：切换语音模式',
      'orb.recording': '正在录音 — 松开即发送',
      'panel.title': '语音助手',
      'panel.close': '关闭',
      'panel.voice': '声音',
      'panel.intonation': '语调',
      'panel.rate': '语速',
      'intonation.calm': '平稳',
      'intonation.neutral': '自然',
      'intonation.expressive': '生动',
      'rate.slow': '慢',
      'rate.normal': '正常',
      'rate.fast': '快',
      'settings.title': '语音助手',
      'settings.hint': '语音模式的麦克风模式、声音、语调和语速。',
      'settings.voice': '声音模型',
      'settings.ready': '已就绪',
      'settings.missing': '未下载',
      'settings.prepare': '下载声音',
      'settings.prepareFailed': '无法开始下载',
      'settings.preparing': '准备中…',
      'settings.mic': '麦克风',
      'settings.micDefault': '系统默认',
      'settings.sensitivity': '噪声灵敏度',
      'sensitivity.low': '低',
      'sensitivity.normal': '正常',
      'sensitivity.high': '高',
      'sensitivity.hint': '仅用于持续监听模式：数值越低越能忽略背景噪声。',
      'listen.label': '麦克风',
      'listen.push': '按住说话',
      'listen.continuous': '持续监听',
      'push.hold': '按住说话',
      'push.recording': '请说话，松开即发送',
      'push.hint': '仅在按住按钮时开启麦克风，因此会忽略影片或电视的声音。',
      'panel.heard': '听到',
      'panel.spoken': '已说',
      'panel.retry': '重试',
      'state.off': '点击即可说话',
      'state.starting': '正在连接麦克风…',
      'state.preparing': '正在准备模型…',
      'state.listening': '正在听…',
      'state.recording': '正在听…',
      'state.transcribing': '正在识别…',
      'state.thinking': '正在思考…',
      'state.speaking': '正在说…',
      'hint.off': '点击圆球开始语音对话',
      'hint.starting': '如果浏览器询问，请允许使用麦克风',
      'hint.preparing': '正在下载识别模型，只需一次',
      'hint.listening': '请说话，停顿即结束一句',
      'hint.recording': '正在录制这句话…',
      'hint.transcribing': '正在把录音转成文字',
      'hint.thinking': '可以直接用语音打断',
      'hint.speaking': '可以直接用语音打断',
      'voice.irina': '伊琳娜',
      'voice.dmitri': '德米特里',
      'voice.denis': '杰尼斯',
      'voice.ruslan': '鲁斯兰',
      'voice.en-lessac': '英语 (Lessac)',
      'error.speech': '此应用中的语音识别不可用。',
      'error.catalog': '无法读取语音识别设置：{message}',
      'error.prepare': '无法准备识别模型：{message}',
      'error.permission': '需要麦克风权限。',
      'error.device': '没有找到麦克风。',
      'error.microphone': '无法打开麦克风。',
      'error.unsupported': '此浏览器无法录制麦克风。',
      'error.transcribe': '语音识别失败：{message}',
      'error.tooLarge': '这句话太长了，请说得短一些。',
      'error.composer': '无法把消息发送到输入框。',
      'error.audio': '无法播放回答。',
      'error.failed': '语音模式未启动：{message}',
    };

    const CSS = [
      '.va-layer{position:fixed;inset:0;z-index:70;pointer-events:none;--va-level:0}',
      '.va-orb{position:fixed;right:24px;bottom:120px;width:56px;height:56px;padding:0;border:0;border-radius:50%;background:transparent;cursor:pointer;pointer-events:auto;display:flex;align-items:center;justify-content:center;transition:transform .2s ease;-webkit-tap-highlight-color:transparent}',
      '.va-orb:hover{transform:translateY(-1px)}',
      '.va-orb:active{transform:scale(.96)}',
      '.va-orb:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:4px}',
      '.va-orb-body{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;overflow:hidden;isolation:isolate;background:radial-gradient(circle at 32% 26%,rgba(255,255,255,.95),rgba(255,255,255,0) 46%),radial-gradient(circle at 68% 76%,rgba(146,132,255,.9),rgba(146,132,255,0) 62%),radial-gradient(circle at 50% 50%,var(--dsw-alias-brand-primary,#4d6bfe),#2630a8 84%);box-shadow:0 10px 24px rgba(60,86,220,.35),inset 0 1px 2px rgba(255,255,255,.55),inset 0 -8px 16px rgba(10,14,60,.35);animation:va-breathe 4.4s ease-in-out infinite}',
      '.va-orb-shine{position:absolute;left:13%;top:9%;width:52%;height:38%;border-radius:50%;background:radial-gradient(ellipse at 50% 40%,rgba(255,255,255,.85),rgba(255,255,255,0) 70%);filter:blur(1px);transform:rotate(-18deg)}',
      '.va-orb svg{position:relative;z-index:1;opacity:.92;filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))}',
      '.va-orb-ring{position:absolute;inset:-5px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 55%,transparent);opacity:0;pointer-events:none}',
      '.va-orb-ring-2{inset:-5px;animation-delay:1.3s}',
      '.va-layer[data-state="listening"] .va-orb-ring{animation:va-ping 2.7s ease-out infinite}',
      '.va-orb[data-recording="true"]{transform:scale(calc(1 + var(--va-level,0) * .18))}',
      '.va-orb[data-recording="true"] .va-orb-body{background:radial-gradient(circle at 32% 26%,rgba(255,255,255,.9),rgba(255,255,255,0) 46%),radial-gradient(circle at 68% 76%,rgba(255,138,120,.95),rgba(255,138,120,0) 62%),radial-gradient(circle at 50% 50%,#ef4b3f,#8c1510 84%);box-shadow:0 12px 30px rgba(224,60,48,.5),inset 0 1px 2px rgba(255,255,255,.55),inset 0 -8px 16px rgba(80,8,4,.45);animation:va-rec-pulse 1.1s ease-in-out infinite}',
      '.va-orb[data-recording="true"] .va-orb-ring{border-color:rgba(239,75,63,.8);animation:va-ping 1.1s ease-out infinite}',
      '.va-orb[data-recording="true"] .va-orb-ring-2{animation-delay:.55s}',
      '.va-orb[data-recording="true"] svg{opacity:1;filter:drop-shadow(0 0 6px rgba(255,255,255,.55))}',
      '.va-orb-rec{display:none;position:absolute;top:7px;right:7px;width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.35);z-index:2}',
      '.va-orb[data-recording="true"] .va-orb-rec{display:block;animation:va-rec-blink .9s steps(2,start) infinite}',
      '.va-layer[data-state="recording"] .va-orb-ring{animation:va-ping 1.7s ease-out infinite}',
      '.va-layer[data-state="recording"] .va-orb-ring-2{animation-delay:.85s}',
      '.va-layer[data-state="speaking"] .va-orb-ring{animation:va-ping 1.15s ease-out infinite}',
      '.va-layer[data-state="speaking"] .va-orb-ring-2{animation-delay:.58s}',
      '.va-layer[data-state="preparing"] .va-orb-ring,.va-layer[data-state="starting"] .va-orb-ring{animation:va-ping 2s ease-out infinite}',
      '.va-layer[data-state="thinking"] .va-orb-ring{opacity:1;border-color:transparent;border-top-color:var(--dsw-alias-brand-primary,#4d6bfe);border-right-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 35%,transparent);animation:va-spinring 1.5s linear infinite}',
      '.va-layer[data-state="thinking"] .va-orb-ring-2{opacity:0}',
      '.va-layer[data-open="true"] .va-orb{width:48px;height:48px;right:24px;bottom:120px}',
      '.va-panel{position:fixed;right:24px;bottom:186px;width:380px;max-width:calc(100vw - 32px);pointer-events:auto;display:flex;flex-direction:column;gap:12px;padding:16px 16px 14px;border-radius:20px;border:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.25));background:var(--dsw-alias-bg-layer-1,#fff);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 88%,transparent);-webkit-backdrop-filter:blur(22px) saturate(1.3);backdrop-filter:blur(22px) saturate(1.3);box-shadow:0 24px 64px rgba(0,0,0,.18),0 2px 10px rgba(0,0,0,.08);color:var(--dsw-alias-label-primary,#111);animation:va-panel-in .22s ease-out}',
      '.va-panel-head{display:flex;align-items:center;gap:8px;min-width:0}',
      '.va-panel-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-brand-primary,#4d6bfe);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 18%,transparent)}',
      '.va-panel-dot[data-state="listening"],.va-panel-dot[data-state="recording"]{animation:va-dot 1.4s ease-in-out infinite}',
      '.va-panel-dot[data-state="thinking"],.va-panel-dot[data-state="preparing"],.va-panel-dot[data-state="starting"]{animation:va-dot 1s ease-in-out infinite}',
      '.va-panel-title{flex:1 1 auto;min-width:0;font-size:13px;font-weight:600;line-height:18px;letter-spacing:.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.va-panel-close{flex:none;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#666);cursor:pointer}',
      '.va-panel-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#111)}',
      '.va-panel-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:1px}',
      '.va-panel-stage{display:flex;align-items:center;gap:16px;min-width:0;padding:2px 0 4px}',
      '.va-stage{position:relative;flex:0 0 auto;width:62px;height:62px;margin-left:2px}',
      '.va-stage-halo{position:absolute;inset:-12px;border-radius:50%;background:radial-gradient(circle,rgba(92,132,255,.34),rgba(92,132,255,0) 70%);filter:blur(4px);animation:va-breathe 3.6s ease-in-out infinite}',
      '.va-stage-core{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.96),rgba(255,255,255,0) 44%),radial-gradient(circle at 66% 74%,rgba(167,155,255,.9),rgba(167,155,255,0) 62%),radial-gradient(circle at 50% 50%,var(--dsw-alias-brand-primary,#4d6bfe),#2630a8 84%);box-shadow:0 10px 30px rgba(60,86,220,.35),inset 0 1px 2px rgba(255,255,255,.55);transform:scale(calc(1 + var(--va-level) * .12));transition:transform .08s linear}',
      '.va-stage-ring{position:absolute;inset:-6px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 50%,transparent);transform:scale(calc(1 + var(--va-level) * .5));opacity:calc(.18 + var(--va-level) * .72);transition:transform .08s linear,opacity .08s linear}',
      '.va-panel[data-state="thinking"] .va-stage-ring{animation:va-spinring 1.6s linear infinite;border-color:transparent;border-top-color:var(--dsw-alias-brand-primary,#4d6bfe);border-right-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 30%,transparent);opacity:1}',
      '.va-panel[data-state="speaking"] .va-stage-halo{animation:va-halo 1.1s ease-in-out infinite}',
      '.va-panel-status{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.va-state{font-size:15px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary,#111)}',
      '.va-hint{font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary,#666)}',
      '.va-line{display:flex;flex-direction:column;gap:1px;min-width:0;padding:6px 0 0;border-top:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.2))}',
      '.va-line-label{font-size:10px;line-height:14px;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#888)}',
      '.va-line-text{font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary,#111);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}',
      '.va-error{font-size:12px;line-height:17px;color:var(--dsw-alias-state-error-primary,#d33);overflow-wrap:anywhere}',
      '.va-panel-foot{display:flex;align-items:center;gap:10px;min-width:0}',
      '.va-voice{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto}',
      '.va-voice-label{flex:none;font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary,#666)}',
      '.va-voice-select{flex:1 1 auto;min-width:0;height:28px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.25));border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#111);font:inherit;font-size:12px;cursor:pointer}',
      '.va-voice-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:1px}',
      '.va-push{display:flex;align-items:center;justify-content:center;gap:8px;height:44px;margin:0 12px 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:500;cursor:pointer;user-select:none;touch-action:none;box-shadow:none}',
      '.va-push[data-recording="true"]{background:#e2483d;border-color:transparent;color:#fff;box-shadow:0 6px 18px rgba(226,72,61,.35);animation:va-rec-pulse 1.1s ease-in-out infinite}',
      '.va-push:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.va-set-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:2px 0}',
      '.va-set-text{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.va-set-title{font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary)}',
      '.va-set-hint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px}',
      '.va-set-error{color:var(--dsw-alias-state-error-primary,#d33)}',
      '.va-set-list{display:flex;flex-direction:column;min-width:0}',
      '.va-set-item{display:grid;grid-template-columns:minmax(0,1fr) 420px;align-items:center;gap:16px;padding:7px 0;border-top:.5px solid var(--dsw-alias-border-l1,rgba(127,127,127,.14))}',
      '.va-set-item:first-child{border-top:0;padding-top:2px}',
      '.va-set-label{font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary)}',
      '.va-set-value{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0}',
      '.va-set-extra{display:inline-flex;align-items:center;justify-content:flex-end;gap:6px;min-width:96px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.va-set-extra:empty{min-width:0}',
      '.va-set-select{width:220px;max-width:none;flex:none}',
      '.va-voice-ready{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.va-voice-ready[data-ready="true"]{color:#2f9e44}',
      '.va-set-inline{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:flex-end}',
      '.va-set-inline .va-set-item{display:flex;align-items:center;gap:12px}',
      '.va-set-inline .va-set-extra{min-width:0}',
      '.va-set-inline .va-set-select{width:auto;max-width:200px}',
      '.va-set-inline .va-set-item{padding:0;border-top:0}',
      '.va-set-inline .va-set-item+.va-set-item{padding-left:0}',
      '.va-set-controls{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;min-width:0}',
      '.va-set-select-wrap{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.va-set-select{max-width:170px;height:28px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}',
      '.va-set-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.va-set-status{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.va-set-btn{height:24px;padding:0 9px;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}',
      '.va-set-btn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
      '.va-set-section .va-set-status{justify-content:flex-start;flex-wrap:wrap}',
      '.va-set-section{display:flex;flex-direction:column;gap:10px}',
      '.va-set-section-title{margin:0;font-size:14px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary)}',
      '.va-set-section .va-set-controls{justify-content:flex-start}',
      '.va-retry{flex:none;height:28px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.25));border-radius:14px;background:transparent;color:var(--dsw-alias-label-primary,#111);font:inherit;font-size:12px;cursor:pointer}',
      '.va-retry:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.va-retry:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:1px}',
      '.va-tool{height:0;min-height:0;margin:0;padding:0;overflow:hidden}',
      '@keyframes va-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}',
      '@keyframes va-rec-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}',
      '@keyframes va-rec-blink{0%{opacity:1}100%{opacity:.15}}',
      '@keyframes va-ping{0%{transform:scale(1);opacity:.55}70%{opacity:0}100%{transform:scale(1.9);opacity:0}}',
      '@keyframes va-spinring{to{transform:rotate(360deg)}}',
      '@keyframes va-halo{0%,100%{transform:scale(1);opacity:.75}50%{transform:scale(1.18);opacity:1}}',
      '@keyframes va-dot{0%,100%{opacity:1}50%{opacity:.35}}',
      '@keyframes va-panel-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}',
      '@media (prefers-reduced-motion:reduce){.va-orb-body,.va-stage-halo,.va-stage-ring,.va-panel,.va-orb-ring,.va-panel-dot,.va-orb-rec{animation:none!important;transition:none!important}}',
    ].join('\n');

    /** Module-level controller state shared by the overlay and every tool row. */
    let snapshot = {
      loaded: false,
      mode: 'off',
      open: false,
      activeViewId: '',
      panelViewId: '',
      level: 0,
      lastHeard: '',
      lastSpoken: '',
      error: '',
      errorKey: '',
      preparing: false,
      voice: 'irina',
      voices: [],
      intonations: ['calm', 'neutral', 'expressive'],
      rates: ['slow', 'normal', 'fast'],
      listenMode: 'push',
      listenModes: ['push', 'continuous'],
      vadSensitivity: 'normal',
      vadSensitivities: ['low', 'normal', 'high'],
      micDeviceId: '',
    };
    const listeners = new Set();

    /** Replace part of the shared snapshot and wake subscribers. */
    function publish(patch) {
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

    /** Resolve the localized translator installed by apply(). */
    let translate = (key) => key;
    /** Module-level sessions service resolver, bound by `apply`. */
    let reachSessions = () => undefined;
    /** Module-level plugin manager navigator, bound by `apply`. */
    let reachNavigation = () => undefined;

    /** Format an unknown failure for the panel. */
    function failureMessage(error) {
      if (error instanceof Error) return error.message;
      if (error === null || error === undefined) return '';
      return String(error);
    }

    /** Pull a message out of a Remote failure envelope. */
    function remoteMessage(envelope) {
      if (envelope === null || typeof envelope !== 'object') return '';
      const error = envelope.error;
      if (typeof error === 'string') return error;
      if (error !== null && typeof error === 'object' && typeof error.message === 'string') return error.message;
      return '';
    }

    /** A failure that carries the locale key the panel should render. */
    function keyedFailure(errorKey, message) {
      const error = new Error(message === undefined || message === '' ? errorKey : message);
      error.errorKey = errorKey;
      return error;
    }

    /** Promise-based delay used while the recognition model prepares. */
    function sleep(ms) {
      return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
      });
    }

    /** Encode mono floating-point samples as the canonical PCM16 WAV the Host accepts. */
    function encodeWave(samples) {
      const bytes = new Uint8Array(44 + samples.length * 2);
      const view = new DataView(bytes.buffer);
      const text = (at, value) => {
        for (let i = 0; i < value.length; i += 1) bytes[at + i] = value.charCodeAt(i);
      };
      text(0, 'RIFF');
      view.setUint32(4, bytes.length - 8, true);
      text(8, 'WAVE');
      text(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, 16000, true);
      view.setUint32(28, 32000, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      text(36, 'data');
      view.setUint32(40, samples.length * 2, true);
      for (let i = 0; i < samples.length; i += 1) {
        const value = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
      }
      return bytes;
    }

    /** Encode the WAV bytes for the JSON Remote carrier. */
    function audioBase64(bytes) {
      let text = '';
      for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(text);
    }

    /** Resolve after MediaRecorder flushed its final chunk. */
    function stopRecorder(recorder) {
      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          recorder.removeEventListener('stop', finish);
          recorder.removeEventListener('error', finish);
          resolve();
        };
        recorder.addEventListener('stop', finish);
        recorder.addEventListener('error', finish);
        try {
          if (recorder.state === 'inactive') finish();
          else recorder.stop();
        } catch (error) {
          finish();
        }
      });
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
        } catch (error) {
          detail = '';
        }
        throw new Error(detail === '' ? 'HTTP ' + response.status : detail);
      }
      return response;
    }

    /** Adopt the Host preference snapshot without touching controller state. */
    function applyHostState(payload) {
      if (payload === null || typeof payload !== 'object') return;
      const patch = { loaded: true };
      if (typeof payload.voice === 'string' && payload.voice !== '') patch.voice = payload.voice;
      if (Array.isArray(payload.voices)) {
        patch.voices = payload.voices
          .filter((voice) => voice !== null && typeof voice === 'object' && typeof voice.id === 'string')
          .map((voice) => ({
            id: voice.id,
            title: typeof voice.title === 'string' ? voice.title : '',
            ready: voice.ready === true,
            bytes: typeof voice.bytes === 'number' ? voice.bytes : 0,
          }));
      }
      if (typeof payload.intonation === 'string' && payload.intonation !== '') patch.intonation = payload.intonation;
      if (typeof payload.rate === 'string' && payload.rate !== '') patch.rate = payload.rate;
      if (Array.isArray(payload.intonations)) patch.intonations = payload.intonations.filter((id) => typeof id === 'string');
      if (Array.isArray(payload.rates)) patch.rates = payload.rates.filter((id) => typeof id === 'string');
      if (payload.listenMode === 'push' || payload.listenMode === 'continuous') patch.listenMode = payload.listenMode;
      if (typeof payload.vadSensitivity === 'string' && ['low', 'normal', 'high'].includes(payload.vadSensitivity)) patch.vadSensitivity = payload.vadSensitivity;
      if (Array.isArray(payload.vadSensitivities)) patch.vadSensitivities = payload.vadSensitivities.filter((id) => ['low', 'normal', 'high'].includes(id));
      if (typeof payload.micDeviceId === 'string') patch.micDeviceId = payload.micDeviceId;
      if (Array.isArray(payload.listenModes)) {
        const modes = payload.listenModes.filter((mode) => mode === 'push' || mode === 'continuous');
        if (modes.length > 0) patch.listenModes = modes;
      }
      publish(patch);
    }

    /** Refresh voice choices from the Host. */
    async function refresh() {
      try {
        const response = await request({ action: 'state' });
        applyHostState(await response.json());
      } catch (error) {
        publish({ loaded: true });
      }
    }

    /** Persist a preference patch and adopt the Host's new snapshot. */
    async function configure(patch) {
      try {
        const response = await request({ action: 'config', ...patch });
        applyHostState(await response.json());
      } catch (error) {
        /* A stale Host route must not break the voice session. */
      }
    }

    /** Best-effort spoken sample for a just-changed preference. */
    let previewClip = null;

    /** Stop a settings sample that is still playing. */
    function stopPreview() {
      if (previewClip === null) return;
      const clip = previewClip;
      previewClip = null;
      try {
        clip.audio.pause();
      } catch (error) {
        /* the element may already be detached */
      }
      URL.revokeObjectURL(clip.url);
    }

    /** Build the confirmation line in the language of the selected voice. */
    function previewLine(kind, value, state) {
      const voices = Array.isArray(state.voices) ? state.voices : [];
      const selected = voices.find((entry) => entry.id === state.voice);
      const english = selected !== undefined && (selected.lang === 'en' || String(selected.id).startsWith('en-'));
      if (kind === 'voice') {
        const voice = voices.find((entry) => entry.id === value);
        const title = voice !== undefined && voice.title !== '' ? voice.title : value;
        const short = title.replace(/\s*\([^)]*\)\s*$/u, '');
        return english ? 'Voice switched to ' + short + '.' : 'Голос переключён на ' + short + '.';
      }
      if (kind === 'intonation') {
        const ru = { calm: 'спокойная', neutral: 'обычная', expressive: 'выразительная' };
        const en = { calm: 'calm', neutral: 'neutral', expressive: 'expressive' };
        return english ? 'Intonation is now ' + (en[value] ?? value) + '.' : 'Интонация теперь ' + (ru[value] ?? value) + '.';
      }
      if (kind === 'rate') {
        const ru = { slow: 'медленный', normal: 'обычный', fast: 'быстрый' };
        const en = { slow: 'slow', normal: 'normal', fast: 'fast' };
        return english ? 'Tempo is now ' + (en[value] ?? value) + '.' : 'Темп теперь ' + (ru[value] ?? value) + '.';
      }
      return '';
    }

    /** Synthesize and play one short settings confirmation. */
    async function speakPreview(kind, value) {
      const state = read();
      const voices = Array.isArray(state.voices) ? state.voices : [];
      const selected = voices.find((entry) => entry.id === state.voice);
      // Do not trigger a model download just to say a sample.
      if (selected !== undefined && selected.ready !== true) return;
      if (kind === 'voice') {
        const target = voices.find((entry) => entry.id === value);
        if (target !== undefined && target.ready !== true) return;
      }
      const line = previewLine(kind, value, state);
      if (line === '') return;
      stopPreview();
      try {
        const synthesized = await request({ action: 'tts', text: line, kind: 'reply' });
        const payload = await synthesized.json();
        if (payload === null || typeof payload !== 'object' || typeof payload.audioId !== 'string') return;
        const response = await request({ action: 'audio', id: payload.audioId });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        previewClip = { audio, url };
        audio.addEventListener('ended', () => {
          if (previewClip !== null && previewClip.audio === audio) {
            URL.revokeObjectURL(url);
            previewClip = null;
          }
        });
        await audio.play();
      } catch (error) {
        /* a sample must never break the settings surface */
      }
    }

    /** Persist one preference and speak its confirmation when it is audible. */
    async function configureWithPreview(kind, patch) {
      await configure(patch);
      if (kind === 'voice' || kind === 'intonation' || kind === 'rate') void speakPreview(kind, patch[kind]);
    }

    /** The orb's visual variant for a controller snapshot. */
    function variantOf(state) {
      if (state.open !== true) return 'idle';
      if (state.mode === 'starting') return state.preparing === true ? 'preparing' : 'starting';
      if (state.mode === 'listening' || state.mode === 'recording') return state.mode;
      if (state.mode === 'thinking' || state.mode === 'transcribing') return 'thinking';
      if (state.mode === 'speaking') return 'speaking';
      return 'idle';
    }

    /**
     * Voice mode controller: one microphone stream, one VAD loop, a serial clip
     * queue and the barge-in / turn-resumption rules of the contract.
     *
     * Mode machine: off → starting → listening ⇄ recording → transcribing →
     * thinking ⇄ speaking, with `recording` reachable from `listening`,
     * `thinking` and `speaking` (barge-in) and every mode reachable from `off`.
     */
    class VoiceAssistantController {
      constructor() {
        this.mode = 'off';
        this.open = false;
        this.sessionId = '';
        this.panelViewId = '';
        this.activeViewId = '';
        this.views = [];
        this.selection = null;
        this.maxDurationSeconds = 60;
        this.maxAudioBytes = 16 * 1024 * 1024;
        /** Invalidates every in-flight start / recognition step after a close. */
        this.generation = 0;
        this.stream = null;
        this.context = null;
        this.source = null;
        this.analyser = null;
        this.samples = null;
        this.abort = null;
        this.loop = 0;
        this.lastTick = 0;
        this.levelTicks = 0;
        this.voiced = 0;
        this.recorder = null;
        this.chunks = [];
        this.recordingStarted = 0;
        this.silenceMs = 0;
        this.recordTimer = 0;
        this.finishing = false;
        this.queue = [];
        this.playing = null;
        this.played = new Set();
        this.turnActive = false;
        this.watchdog = 0;
        this.pendingHold = false;
        this.requestedViewId = '';
      }

      /** Whether the microphone only opens while the talk control is held. */
      pushMode() {
        return read().listenMode !== 'continuous';
      }

      /** Push-to-talk press: start a recording and barge in if the assistant speaks. */
      holdStart() {
        if (this.open !== true) return;
        if (this.mode === 'off' || this.mode === 'starting' || this.mode === 'recording' || this.mode === 'transcribing') return;
        this.beginUtterance();
      }

      /** Push-to-talk release: finish the utterance and send it. */
      holdEnd() {
        if (this.mode === 'recording') void this.finishUtterance();
      }

      /** Register one mounted overlay and return its disposer. */
      bind(viewId, sessionId, getActions) {
        const existing = this.views.find((view) => view.id === viewId);
        if (existing === undefined) this.views.push({ id: viewId, sessionId, getActions });
        else {
          existing.sessionId = sessionId;
          existing.getActions = getActions;
        }
        this.activeViewId = viewId;
        publish({ activeViewId: viewId });
        return () => this.unbind(viewId);
      }

      /** Drop a mounted overlay; the owner's unmount ends voice mode. */
      unbind(viewId) {
        const index = this.views.findIndex((view) => view.id === viewId);
        if (index !== -1) this.views.splice(index, 1);
        if (this.panelViewId === viewId) {
          if (this.mode !== 'off' || this.open) this.close();
          this.panelViewId = '';
        }
        if (this.activeViewId === viewId) {
          const last = this.views.length > 0 ? this.views[this.views.length - 1] : null;
          this.activeViewId = last === null ? '' : last.id;
          publish({ activeViewId: this.activeViewId });
        }
      }

      /** The composer actions of the given session, if a mounted overlay has them. */
      actionsFor(sessionId) {
        for (let i = this.views.length - 1; i >= 0; i -= 1) {
          const view = this.views[i];
          if (view.sessionId !== sessionId) continue;
          const actions = typeof view.getActions === 'function' ? view.getActions() : null;
          if (actions !== null && actions !== undefined) return actions;
        }
        const last = this.views.length > 0 ? this.views[this.views.length - 1] : null;
        return last !== null && typeof last.getActions === 'function' ? last.getActions() : null;
      }

      /** Orb click: open or close voice mode. */
      toggle(viewId) {
        if (this.open) {
          this.close();
          return;
        }
        void this.start(viewId);
      }

      /** Panel retry after a start failure. */
      retry(viewId) {
        if (this.mode !== 'off') return;
        void this.start(viewId);
      }

      /**
       * Orb press. Push mode starts listening at once (no panel), continuous
       * mode keeps the old behaviour of opening/closing the panel.
       */
      pressOrb(viewId) {
        this.requestedViewId = viewId;
        if (this.pushMode() !== true) {
          this.toggle(viewId);
          return;
        }
        this.pendingHold = true;
        if (this.mode === 'off') {
          void this.start(viewId, { silent: true });
          return;
        }
        this.holdStart();
      }

      /** Orb release: finish the push-to-talk utterance. */
      releaseOrb() {
        this.pendingHold = false;
        this.holdEnd();
      }

      /** Orb right-click: open the panel with the quick settings. */
      showPanel(viewId) {
        this.requestedViewId = viewId;
        if (this.mode === 'off') {
          this.open = true;
          publish({ open: true, panelViewId: viewId, level: 0, preparing: false, error: '', errorKey: '' });
          return;
        }
        publish({ open: true, panelViewId: viewId });
      }

      /** Open voice mode: prepare the recognizer, open the mic and start the VAD. */
      async start(viewId, options = {}) {
        const view = this.views.find((entry) => entry.id === viewId);
        if (view === undefined) return;
        if (this.mode !== 'off') return;
        this.requestedViewId = viewId;
        const silent = options.silent === true;
        this.panelViewId = silent ? '' : viewId;
        this.sessionId = view.sessionId;
        this.open = true;
        this.played = new Set();
        this.queue = [];
        this.playing = null;
        this.turnActive = false;
        this.lastHeard = '';
        this.lastSpoken = '';
        this.error = '';
        this.errorKey = '';
        this.mode = 'starting';
        publish({
          mode: 'starting',
          open: true,
          panelViewId: silent ? '' : viewId,
          preparing: false,
          level: 0,
          error: '',
          errorKey: '',
          lastHeard: '',
          lastSpoken: '',
        });
        const run = ++this.generation;
        try {
          await this.openMicrophone();
          if (run !== this.generation) {
            this.releaseMicrophone();
            return;
          }
          this.voiced = 0;
          this.lastTick = 0;
          this.setState('listening');
          this.startLoop();
          publish({ preparing: false, error: '', errorKey: '' });
          void configure({ enabled: true });
          // The orb was pressed before the mic was ready: start talking now.
          if (this.pendingHold === true) this.holdStart();
        } catch (error) {
          if (run !== this.generation) return;
          const key = typeof error?.errorKey === 'string' ? error.errorKey : 'error.failed';
          this.fail(key, failureMessage(error));
        }
      }

      /** Close voice mode from the orb, the panel or a session unmount. */
      close() {
        this.teardown();
        this.open = false;
        this.panelViewId = '';
        publish({
          mode: 'off',
          open: false,
          panelViewId: '',
          level: 0,
          preparing: false,
          error: '',
          errorKey: '',
        });
        void configure({ enabled: false });
      }

      /** Release everything when the client plugin is unloaded. */
      dispose() {
        this.teardown();
        this.open = false;
        publish({ mode: 'off', open: false, panelViewId: '', level: 0, preparing: false });
        void configure({ enabled: false });
      }

      /** Report a fatal voice-mode failure and keep the panel open with its message. */
      fail(errorKey, message) {
        this.teardown();
        publish({
          mode: 'off',
          open: true,
          panelViewId: this.requestedViewId,
          level: 0,
          preparing: false,
          error: message === undefined ? '' : message,
          errorKey,
        });
        void configure({ enabled: false });
      }

      /** Report a recoverable failure and go back to listening. */
      failSoft(errorKey, message) {
        publish({ error: message === undefined ? '' : message, errorKey });
        this.resumeListening();
      }

      setState(next) {
        if (this.mode === next) return;
        this.mode = next;
        publish({ mode: next });
      }

      /** Acquire the microphone and the RMS analyser once for the whole session. */
      async openMicrophone() {
        const devices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
        if (devices === null || devices === undefined || typeof devices.getUserMedia !== 'function') {
          throw keyedFailure('error.unsupported', 'microphone capture is unavailable');
        }
        this.abort = typeof AbortController === 'function' ? new AbortController() : null;
        let stream;
        try {
          const deviceId = read().micDeviceId;
          stream = await devices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              ...(typeof deviceId === 'string' && deviceId !== '' ? { deviceId: { exact: deviceId } } : {}),
            },
            video: false,
          });
        } catch (error) {
          const name = error !== null && typeof error === 'object' && typeof error.name === 'string' ? error.name : '';
          if (name === 'NotAllowedError' || name === 'SecurityError') throw keyedFailure('error.permission', failureMessage(error));
          if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
            throw keyedFailure('error.device', failureMessage(error));
          }
          throw keyedFailure('error.microphone', failureMessage(error));
        }
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (typeof Ctor !== 'function') {
          for (const track of stream.getTracks()) track.stop();
          throw keyedFailure('error.unsupported', 'the Web Audio API is unavailable');
        }
        let context;
        try {
          context = new Ctor();
          if (typeof context.resume === 'function') await context.resume().catch(() => undefined);
          const analyser = context.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.5;
          const source = context.createMediaStreamSource(stream);
          source.connect(analyser);
          this.context = context;
          this.source = source;
          this.analyser = analyser;
          this.samples = new Float32Array(analyser.fftSize);
        } catch (error) {
          for (const track of stream.getTracks()) track.stop();
          if (context !== undefined && context.state !== 'closed') context.close().catch(() => undefined);
          throw keyedFailure('error.microphone', failureMessage(error));
        }
        this.stream = stream;
        const abort = this.abort;
        if (abort !== null) {
          for (const track of stream.getAudioTracks()) {
            try {
              track.addEventListener('ended', () => {
                if (this.mode !== 'off') this.fail('error.device');
              }, { signal: abort.signal });
            } catch (error) {
              /* Older engines ignore the signal option; the teardown still stops tracks. */
            }
          }
        }
      }

      releaseMicrophone() {
        if (this.abort !== null) {
          try {
            this.abort.abort();
          } catch (error) {
            /* already aborted */
          }
          this.abort = null;
        }
        const stream = this.stream;
        this.stream = null;
        if (stream !== null) {
          try {
            for (const track of stream.getTracks()) track.stop();
          } catch (error) {
            /* the stream was already released */
          }
        }
        const context = this.context;
        this.context = null;
        this.source = null;
        this.analyser = null;
        this.samples = null;
        if (context !== null && context.state !== 'closed') {
          try {
            context.close().catch(() => undefined);
          } catch (error) {
            /* already closed */
          }
        }
      }

      /** Release capture, playback and timers, and invalidate in-flight work. */
      teardown() {
        this.generation += 1;
        this.clearWatchdog();
        this.stopLoop();
        this.abortRecorder();
        this.stopPlayback();
        this.clearQueue();
        this.releaseMicrophone();
        this.selection = null;
        this.turnActive = false;
        this.voiced = 0;
        this.silenceMs = 0;
        this.finishing = false;
        this.mode = 'off';
        this.sessionId = '';
      }

      abortRecorder() {
        const recorder = this.recorder;
        this.recorder = null;
        this.chunks = [];
        clearTimeout(this.recordTimer);
        this.recordTimer = 0;
        if (recorder !== null) {
          recorder.ondataavailable = null;
          recorder.onerror = null;
          try {
            if (recorder.state !== 'inactive') recorder.stop();
          } catch (error) {
            /* already stopped */
          }
        }
      }

      startLoop() {
        this.stopLoop();
        this.levelTicks = 0;
        this.loop = window.setInterval(() => this.tick(), VAD_TICK_MS);
      }

      stopLoop() {
        if (this.loop !== 0) window.clearInterval(this.loop);
        this.loop = 0;
        this.lastTick = 0;
      }

      /** One VAD frame: publish the level, open speech, or close an utterance. */
      tick() {
        if (this.analyser === null || this.samples === null) return;
        let level = 0;
        try {
          this.analyser.getFloatTimeDomainData(this.samples);
          let sum = 0;
          for (let i = 0; i < this.samples.length; i += 1) {
            const sample = this.samples[i];
            sum += sample * sample;
          }
          level = Math.sqrt(sum / this.samples.length);
        } catch (error) {
          level = 0;
        }
        const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
        const dt = this.lastTick === 0 ? VAD_TICK_MS : Math.min(120, now - this.lastTick);
        this.lastTick = now;
        this.levelTicks += 1;
        if (this.open && this.levelTicks % 3 === 0) publish({ level: Math.min(1, level * 6) });
        const mode = this.mode;
        if (mode === 'off' || mode === 'starting') {
          this.voiced = 0;
          return;
        }
        if (mode === 'recording') {
          this.trackUtterance(level, dt);
          return;
        }
        if (mode !== 'listening' && mode !== 'thinking' && mode !== 'speaking') {
          this.voiced = 0;
          return;
        }
        // Push mode arms the microphone only from the talk control: background
        // audio from speakers can never turn into a prompt.
        if (this.pushMode()) {
          this.voiced = 0;
          return;
        }
        // Continuous mode only: a sensitivity preset scales the thresholds so a
        // noisy room can be tamed without switching modes.
        const sensitivity = read().vadSensitivity;
        const factor = sensitivity === 'low' ? 1.7 : sensitivity === 'high' ? 0.75 : 1;
        // While the assistant's own audio is playing, only louder speech counts.
        const threshold = (mode === 'speaking' || this.playing !== null ? VAD_BARGE : VAD_OPEN) * factor;
        if (level > threshold) this.voiced += 1;
        else this.voiced = 0;
        if (this.voiced < VAD_OPEN_FRAMES) return;
        this.voiced = 0;
        this.beginUtterance();
      }

      /** End the utterance once it stayed quiet long enough (or hit the limit). */
      trackUtterance(level, dt) {
        if (level < VAD_CLOSE * this.frameSensitivity()) this.silenceMs += dt;
        else this.silenceMs = 0;
        const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.recordingStarted;
        if (duration < VAD_MIN_UTTERANCE_MS) return;
        if (this.silenceMs >= VAD_END_SILENCE_MS) void this.finishUtterance();
      }

      /** Sensitivity factor applied to the VAD closing threshold. */
      frameSensitivity() {
        const sensitivity = read().vadSensitivity;
        return sensitivity === 'low' ? 1.7 : sensitivity === 'high' ? 0.75 : 1;
      }

      /** Open a recording; any speech during playback is a barge-in. */
      beginUtterance() {
        if (this.mode === 'off' || this.mode === 'starting' || this.mode === 'recording' || this.mode === 'transcribing') return;
        stopPreview();
        if (typeof MediaRecorder !== 'function' || this.stream === null) {
          this.fail('error.unsupported');
          return;
        }
        this.interrupt();
        this.clearWatchdog();
        let recorder;
        try {
          recorder = new MediaRecorder(this.stream);
        } catch (error) {
          this.fail('error.unsupported', failureMessage(error));
          return;
        }
        const chunks = [];
        recorder.ondataavailable = (event) => {
          if (event.data !== null && event.data.size > 0) chunks.push(event.data);
        };
        this.chunks = chunks;
        this.recorder = recorder;
        this.recordingStarted = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.silenceMs = 0;
        try {
          recorder.start();
        } catch (error) {
          this.recorder = null;
          this.chunks = [];
          this.fail('error.unsupported', failureMessage(error));
          return;
        }
        this.setState('recording');
        publish({ level: 0 });
        clearTimeout(this.recordTimer);
        const limit = Math.max(5, Math.min(60, this.maxDurationSeconds || 60));
        this.recordTimer = window.setTimeout(() => {
          void this.finishUtterance();
        }, limit * 1000);
      }

      /** Stop the recorder, transcribe, and hand the text to the composer. */
      async finishUtterance() {
        const recorder = this.recorder;
        if (recorder === null || this.finishing) return;
        this.finishing = true;
        this.recorder = null;
        clearTimeout(this.recordTimer);
        this.recordTimer = 0;
        const chunks = this.chunks;
        this.chunks = [];
        const run = this.generation;
        this.setState('transcribing');
        publish({ level: 0 });
        try {
          await stopRecorder(recorder);
          if (run !== this.generation) return;
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          if (blob.size === 0) {
            this.resumeListening();
            return;
          }
          const bytes = await this.wavBytes(blob);
          if (run !== this.generation) return;
          if (bytes.byteLength > this.maxAudioBytes) {
            this.failSoft('error.tooLarge');
            return;
          }
          const response = await request({ action: 'transcribe', audioBase64: audioBase64(bytes) });
          const payload = await response.json();
          if (run !== this.generation) return;
          const text = String(payload !== null && typeof payload === 'object' ? payload.text ?? '' : '').replace(/\s+/g, ' ').trim();
          if (text === '') {
            this.resumeListening();
            return;
          }
          publish({ lastHeard: text, error: '', errorKey: '' });
          this.send(text);
        } catch (error) {
          if (run !== this.generation) return;
          this.failSoft('error.transcribe', failureMessage(error));
        } finally {
          this.finishing = false;
        }
      }

      /** Decode the recording and resample it to 16 kHz mono PCM16 WAV. */
      async wavBytes(blob) {
        const decoded = await this.decode(blob);
        const seconds = Math.max(0.05, Math.min(decoded.duration, Math.max(1, this.maxDurationSeconds || 60)));
        const frames = Math.max(1, Math.floor(seconds * 16000));
        const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (typeof Offline !== 'function') throw new Error('offline audio rendering is unavailable');
        const offline = new Offline(1, frames, 16000);
        const source = offline.createBufferSource();
        source.buffer = decoded;
        source.connect(offline.destination);
        source.start(0);
        const rendered = await offline.startRendering();
        return encodeWave(rendered.getChannelData(0));
      }

      /** Decode a MediaRecorder blob with the live context, falling back to an offline one. */
      async decode(blob) {
        const array = await blob.arrayBuffer();
        const context = this.context;
        if (context !== null && context.state !== 'closed') {
          try {
            return await context.decodeAudioData(array.slice(0));
          } catch (error) {
            /* fall through to the offline decoder */
          }
        }
        const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (typeof Offline !== 'function') throw new Error('audio decoding is unavailable');
        const offline = new Offline(1, 1, 16000);
        return await offline.decodeAudioData(array.slice(0));
      }

      /** Register the transcript as a Session prompt; a barge-in steers at once. */
      send(text) {
        this.turnActive = true;
        this.setState('thinking');
        this.armWatchdog();
        void this.deliver(text);
        void this.advancePlayback();
      }

      /** The live Session object of the voice-mode session, when available. */
      activeSession() {
        try {
          const sessions = reachSessions();
          if (sessions === undefined || sessions === null || this.sessionId === '') return null;
          const binding = typeof sessions.binding === 'function' ? sessions.binding(this.sessionId) : undefined;
          const session = binding !== null && typeof binding === 'object' ? binding.session : undefined;
          return session !== null && typeof session === 'object' ? session : null;
        } catch (error) {
          return null;
        }
      }

      /**
       * Send one utterance right away. While the assistant turn is running the
       * prompt uses steer delivery, so the composer queue is bypassed and the
       * model turns to the user the way it would in a spoken conversation.
       */
      async deliver(text) {
        const session = this.activeSession();
        if (session !== null && typeof session.prompt === 'function') {
          let running = false;
          try {
            const snapshot = typeof session.getSnapshot === 'function' ? session.getSnapshot() : null;
            running = snapshot !== null && typeof snapshot === 'object' && snapshot.running === true;
          } catch (error) {
            running = false;
          }
          const submit = (mode) => session.prompt([{ type: 'text', text }], mode);
          try {
            let result = await submit(running ? 'steer' : 'queue');
            if (running && result !== null && typeof result === 'object' && result.ok === false) {
              result = await submit('queue');
            }
            if (result === null || typeof result !== 'object' || result.ok !== true) {
              throw new Error(remoteMessage(result) || 'the prompt was refused');
            }
            publish({ error: '', errorKey: '' });
            return;
          } catch (error) {
            // Never lose the utterance: fall back to the composer delivery path.
            this.sendThroughComposer(text, failureMessage(error));
            return;
          }
        }
        this.sendThroughComposer(text, '');
      }

      /** Fallback delivery: write the transcript into the composer and submit it. */
      sendThroughComposer(text, reason) {
        const actions = this.actionsFor(this.sessionId);
        if (actions === null || typeof actions.setDraft !== 'function' || typeof actions.submit !== 'function') {
          this.turnActive = false;
          this.clearWatchdog();
          publish({ error: reason, errorKey: 'error.composer' });
          this.resumeListening();
          return;
        }
        try {
          actions.setDraft(text);
        } catch (error) {
          this.turnActive = false;
          this.clearWatchdog();
          publish({ error: failureMessage(error), errorKey: 'error.composer' });
          this.resumeListening();
          return;
        }
        publish({ error: '', errorKey: '' });
        window.setTimeout(() => {
          try {
            const current = this.actionsFor(this.sessionId);
            if (current === null || typeof current.submit !== 'function') return;
            current.submit();
          } catch (error) {
            publish({ error: failureMessage(error), errorKey: 'error.composer' });
          }
        }, 0);
      }

      /** Return to listening without touching capture resources. */
      resumeListening() {
        if (this.mode === 'off') return;
        this.voiced = 0;
        this.setState('listening');
        publish({ level: 0 });
        void this.advancePlayback();
      }

      /** Accept a synthesized clip from an assistant_say tool row. */
      playClip(meta, sessionKey) {
        if (meta === null || typeof meta !== 'object') return false;
        const audioId = typeof meta.audioId === 'string' ? meta.audioId : '';
        if (audioId === '') return false;
        if (this.mode === 'off' || !this.open) return false;
        if (this.sessionId !== '' && sessionKey !== '' && sessionKey !== this.sessionId) return false;
        const key = sessionKey + ':' + audioId;
        if (this.played.has(key)) return false;
        if (this.playing !== null && this.playing.key === key) return false;
        if (this.queue.some((job) => job.key === key)) return false;
        this.played.add(key);
        if (this.played.size > 64) {
          const oldest = this.played.values().next();
          if (oldest.done !== true) this.played.delete(oldest.value);
        }
        const kind = meta.kind === 'intro' || meta.kind === 'progress' ? meta.kind : 'reply';
        this.queue.push({
          key,
          audioId,
          kind,
          text: typeof meta.text === 'string' ? meta.text : '',
          seconds: typeof meta.seconds === 'number' ? meta.seconds : 0,
          audio: null,
          url: '',
        });
        void this.advancePlayback();
        return true;
      }

      /** Start the next queued clip unless capture or transcription owns the mic. */
      async advancePlayback() {
        if (this.playing !== null || this.queue.length === 0) return;
        if (this.mode === 'off' || this.mode === 'recording' || this.mode === 'transcribing') return;
        const job = this.queue.shift();
        this.playing = job;
        const abort = (message) => {
          if (this.playing !== job) return;
          this.playing = null;
          this.releaseJob(job);
          if (typeof message === 'string' && message !== '') {
            publish({ error: message, errorKey: 'error.audio' });
          }
          this.afterJob(job);
        };
        try {
          const response = await request({ action: 'audio', id: job.audioId });
          if (this.playing !== job) {
            this.releaseJob(job);
            return;
          }
          const blob = await response.blob();
          if (this.playing !== job) {
            this.releaseJob(job);
            return;
          }
          const url = URL.createObjectURL(blob);
          job.url = url;
          job.audio = new Audio(url);
          job.audio.addEventListener('ended', () => this.finishJob(job, false), { once: true });
          job.audio.addEventListener('error', () => this.finishJob(job, true), { once: true });
          if (job.text !== '') publish({ lastSpoken: job.text });
          if (this.mode === 'listening' || this.mode === 'thinking') this.setState('speaking');
          const started = job.audio.play();
          if (started !== null && started !== undefined && typeof started.then === 'function') {
            started.catch(() => this.finishJob(job, true));
          }
        } catch (error) {
          abort(failureMessage(error));
        }
      }

      finishJob(job, failed) {
        if (this.playing !== job) return;
        this.playing = null;
        this.releaseJob(job);
        if (failed) publish({ errorKey: 'error.audio' });
        this.afterJob(job);
      }

      /** Resume listening after a reply, wait for the next clip, or continue. */
      afterJob(job) {
        if (this.mode === 'off') return;
        if (this.queue.length > 0) {
          void this.advancePlayback();
          return;
        }
        if (this.mode === 'recording' || this.mode === 'transcribing') return;
        if (job.kind === 'reply') {
          this.turnActive = false;
          this.clearWatchdog();
          this.resumeListening();
          return;
        }
        if (this.turnActive) {
          this.setState('thinking');
          this.armWatchdog();
          return;
        }
        this.resumeListening();
      }

      releaseJob(job) {
        if (job.audio !== null) {
          try {
            job.audio.pause();
          } catch (error) {
            /* already released */
          }
          job.audio = null;
        }
        if (job.url !== '') {
          try {
            URL.revokeObjectURL(job.url);
          } catch (error) {
            /* already revoked */
          }
          job.url = '';
        }
      }

      stopPlayback() {
        const job = this.playing;
        this.playing = null;
        if (job !== null) this.releaseJob(job);
      }

      clearQueue() {
        for (const job of this.queue) this.releaseJob(job);
        this.queue = [];
      }

      /** Barge-in: silence the current clip and drop everything queued. */
      interrupt() {
        this.stopPlayback();
        this.clearQueue();
      }

      armWatchdog() {
        this.clearWatchdog();
        this.watchdog = window.setTimeout(() => {
          this.watchdog = 0;
          if (this.mode !== 'thinking') return;
          this.turnActive = false;
          this.resumeListening();
        }, THINK_TIMEOUT_MS);
      }

      clearWatchdog() {
        if (this.watchdog !== 0) window.clearTimeout(this.watchdog);
        this.watchdog = 0;
      }
    }

    const controller = new VoiceAssistantController();

    /** Small microphone glyph for the orb. */
    function MicrophoneIcon() {
      return h(
        'svg',
        { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
        h('rect', { x: 9, y: 3, width: 6, height: 11, rx: 3, fill: 'currentColor' }),
        h('path', { d: 'M5 11a7 7 0 0 0 14 0', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }),
        h('path', { d: 'M12 18v3', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }),
      );
    }

    /** Close glyph for the panel header. */
    function CloseIcon() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': true },
        h('path', { d: 'M3 3l8 8M11 3l-8 8', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
      );
    }

    /** Portal the floating layer into document.body so the composer is untouched. */
    function portal(node) {
      if (renderPortal !== null && typeof document !== 'undefined' && document.body !== null) {
        return renderPortal(node, document.body);
      }
      return node;
    }

    /** The fixed orb; its animation follows the controller mode. */
    function VoiceOrb({ state, t, onPress, onRelease, onContext }) {
      const variant = variantOf(state);
      const open = state.open === true;
      return h(
        'button',
        {
          type: 'button',
          className: 'va-orb',
          'data-variant': variant,
          'data-open': open ? 'true' : 'false',
          'data-recording': state.mode === 'recording' ? 'true' : 'false',
          title: state.mode === 'recording' ? t('orb.recording') : t('orb.title'),
          'aria-label': state.mode === 'recording' ? t('orb.recording') : t('orb.aria'),
          'aria-pressed': open,
          onPointerDown: (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            try {
              if (typeof event.currentTarget.setPointerCapture === 'function') event.currentTarget.setPointerCapture(event.pointerId);
            } catch (error) {
              /* pointer capture is best-effort */
            }
            onPress();
          },
          onPointerUp: () => onRelease(),
          onPointerCancel: () => onRelease(),
          onContextMenu: (event) => {
            event.preventDefault();
            onContext();
          },
        },
        h('span', { className: 'va-orb-ring', 'aria-hidden': true }),
        h('span', { className: 'va-orb-ring va-orb-ring-2', 'aria-hidden': true }),
        h(
          'span',
          { className: 'va-orb-body', 'aria-hidden': true },
          h('span', { className: 'va-orb-shine', 'aria-hidden': true }),
          h('span', { className: 'va-orb-rec', 'aria-hidden': true }),
          h(MicrophoneIcon, null),
        ),
      );
    }

    /** Compact glass panel: big orb, state, last heard / last spoken, voice picker. */
    function VoicePanel({ state, t, onClose, onRetry, onVoice, onListenMode }) {
      const variant = variantOf(state);
      const voices = Array.isArray(state.voices) && state.voices.length > 0 ? state.voices : FALLBACK_VOICES;
      const label = state.mode === 'starting' && state.preparing === true ? t('state.preparing') : t('state.' + (state.mode || 'off'));
      const hint = state.mode === 'starting' && state.preparing === true ? t('hint.preparing') : t('hint.' + (state.mode || 'off'));
      const errorText = state.errorKey !== ''
        ? t(state.errorKey, { message: state.error === '' ? '' : state.error })
        : (state.error === '' ? '' : state.error);
      const canRetry = state.mode === 'off' && state.errorKey !== '';
      const pushMode = state.listenMode !== 'continuous';
      const listenModes = Array.isArray(state.listenModes) && state.listenModes.length > 0 ? state.listenModes : ['push', 'continuous'];

      React.useEffect(() => {
        if (state.mode !== 'recording') return undefined;
        const release = () => controller.holdEnd();
        document.addEventListener('pointerup', release);
        document.addEventListener('pointercancel', release);
        return () => {
          document.removeEventListener('pointerup', release);
          document.removeEventListener('pointercancel', release);
        };
      }, [state.mode]);

      return h(
        'div',
        {
          className: 'va-panel',
          role: 'dialog',
          'aria-label': t('panel.title'),
          'data-state': variant,
        },
        h(
          'div',
          { className: 'va-panel-head' },
          h('span', { className: 'va-panel-dot', 'data-state': variant, 'aria-hidden': true }),
          h('span', { className: 'va-panel-title' }, t('panel.title')),
          h(
            'button',
            { type: 'button', className: 'va-panel-close', onClick: onClose, 'aria-label': t('panel.close'), title: t('panel.close') },
            h(CloseIcon, null),
          ),
        ),
        h(
          'div',
          { className: 'va-panel-stage' },
          h(
            'div',
            { className: 'va-stage', 'aria-hidden': true },
            h('span', { className: 'va-stage-halo' }),
            h('span', { className: 'va-stage-ring' }),
            h('span', { className: 'va-stage-core' }),
          ),
          h(
            'div',
            { className: 'va-panel-status' },
            h('div', { className: 'va-state', role: 'status', 'aria-live': 'polite' }, label),
            h('div', { className: 'va-hint' }, hint),
          ),
        ),
        pushMode && state.mode !== 'off' && state.mode !== 'starting'
          ? h(
            React.Fragment,
            null,
            h(
              'button',
              {
                type: 'button',
                className: 'va-push',
                'data-recording': state.mode === 'recording' ? 'true' : 'false',
                onPointerDown: (event) => {
                  event.preventDefault();
                  try {
                    if (typeof event.currentTarget.setPointerCapture === 'function') event.currentTarget.setPointerCapture(event.pointerId);
                  } catch (error) {
                    /* pointer capture is best-effort */
                  }
                  controller.holdStart();
                },
                onPointerUp: () => controller.holdEnd(),
                onPointerCancel: () => controller.holdEnd(),
                onContextMenu: (event) => event.preventDefault(),
              },
              h(MicrophoneIcon, null),
              h('span', null, t(state.mode === 'recording' ? 'push.recording' : 'push.hold')),
            ),
            h('p', { className: 'va-hint va-push-hint' }, t('push.hint')),
          )
          : null,
        state.lastHeard === ''
          ? null
          : h(
            'div',
            { className: 'va-line' },
            h('span', { className: 'va-line-label' }, t('panel.heard')),
            h('span', { className: 'va-line-text' }, state.lastHeard),
          ),
        state.lastSpoken === ''
          ? null
          : h(
            'div',
            { className: 'va-line' },
            h('span', { className: 'va-line-label' }, t('panel.spoken')),
            h('span', { className: 'va-line-text' }, state.lastSpoken),
          ),
        errorText === '' ? null : h('div', { className: 'va-error', role: 'alert' }, errorText),
        h(
          'div',
          { className: 'va-panel-foot' },
          h(
            'label',
            { className: 'va-voice' },
            h('span', { className: 'va-voice-label' }, t('listen.label')),
            h(
              'select',
              {
                className: 'va-voice-select',
                value: pushMode ? 'push' : 'continuous',
                disabled: state.loaded !== true,
                'aria-label': t('listen.label'),
                title: t('listen.label'),
                onChange: (event) => onListenMode(event.target.value),
              },
              listenModes.map((mode) => h('option', { key: mode, value: mode }, t('listen.' + mode))),
            ),
          ),
          h(
            'label',
            { className: 'va-voice' },
            h('span', { className: 'va-voice-label' }, t('panel.voice')),
            h(
              'select',
              {
                className: 'va-voice-select',
                value: state.voice === '' ? 'irina' : state.voice,
                disabled: state.loaded !== true,
                'aria-label': t('panel.voice'),
                title: t('panel.voice'),
                onChange: (event) => onVoice(event.target.value),
              },
              voices.map((voice) => h(
                'option',
                { key: voice.id, value: voice.id },
                voice.title !== '' ? voice.title : t('voice.' + voice.id),
              )),
            ),
          ),
          canRetry
            ? h('button', { type: 'button', className: 'va-retry', onClick: onRetry }, t('panel.retry'))
            : null,
        ),
      );
    }

    /** Poll the shared preference snapshot while a settings surface is mounted. */
    function useAssistantSettings() {
      const state = useSnapshot();
      React.useEffect(() => {
        void refresh();
        const timer = setInterval(() => void refresh(), 3000);
        return () => clearInterval(timer);
      }, []);
      return state;
    }

    /** One labelled select used by the settings surfaces. */
    function SettingsSelect({ label, value, options, onSelect }) {
      return h(
        'label',
        { className: 'va-set-select-wrap' },
        h('span', null, label),
        h(
          'select',
          {
            className: 'va-set-select',
            value,
            'aria-label': label,
            title: label,
            onChange: (event) => onSelect(event.target.value),
          },
          options.map((entry) => h('option', { key: entry.id, value: entry.id }, entry.label)),
        ),
      );
    }

    /** Listen mode, voice, intonation and tempo controls, shared by every settings surface. */
    /** Microphone inputs for the device picker; labels need a permission grant. */
    function useMicrophoneDevices(t) {
      const [devices, setDevices] = React.useState([]);
      React.useEffect(() => {
        let cancelled = false;
        const load = async () => {
          try {
            const media = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
            if (media === undefined || media === null || typeof media.enumerateDevices !== 'function') return;
            const list = await media.enumerateDevices();
            if (cancelled) return;
            setDevices(list
              .filter((device) => device.kind === 'audioinput')
              .map((device, index) => ({
                id: device.deviceId,
                label: device.label !== '' ? device.label : t('settings.mic') + ' ' + (index + 1),
              })));
          } catch (error) {
            /* device labels are optional */
          }
        };
        void load();
        return () => {
          cancelled = true;
        };
      }, []);
      return devices;
    }

    /** Label on the left, select (and optional status) on the right. */
    function SettingsLine({ label, value, options, onSelect, children }) {
      return h(
        'div',
        { className: 'va-set-item' },
        h('span', { className: 'va-set-label' }, label),
        h(
          'span',
          { className: 'va-set-value' },
          children === undefined ? null : h('span', { className: 'va-set-extra' }, children),
          h(
            'select',
            {
              className: 'va-set-select',
              value,
              'aria-label': label,
              title: label,
              onChange: (event) => onSelect(event.target.value),
            },
            options.map((entry) => h('option', { key: entry.id, value: entry.id }, entry.label)),
          ),
        ),
      );
    }

    /** Full stacked settings list used on the plugin page. */
    function AssistantSettingsList({ t }) {
      const state = useAssistantSettings();
      const listenMode = state.listenMode === 'continuous' ? 'continuous' : 'push';
      const listenModes = Array.isArray(state.listenModes) && state.listenModes.length > 0 ? state.listenModes : ['push', 'continuous'];
      const voices = Array.isArray(state.voices) && state.voices.length > 0 ? state.voices : FALLBACK_VOICES;
      const voice = typeof state.voice === 'string' && state.voice !== '' ? state.voice : 'irina';
      const intonations = Array.isArray(state.intonations) && state.intonations.length > 0 ? state.intonations : ['calm', 'neutral', 'expressive'];
      const intonation = intonations.includes(state.intonation) ? state.intonation : 'neutral';
      const rates = Array.isArray(state.rates) && state.rates.length > 0 ? state.rates : ['slow', 'normal', 'fast'];
      const rate = rates.includes(state.rate) ? state.rate : 'normal';
      const sensitivities = Array.isArray(state.vadSensitivities) && state.vadSensitivities.length > 0 ? state.vadSensitivities : ['low', 'normal', 'high'];
      const sensitivity = sensitivities.includes(state.vadSensitivity) ? state.vadSensitivity : 'normal';
      const deviceId = typeof state.micDeviceId === 'string' ? state.micDeviceId : '';
      const devices = useMicrophoneDevices(t);
      const selectedVoice = voices.find((entry) => entry.id === voice);
      const voiceReady = selectedVoice !== undefined && selectedVoice.ready === true;
      const [prepare, setPrepare] = React.useState({ phase: 'idle', message: '' });

      React.useEffect(() => {
        if (voiceReady) setPrepare({ phase: 'idle', message: '' });
      }, [voiceReady, voice]);

      const startPrepare = async () => {
        setPrepare({ phase: 'working', message: '' });
        try {
          const response = await request({ action: 'prepare' });
          if (!response.ok) {
            let detail = '';
            try {
              const payload = await response.json();
              detail = typeof payload?.message === 'string' ? payload.message : '';
            } catch (error) {
              detail = '';
            }
            throw new Error(detail === '' ? 'HTTP ' + response.status : detail);
          }
          await refresh();
        } catch (error) {
          setPrepare({ phase: 'failed', message: failureMessage(error) });
        }
      };
      const preparing = state.preparing === true || prepare.phase === 'working';

      return h(
        'div',
        { className: 'va-set-list' },
        h(SettingsLine, {
          label: t('listen.label'),
          value: listenMode,
          options: listenModes.map((mode) => ({ id: mode, label: t('listen.' + mode) })),
          onSelect: (value) => void configure({ listenMode: value }),
        }),
        h(SettingsLine, {
          label: t('panel.voice'),
          value: voice,
          options: voices.map((entry) => ({ id: entry.id, label: entry.title !== '' ? entry.title : t('voice.' + entry.id) })),
          onSelect: (value) => void configureWithPreview('voice', { voice: value }),
          children: voiceReady
            ? h('span', { className: 'va-voice-ready', 'data-ready': 'true' }, t('settings.ready'))
            : h(
              React.Fragment,
              null,
              h('span', { className: 'va-voice-ready' }, preparing ? t('settings.preparing') : t('settings.missing')),
              preparing
                ? null
                : h('button', {
                  type: 'button',
                  className: 'va-set-btn',
                  onClick: () => {
                    void startPrepare();
                  },
                }, t('settings.prepare')),
            ),
        }),
        h(SettingsLine, {
          label: t('panel.intonation'),
          value: intonation,
          options: intonations.map((id) => ({ id, label: t('intonation.' + id) })),
          onSelect: (value) => void configureWithPreview('intonation', { intonation: value }),
        }),
        h(SettingsLine, {
          label: t('panel.rate'),
          value: rate,
          options: rates.map((id) => ({ id, label: t('rate.' + id) })),
          onSelect: (value) => void configureWithPreview('rate', { rate: value }),
        }),
        h(SettingsLine, {
          label: t('settings.mic'),
          value: deviceId,
          options: [{ id: '', label: t('settings.micDefault') }].concat(devices.map((device) => ({ id: device.id, label: device.label }))),
          onSelect: (value) => void configure({ micDeviceId: value }),
        }),
        h(SettingsLine, {
          label: t('settings.sensitivity'),
          value: sensitivity,
          options: sensitivities.map((id) => ({ id, label: t('sensitivity.' + id) })),
          onSelect: (value) => void configure({ vadSensitivity: value }),
        }),
        h('p', { className: 'va-set-hint' }, t('sensitivity.hint')),
        prepare.phase === 'failed'
          ? h('p', { className: 'va-set-hint va-set-error', role: 'alert' }, t('settings.prepareFailed') + ': ' + prepare.message)
          : null,
      );
    }

    /** Compact inline controls for the Settings → General row. */
    function AssistantSettingsInline({ t, state }) {
      const listenMode = state.listenMode === 'continuous' ? 'continuous' : 'push';
      const listenModes = Array.isArray(state.listenModes) && state.listenModes.length > 0 ? state.listenModes : ['push', 'continuous'];
      const voices = Array.isArray(state.voices) && state.voices.length > 0 ? state.voices : FALLBACK_VOICES;
      const voice = typeof state.voice === 'string' && state.voice !== '' ? state.voice : 'irina';
      const selectedVoice = voices.find((entry) => entry.id === voice);
      const voiceReady = selectedVoice !== undefined && selectedVoice.ready === true;
      return h(
        'div',
        { className: 'va-set-inline' },
        h(SettingsLine, {
          label: t('listen.label'),
          value: listenMode,
          options: listenModes.map((mode) => ({ id: mode, label: t('listen.' + mode) })),
          onSelect: (value) => void configure({ listenMode: value }),
        }),
        h(SettingsLine, {
          label: t('panel.voice'),
          value: voice,
          options: voices.map((entry) => ({ id: entry.id, label: entry.title !== '' ? entry.title : t('voice.' + entry.id) })),
          onSelect: (value) => void configureWithPreview('voice', { voice: value }),
          children: voiceReady ? h('span', { className: 'va-voice-ready', 'data-ready': 'true' }, t('settings.ready')) : null,
        }),
      );
    }

    /** Settings → General row for the voice assistant preferences. */
    function VoiceAssistantSettingsRow({ t = (key) => key }) {
      const state = useAssistantSettings();
      return h(
        'div',
        { className: 'va-set-row' },
        h(
          'div',
          { className: 'va-set-text' },
          h('div', { className: 'va-set-title' }, t('settings.title')),
          h('div', { className: 'va-set-hint' }, t('settings.hint')),
        ),
        h(AssistantSettingsInline, { t, state }),
      );
    }

    /** Plugin page section: the same controls on this bundle's Plugins page. */
    function VoiceAssistantSettingsSection({ t = (key) => key, subject }) {
      const name = subject !== null && typeof subject === 'object' && (subject.kind === 'bundle' || subject.kind === 'row')
        ? subject.pkg?.name
        : undefined;
      if (name !== PACKAGE_NAME) return null;
      return h(AssistantSettingsPanel, { t });
    }

    /** Mounted section body; hooks run only when the section actually shows. */
    function AssistantSettingsPanel({ t }) {
      return h(
        'section',
        { className: 'va-set-section', 'data-voice-assistant-settings': true },
        h(AssistantSettingsList, { t }),
      );
    }

    /**
     * Composer overlay: registers the mounted session with the controller and
     * portals the orb (and panel) into document.body.
     */
    function VoiceAssistantOverlay(props) {
      const state = useSnapshot();
      const [viewId] = React.useState(() => {
        VoiceAssistantOverlay.sequence = (VoiceAssistantOverlay.sequence || 0) + 1;
        return 'va-view-' + VoiceAssistantOverlay.sequence;
      });
      const t = typeof props.t === 'function' ? props.t : translate;
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : '';
      const actionsRef = React.useRef(null);
      actionsRef.current = props.inputActions === undefined ? null : props.inputActions;

      React.useEffect(() => controller.bind(viewId, sessionId, () => actionsRef.current), [viewId, sessionId]);

      React.useEffect(() => {
        void refresh();
      }, []);

      const open = state.open === true;
      React.useEffect(() => {
        if (open) void refresh();
      }, [open]);

      React.useEffect(() => {
        if (state.mode !== 'recording') return undefined;
        const release = () => controller.releaseOrb();
        document.addEventListener('pointerup', release);
        document.addEventListener('pointercancel', release);
        return () => {
          document.removeEventListener('pointerup', release);
          document.removeEventListener('pointercancel', release);
        };
      }, [state.mode]);
      React.useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
          if (event.key !== 'Escape' || event.defaultPrevented) return;
          const target = event.target;
          if (target !== null && typeof target === 'object' && typeof target.closest === 'function') {
            if (target.closest('input, textarea, select, [contenteditable="true"]') !== null) return;
          }
          controller.close();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
          document.removeEventListener('keydown', onKeyDown);
        };
      }, [open]);

      const isOrbView = state.activeViewId === viewId;
      const isPanelView = open && state.panelViewId === viewId;
      if (!isOrbView && !isPanelView) return null;
      if (typeof document === 'undefined' || document.body === null) return null;

      const children = [];
      if (isOrbView) {
        children.push(h(VoiceOrb, {
          key: 'orb',
          state,
          t,
          onPress: () => controller.pressOrb(viewId),
          onRelease: () => controller.releaseOrb(),
          onContext: () => {
            const navigation = reachNavigation();
            if (navigation !== undefined && navigation !== null && typeof navigation.openBundle === 'function') {
              try {
                navigation.openBundle(PACKAGE_NAME);
                return;
              } catch (error) {
                /* fall back to the local panel when navigation is unavailable */
              }
            }
            controller.showPanel(viewId);
          },
        }));
      }
      if (isPanelView) {
        children.push(h(VoicePanel, {
          key: 'panel',
          state,
          t,
          onClose: () => controller.close(),
          onRetry: () => controller.retry(viewId),
          onVoice: (voice) => {
            void configureWithPreview('voice', { voice });
          },
          onListenMode: (listenMode) => {
            void configure({ listenMode });
          },
        }));
      }
      const variant = variantOf(state);
      const layer = h(
        'div',
        {
          className: 'va-layer',
          'data-state': variant,
          'data-open': open ? 'true' : 'false',
          style: { '--va-level': String(typeof state.level === 'number' ? state.level : 0) },
        },
        children,
      );
      return portal(layer);
    }

    /**
     * Zero-height chat row for assistant_say. A row that appeared while the call
     * was still running forwards its clip to the controller; a row restored from
     * an old transcript never auto-plays.
     */
    function AssistantSayRow(props) {
      const phase = props.phase;
      const block = props.block !== null && typeof props.block === 'object' ? props.block : {};
      const meta = phase === 'result' && block !== null && typeof block === 'object' ? block.meta : null;
      const audioId = meta !== null && typeof meta === 'object' && typeof meta.audioId === 'string' ? meta.audioId : '';
      const kind = meta !== null && typeof meta === 'object' ? meta.kind : '';
      const text = meta !== null && typeof meta === 'object' && typeof meta.text === 'string' ? meta.text : '';
      const seconds = meta !== null && typeof meta === 'object' && typeof meta.seconds === 'number' ? meta.seconds : 0;
      const sessionKey = typeof props.sessionId === 'string' && props.sessionId !== '' ? props.sessionId : controller.sessionId;
      const liveRef = React.useRef(phase !== 'result');
      const sentRef = React.useRef('');
      const aliveRef = React.useRef(true);

      React.useEffect(() => () => {
        aliveRef.current = false;
      }, []);

      React.useEffect(() => {
        if (!liveRef.current || audioId === '' || sentRef.current === audioId) return;
        sentRef.current = audioId;
        if (!aliveRef.current) return;
        controller.playClip({ audioId, kind, text, seconds }, sessionKey);
      }, [audioId, kind, text, seconds, sessionKey]);

      return h('div', {
        className: 'va-tool',
        'data-voice-assistant': audioId === '' ? 'pending' : audioId,
        'aria-hidden': true,
      });
    }

    /** Make Russian available when no language pack registered it. */
    function ensureRussian(locale) {
      const localeSnapshot = locale.getLocale();
      const present = Array.isArray(localeSnapshot?.locales)
        && localeSnapshot.locales.some((entry) => String(entry?.id).toLowerCase() === 'ru');
      if (present) return () => {};
      try {
        return locale.addLanguage({ id: 'ru', label: 'Русский', fallback: 'en' });
      } catch (error) {
        return () => {};
      }
    }

    return {
      // Core client services only: recognition runs through this plugin's own
      // Host route, so the built-in speech-to-text and voice-input bundles can
      // be disabled without breaking the assistant.
      inject: ['slots', 'locale', 'sessions', 'pluginNavigation'],
      apply(ctx) {
        translate = ctx.locale.bind(NS);
        reachSessions = () => {
          try {
            return ctx.sessions;
          } catch (error) {
            return undefined;
          }
        };
        reachNavigation = () => {
          try {
            return ctx.pluginNavigation;
          } catch (error) {
            return undefined;
          }
        };

        ctx.effect(() => ctx.locale.register(NS, { en, ru, zh }), 'voice-assistant: dictionaries');
        ctx.effect(() => ensureRussian(ctx.locale), 'voice-assistant: russian language');

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = PACKAGE_NAME;
          tag.dataset.pluginCss = PACKAGE_NAME + '/client.css';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => {
            tag.remove();
          };
        }, 'voice-assistant: styles');

        ctx.effect(() => () => controller.dispose(), 'voice-assistant: controller');

        ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register(
          {
            name: 'conversation.input.overlay',
            id: 'voice-assistant',
            order: 4,
            locale: NS,
            label: () => translate('orb.title'),
          },
          VoiceAssistantOverlay,
        ));

        ctx.slots.inject('settings.general.item', () => ctx.slots.register(
          {
            name: 'settings.general.item',
            id: 'voice-assistant',
            order: 26,
            locale: NS,
          },
          VoiceAssistantSettingsRow,
        ));

        ctx.slots.inject('plugins.detail.section', () => ctx.slots.register(
          {
            name: 'plugins.detail.section',
            id: 'voice-assistant-settings',
            order: 20,
            locale: NS,
          },
          VoiceAssistantSettingsSection,
        ));

        ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
          {
            name: 'tool.call.toolview',
            key: 'assistant_say',
            locale: NS,
          },
          AssistantSayRow,
        ));
      },
    };
  },
});
