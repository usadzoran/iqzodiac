(() => {
  'use strict';

  const questions = [
    { q: 'عندما تواجه مشكلة صعبة، ماذا تفعل؟', a: [['أواجهها بسرعة وأبدأ بالحل', 'fire'], ['أضع خطة عملية', 'earth'], ['أفكر في مشاعري ومشاعر الآخرين', 'water'], ['أبحث عن حل جديد ومختلف', 'air']] },
    { q: 'كيف يصفك المقربون غالبًا؟', a: [['متحمس ومبادر', 'fire'], ['مسؤول ويمكن الاعتماد عليه', 'earth'], ['متفهم وحساس', 'water'], ['فضولي ومبدع', 'air']] },
    { q: 'كيف تفضل قضاء وقت الفراغ؟', a: [['رياضة أو مغامرة', 'fire'], ['نشاط عملي أو ترتيب مشاريعي', 'earth'], ['وقت هادئ مع من أحب', 'water'], ['تعلم شيء جديد أو استكشاف مكان', 'air']] },
    { q: 'ما الذي يجعلك تشعر بالإنجاز؟', a: [['تحقيق هدف صعب', 'fire'], ['بناء شيء مستقر', 'earth'], ['مساعدة شخص قريب مني', 'water'], ['اكتشاف فكرة جديدة', 'air']] },
    { q: 'عندما يحدث خلاف مع شخص تحبه، ماذا تفضل؟', a: [['مناقشته مباشرة', 'fire'], ['البحث عن حل واضح وعادل', 'earth'], ['الاستماع للمشاعر وفهمها', 'water'], ['رؤية المشكلة من زوايا مختلفة', 'air']] },
    { q: 'ما أهم صفة تبحث عنها في شريك الحياة؟', a: [['الطموح والشجاعة', 'fire'], ['المسؤولية والاستقرار', 'earth'], ['الحنان والتفهم', 'water'], ['الانفتاح وحب الاستكشاف', 'air']] },
    { q: 'كيف تحب التعبير عن الاهتمام؟', a: [['بالمبادرة والمفاجآت', 'fire'], ['بالأفعال والالتزام', 'earth'], ['بالكلام الحنون والإصغاء', 'water'], ['بمشاركة الأفكار والتجارب', 'air']] },
    { q: 'ما شكل الحياة الذي يناسبك؟', a: [['حياة مليئة بالحركة والأهداف', 'fire'], ['حياة منظمة ومستقرة', 'earth'], ['حياة دافئة وقريبة من الأسرة', 'water'], ['حياة مرنة ومتجددة', 'air']] },
    { q: 'ما الذي يزعجك أكثر؟', a: [['الملل وعدم التقدم', 'fire'], ['الفوضى وعدم الالتزام', 'earth'], ['البرود وسوء الفهم', 'water'], ['القيود وغياب التجديد', 'air']] },
    { q: 'كيف تتخذ القرارات المهمة؟', a: [['أحسم قراري وأتحمل مسؤوليته', 'fire'], ['أوازن الخيارات وأخطط', 'earth'], ['أراعي أثر القرار على الناس', 'water'], ['أبحث عن احتمالات متعددة', 'air']] },
    { q: 'ما النشاط الذي يجذبك أكثر؟', a: [['التحدي والمنافسة', 'fire'], ['البناء والعمل العملي', 'earth'], ['الفن والتواصل مع الآخرين', 'water'], ['الأفكار والعلوم والاستكشاف', 'air']] },
    { q: 'ما الذي تريده أكثر من علاقة ناجحة؟', a: [['تشجيع متبادل لتحقيق الطموحات', 'fire'], ['الثقة والالتزام وبناء المستقبل', 'earth'], ['الأمان العاطفي والتفاهم', 'water'], ['الحوار والحرية والتطور المشترك', 'air']] },
  ];

  const copy = {
    en: {
      welcome: 'Hi! I’m your IQZodiac discovery guide. This is a local demo, so I’ll ask one question at a time and show how a discovery conversation could work.',
      signupWelcome: 'Plot twist: you survived the signup form! Welcome to IQZodiac. Answer a few questions so we can explore the community you may feel at home in—and the kind of person you’re hoping to meet.',
      greeting: 'Let’s start with how you tend to approach things.',
      typed: 'Your answer',
      choose: 'Choose an answer, or write your own below.',
      writeLabel: 'Your own answer',
      writePlaceholder: 'Type your answer…',
      send: 'Send answer',
      interestsPrompt: 'What interests or activities do you enjoy most? You can list a few, separated by commas.',
      interestsLabel: 'Interests',
      interestsPlaceholder: 'For example: music, hiking, art…',
      birthdayPrompt: 'One last detail: enter your birth date so I can calculate your zodiac sign. This demo uses the date only in this browser.',
      birthdayLabel: 'Date of birth',
      continue: 'Show my demo result',
      required: 'Please answer this question before continuing.',
      progress: (n, total) => `Step ${n} of ${total}`,
      resultTitle: 'Your discovery snapshot',
      resultNote: 'A playful, rule-based demo—not an AI analysis, psychological assessment, or guarantee of compatibility.',
      element: 'Personality pattern',
      zodiac: 'Zodiac sign from your birth date',
      interests: 'Interests you shared',
      noInterests: 'No interests entered.',
      noScore: 'Not enough preset-answer signals to select an element. Your written answers were kept as notes only.',
      resultSummary: {
        fire: 'Your selected answers lean toward initiative, energy, and moving toward goals.',
        earth: 'Your selected answers lean toward steadiness, practical planning, and reliability.',
        water: 'Your selected answers lean toward empathy, emotional connection, and cooperation.',
        air: 'Your selected answers lean toward curiosity, flexibility, and exploring ideas.',
      },
      names: { fire: 'Fire', earth: 'Earth', water: 'Water', air: 'Air' },
      completed: 'You’ve completed this local discovery demo.',
      reset: 'Start over',
      saved: 'Progress saved on this device',
      matches: 'Continue to Match',
      noResults: 'Match profiles are not connected in this prototype; this page does not invent people or compatibility scores.',
      voiceEnable: 'Hear questions',
      voiceDisable: 'Mute voice',
      voiceReplay: 'Repeat current question',
      voiceOn: 'Voice on — prompts use a warm, gently paced browser voice when available.',
      voiceOff: 'Voice is off.',
      voiceUnavailable: 'Voice playback is unavailable in this browser.',
      demoTitle: 'Local demo · not a connected AI',
      demoNote: 'Replies use simple local rules. Optional voice playback runs in your browser; nothing is sent to an AI provider or database.',
      deviceOnly: 'SAVED ON THIS DEVICE ONLY',
    },
    ar: {
      welcome: 'مرحبًا! أنا دليل اكتشاف الشخصية في IQZodiac. هذه تجربة محلية؛ سأطرح سؤالًا واحدًا في كل مرة لأريك كيف يمكن أن تسير المحادثة.',
      signupWelcome: 'مفاجأة: نجوت من استمارة التسجيل! أهلًا بك في IQZodiac. أجب عن بضعة أسئلة لنكتشف المجتمع الذي قد تشعر أنك تنتمي إليه، ونقترب من الشخص الذي تبحث عنه.',
      greeting: 'لنبدأ بطريقة تعاملك عادةً مع الأمور.',
      typed: 'إجابتك',
      choose: 'اختر إجابة أو اكتب إجابتك بنفسك أدناه.',
      writeLabel: 'إجابتك الخاصة',
      writePlaceholder: 'اكتب إجابتك…',
      send: 'إرسال الإجابة',
      interestsPrompt: 'ما الاهتمامات أو الأنشطة التي تستمتع بها؟ يمكنك كتابة بعضها وفصلها بفواصل.',
      interestsLabel: 'الاهتمامات',
      interestsPlaceholder: 'مثلًا: الموسيقى، المشي، الفن…',
      birthdayPrompt: 'تفصيل أخير: أدخل تاريخ ميلادك لأحسب برجك. تستخدم هذه التجربة التاريخ داخل هذا المتصفح فقط.',
      birthdayLabel: 'تاريخ الميلاد',
      continue: 'عرض نتيجتي التجريبية',
      required: 'أجب عن هذا السؤال قبل المتابعة.',
      progress: (n, total) => `الخطوة ${n} من ${total}`,
      resultTitle: 'ملخص اكتشافك',
      resultNote: 'نتيجة مرحة بقواعد بسيطة، وليست تحليلًا بالذكاء الاصطناعي أو تقييمًا نفسيًا أو ضمانًا للتوافق.',
      element: 'النمط الشخصي',
      zodiac: 'البرج وفق تاريخ الميلاد',
      interests: 'الاهتمامات التي ذكرتها',
      noInterests: 'لم تُضف اهتمامات.',
      noScore: 'لا توجد إشارات كافية من الاختيارات الجاهزة لتحديد عنصر. حُفظت إجاباتك المكتوبة كملاحظات فقط.',
      resultSummary: {
        fire: 'تميل اختياراتك إلى المبادرة والطاقة والسعي نحو الأهداف.',
        earth: 'تميل اختياراتك إلى الثبات والتخطيط العملي والاعتمادية.',
        water: 'تميل اختياراتك إلى التعاطف والارتباط العاطفي والتعاون.',
        air: 'تميل اختياراتك إلى الفضول والمرونة واستكشاف الأفكار.',
      },
      names: { fire: 'ناري', earth: 'ترابي', water: 'مائي', air: 'هوائي' },
      completed: 'أكملت تجربة اكتشاف الشخصية المحلية.',
      reset: 'ابدأ من جديد',
      saved: 'التقدم محفوظ على هذا الجهاز',
      matches: 'المتابعة إلى Match',
      noResults: 'ملفات Match غير متصلة في هذه النسخة؛ لن نخترع أشخاصًا أو درجات توافق.',
      voiceEnable: 'استمع إلى الأسئلة',
      voiceDisable: 'إيقاف الصوت',
      voiceReplay: 'إعادة السؤال الحالي',
      voiceOn: 'الصوت يعمل — تُنطق الأسئلة بنبرة دافئة وهادئة قليلًا متى توفرت.',
      voiceOff: 'الصوت متوقف.',
      voiceUnavailable: 'ميزة الصوت غير متاحة في هذا المتصفح.',
      demoTitle: 'نسخة تجريبية محلية · غير متصلة بذكاء اصطناعي',
      demoNote: 'تُنشأ الردود بقواعد محلية بسيطة. يعمل الصوت الاختياري في متصفحك ولا تُرسل أي بيانات إلى مزوّد ذكاء اصطناعي أو قاعدة بيانات.',
      deviceOnly: 'محفوظ على هذا الجهاز فقط',
    },
  };

  const log = document.querySelector('#chat-log');
  const turn = document.querySelector('#chat-turn');
  const resultBox = document.querySelector('#discovery-result');
  const progress = document.querySelector('#chat-progress');
  const resetButton = document.querySelector('#restart-discovery');
  const voiceToggle = document.querySelector('#assistant-voice-toggle');
  const voiceLabel = document.querySelector('#assistant-voice-label');
  const voiceReplay = document.querySelector('#assistant-voice-replay');
  const voiceStatus = document.querySelector('#assistant-voice-status');
  const avatarStage = document.querySelector('#assistant-avatar');
  const avatarVideo = document.querySelector('#assistant-avatar-video');
  const translations = window.IQZodiacTranslations || { arToEn: {} };
  const currentLanguage = () => document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const ui = () => copy[currentLanguage()];
  const fromArabic = (text) => currentLanguage() === 'ar' ? text : (translations.arToEn[text] || text);
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const profileKey = 'iqzodiac-current-profile';
  const readProfile = () => { try { return JSON.parse(localStorage.getItem(profileKey) || 'null'); } catch { return null; } };
  const profileId = readProfile()?.id || 'guest';
  const storageKey = `iqzodiac-discovery-demo-v1:${profileId}`;
  const emptyState = () => ({ questionIndex: 0, answers: [], interests: '', birthDate: '', stage: 'questions' });
  const loadState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!saved || !Array.isArray(saved.answers)) return emptyState();
      const restored = { ...emptyState(), ...saved };
      delete restored.signupWelcome;
      return restored;
    } catch { return emptyState(); }
  };
  let state = loadState();
  const speechAvailable = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance === 'function';
  let voiceEnabled = speechAvailable;
  let activeUtterance = null;
  let pendingAvatarTime = null;
  const setAvatarSpeaking = (speaking) => {
    if (!avatarStage || !avatarVideo) return;
    avatarStage.classList.toggle('is-speaking', speaking);
    if (speaking) {
      const playback = avatarVideo.play();
      if (playback && typeof playback.catch === 'function') playback.catch(() => avatarStage.classList.remove('is-speaking'));
      return;
    }
    pendingAvatarTime = null;
    avatarVideo.pause();
    try { avatarVideo.currentTime = 0; } catch { /* The video may not have loaded yet. */ }
  };
  avatarVideo?.addEventListener('loadeddata', () => {
    if (pendingAvatarTime === null || !activeUtterance) return;
    const target = pendingAvatarTime;
    pendingAvatarTime = null;
    try { avatarVideo.currentTime = target; } catch { pendingAvatarTime = target; }
  });
  const syncAvatarToSpeech = (utterance, event) => {
    if (activeUtterance !== utterance || !avatarVideo || avatarVideo.paused) return;
    const elapsed = Number(event?.elapsedTime);
    const duration = avatarVideo.duration;
    if (!Number.isFinite(elapsed) || elapsed < 0 || !Number.isFinite(duration) || duration <= 0 || avatarVideo.readyState < 1) return;
    const target = elapsed % duration;
    if (avatarVideo.readyState < 2) {
      pendingAvatarTime = target;
      try { avatarVideo.currentTime = target; } catch { /* Apply the latest boundary after media data arrives. */ }
      return;
    }
    const difference = Math.abs(target - avatarVideo.currentTime);
    const drift = Math.min(difference, duration - difference);
    if (drift > 0.32) {
      try { avatarVideo.currentTime = target; } catch { /* Wait for the next browser speech boundary. */ }
    }
    pendingAvatarTime = null;
  };
  const currentPrompt = () => {
    if (state.stage === 'questions') return questionText(state.questionIndex);
    if (state.stage === 'interests') return ui().interestsPrompt;
    if (state.stage === 'birthdate') return ui().birthdayPrompt;
    return '';
  };
  const updateVoiceControls = () => {
    if (!voiceToggle || !voiceLabel || !voiceReplay || !voiceStatus) return;
    voiceToggle.disabled = !speechAvailable;
    voiceToggle.setAttribute('aria-pressed', String(voiceEnabled));
    voiceLabel.textContent = speechAvailable ? (voiceEnabled ? ui().voiceDisable : ui().voiceEnable) : ui().voiceUnavailable;
    voiceReplay.disabled = !speechAvailable;
    voiceReplay.setAttribute('aria-label', ui().voiceReplay);
    voiceReplay.title = ui().voiceReplay;
    voiceStatus.textContent = speechAvailable ? (voiceEnabled ? ui().voiceOn : ui().voiceOff) : ui().voiceUnavailable;
  };
  const speakCurrentPrompt = () => {
    const prompt = currentPrompt();
    if (!speechAvailable || !voiceEnabled || !prompt) return;
    activeUtterance = null;
    setAvatarSpeaking(false);
    window.speechSynthesis.cancel();
    const language = currentLanguage();
    const utterance = new window.SpeechSynthesisUtterance(prompt);
    utterance.lang = language === 'ar' ? 'ar' : 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 0.92;
    utterance.volume = 0.94;
    const voices = window.speechSynthesis.getVoices();
    const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(language));
    const warmVoice = matchingVoices.find((voice) => /female|samantha|aria|jenny|sara|zira|noura|layla|hoda|fatima|laila/i.test(voice.name));
    if (warmVoice || matchingVoices[0]) utterance.voice = warmVoice || matchingVoices[0];
    activeUtterance = utterance;
    const finishSpeaking = () => {
      if (activeUtterance !== utterance) return;
      activeUtterance = null;
      pendingAvatarTime = null;
      setAvatarSpeaking(false);
    };
    utterance.onstart = () => {
      if (activeUtterance !== utterance) return;
      try { avatarVideo.currentTime = 0; } catch { /* The video may not have loaded yet. */ }
      avatarVideo.playbackRate = 1;
      setAvatarSpeaking(true);
    };
    utterance.onboundary = (event) => syncAvatarToSpeech(utterance, event);
    utterance.onend = finishSpeaking;
    utterance.onerror = () => { finishSpeaking(); voiceStatus.textContent = ui().voiceUnavailable; };
    window.speechSynthesis.speak(utterance);
  };
  const saveState = () => {
    try {
      const persistedState = { ...state };
      delete persistedState.signupWelcome;
      localStorage.setItem(storageKey, JSON.stringify(persistedState));
      const profile = readProfile();
      if (profile?.id) {
        profile.onboarding = {
          ...(profile.onboarding || {}),
          status: state.stage === 'done' ? 'completed' : 'in_progress',
          assistant: 'iqzodiac-discovery',
          startedAt: profile.onboarding?.startedAt || new Date().toISOString(),
          completedAt: state.stage === 'done' ? (profile.onboarding?.completedAt || new Date().toISOString()) : null,
          answers: state.answers,
          interests: state.interests,
          birthDate: state.birthDate,
        };
        localStorage.setItem(profileKey, JSON.stringify(profile));
      }
    } catch { /* Keep the onboarding usable when local storage is unavailable. */ }
  };
  if (new URLSearchParams(window.location.search).get('welcome') === '1') {
    state.signupWelcome = true;
    saveState();
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  }

  const addBubble = (speaker, text, extraClass = '') => {
    if (speaker === 'guide') return;
    const bubble = document.createElement('div');
    bubble.className = `assistant-bubble assistant-bubble-${speaker} ${extraClass}`.trim();
    bubble.textContent = text;
    log.append(bubble);
  };
  const questionText = (index) => fromArabic(questions[index].q);
  const answerText = (arabic) => fromArabic(arabic);
  const normalize = (value) => String(value || '').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const classifyFreeText = (value) => {
    const text = normalize(value);
    const terms = {
      fire: ['fire','ambition','challenge','energy','bold','goal','compete','منافس','طموح','تحد','هدف','حماس','مبادرة','شجاعة'],
      earth: ['earth','plan','stable','routine','practical','organize','reliable','استقرار','خطة','تنظيم','عملي','مسؤول','التزام','ثبات'],
      water: ['water','feel','care','family','listen','empathy','kind','مشاعر','أسرة','عائلة','حنان','استماع','تعاطف','تفاهم','قرب'],
      air: ['air','idea','learn','explore','curious','creative','freedom','فكرة','تعلم','استكشاف','فضول','إبداع','حرية','تجديد'],
    };
    const counts = Object.fromEntries(Object.entries(terms).map(([key, list]) => [key, list.filter((word) => text.includes(normalize(word))).length]));
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : null;
  };
  const zodiacForDate = (dateValue) => {
    const date = new Date(`${dateValue}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    const month = date.getUTCMonth() + 1; const day = date.getUTCDate();
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return ['Aries','الحمل'];
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return ['Taurus','الثور'];
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return ['Gemini','الجوزاء'];
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return ['Cancer','السرطان'];
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return ['Leo','الأسد'];
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return ['Virgo','العذراء'];
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return ['Libra','الميزان'];
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return ['Scorpio','العقرب'];
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return ['Sagittarius','القوس'];
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return ['Capricorn','الجدي'];
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return ['Aquarius','الدلو'];
    return ['Pisces','الحوت'];
  };
  const tally = () => {
    const scores = { fire: 0, earth: 0, water: 0, air: 0 };
    state.answers.forEach((answer) => { const key = answer.element || classifyFreeText(answer.text); if (key && scores[key] !== undefined) scores[key] += 1; });
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return ranked[0][1] ? { element: ranked[0][0], scores } : { element: null, scores };
  };
  const appendQuestionHistory = () => {
    if (state.signupWelcome) addBubble('guide', ui().signupWelcome, 'assistant-bubble-surprise');
    addBubble('guide', ui().welcome);
    for (let i = 0; i < Math.min(state.questionIndex, questions.length); i += 1) {
      addBubble('guide', questionText(i));
      const answer = state.answers[i];
      if (answer) addBubble('member', answer.choice ? answerText(answer.choice) : answer.text);
    }
    if (state.stage !== 'questions' && state.interests) {
      addBubble('guide', ui().interestsPrompt); addBubble('member', state.interests);
    }
    if (state.stage === 'done') {
      addBubble('guide', ui().birthdayPrompt);
      addBubble('member', new Intl.DateTimeFormat(currentLanguage() === 'ar' ? 'ar' : 'en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${state.birthDate}T00:00:00Z`)));
      return;
    }
    if (state.stage === 'birthdate') addBubble('guide', ui().birthdayPrompt);
    else if (state.stage === 'interests') addBubble('guide', ui().interestsPrompt);
    else if (state.questionIndex < questions.length) addBubble('guide', questionText(state.questionIndex));
  };
  const renderResult = () => {
    const language = currentLanguage(); const text = ui(); const { element } = tally(); const zodiac = zodiacForDate(state.birthDate);
    const savedInterests = state.interests.split(/[,،;؛\n]+/).map((item) => item.trim()).filter(Boolean);
    const elementText = element ? `${text.names[element]} — ${text.resultSummary[element]}` : text.noScore;
    resultBox.innerHTML = `<p class="card-kicker">${language === 'ar' ? 'النتيجة التجريبية' : 'LOCAL DEMO RESULT'}</p><h2>${escapeHTML(text.resultTitle)}</h2><p class="assistant-result-note">${escapeHTML(text.resultNote)}</p><div class="assistant-result-grid"><article><small>${escapeHTML(text.element)}</small><strong>${escapeHTML(element ? text.names[element] : (language === 'ar' ? 'غير محدد' : 'Undetermined'))}</strong><p>${escapeHTML(elementText)}</p></article><article><small>${escapeHTML(text.zodiac)}</small><strong>${escapeHTML(zodiac ? zodiac[language === 'ar' ? 1 : 0] : '')}</strong><p>${escapeHTML(state.birthDate)}</p></article><article class="assistant-result-interests"><small>${escapeHTML(text.interests)}</small><strong>${escapeHTML(savedInterests.length ? savedInterests.join(' · ') : text.noInterests)}</strong></article></div><p class="assistant-match-note">${escapeHTML(text.noResults)}</p><a class="button button-secondary" href="./match.html">${escapeHTML(text.matches)} <span class="button-arrow">↗</span></a>`;
    resultBox.hidden = false;
  };
  const renderTurn = () => {
    const text = ui(); const total = questions.length + 2;
    const step = state.stage === 'questions' ? state.questionIndex + 1 : state.stage === 'interests' ? questions.length + 1 : questions.length + 2;
    progress.textContent = state.stage === 'done' ? text.completed : text.progress(step, total);
    turn.replaceChildren(); resultBox.hidden = true;
    if (state.stage === 'done') { turn.hidden = true; renderResult(); return; }
    turn.hidden = false;
    if (state.stage === 'questions') {
      const question = questions[state.questionIndex];
      const instruction = document.createElement('p'); instruction.className = 'assistant-turn-instruction'; instruction.textContent = text.choose; turn.append(instruction);
      const options = document.createElement('div'); options.className = 'assistant-choice-list';
      question.a.forEach(([arabic, element]) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'assistant-choice'; button.textContent = answerText(arabic); button.addEventListener('click', () => submitQuestion({ choice: arabic, element })); options.append(button);
      });
      turn.append(options);
      const form = document.createElement('form'); form.className = 'assistant-answer-form';
      form.innerHTML = `<label for="free-answer">${escapeHTML(text.writeLabel)}</label><textarea id="free-answer" rows="2" maxlength="500" placeholder="${escapeHTML(text.writePlaceholder)}"></textarea><button class="button button-primary" type="submit">${escapeHTML(text.send)} <span class="button-arrow">↗</span></button><p class="assistant-validation" aria-live="polite"></p>`;
      form.addEventListener('submit', (event) => { event.preventDefault(); const value = form.querySelector('textarea').value.trim(); if (!value) { form.querySelector('.assistant-validation').textContent = text.required; return; } submitQuestion({ text: value }); });
      turn.append(form);
    } else if (state.stage === 'interests') {
      const form = document.createElement('form'); form.className = 'assistant-answer-form';
      form.innerHTML = `<label for="interest-answer">${escapeHTML(text.interestsLabel)}</label><textarea id="interest-answer" rows="2" maxlength="500" required placeholder="${escapeHTML(text.interestsPlaceholder)}">${escapeHTML(state.interests)}</textarea><button class="button button-primary" type="submit">${escapeHTML(text.send)} <span class="button-arrow">↗</span></button><p class="assistant-validation" aria-live="polite"></p>`;
      form.addEventListener('submit', (event) => { event.preventDefault(); const value = form.querySelector('textarea').value.trim(); if (!value) { form.querySelector('.assistant-validation').textContent = text.required; return; } state.interests = value; state.stage = 'birthdate'; saveState(); render(); });
      turn.append(form);
    } else {
      const form = document.createElement('form'); form.className = 'assistant-answer-form assistant-birth-form';
      form.innerHTML = `<label for="birth-date">${escapeHTML(text.birthdayLabel)}</label><input id="birth-date" type="date" required max="${new Date().toISOString().slice(0, 10)}" value="${escapeHTML(state.birthDate)}" /><button class="button button-primary" type="submit">${escapeHTML(text.continue)} <span class="button-arrow">↗</span></button><p class="assistant-validation" aria-live="polite"></p>`;
      form.addEventListener('submit', (event) => { event.preventDefault(); const value = form.querySelector('input').value; if (!value || value > new Date().toISOString().slice(0, 10)) { form.querySelector('.assistant-validation').textContent = text.required; return; } state.birthDate = value; state.stage = 'done'; saveState(); render(); });
      turn.append(form);
    }
  };
  const render = () => {
    log.replaceChildren(); appendQuestionHistory(); renderTurn();
    document.querySelector('.assistant-chat-foot p').textContent = `${ui().saved}. ${currentLanguage() === 'ar' ? 'الإجابات وتاريخ الميلاد لا يغادران هذا المتصفح.' : 'Answers and birth date stay in this browser.'}`;
    document.querySelector('#restart-discovery').textContent = ui().reset;
    document.querySelector('#assistant-demo-title').textContent = ui().demoTitle;
    document.querySelector('#assistant-demo-note').textContent = ui().demoNote;
    document.querySelector('#assistant-device-label').textContent = ui().deviceOnly;
    updateVoiceControls();
    if (voiceEnabled) speakCurrentPrompt();
    log.scrollTop = log.scrollHeight;
  };
  const submitQuestion = (answer) => {
    state.answers[state.questionIndex] = answer;
    state.questionIndex += 1;
    if (state.questionIndex >= questions.length) state.stage = 'interests';
    saveState(); render();
  };
  resetButton.addEventListener('click', () => { state = emptyState(); saveState(); render(); });
  voiceToggle.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    updateVoiceControls();
    if (voiceEnabled) speakCurrentPrompt();
    else {
      activeUtterance = null;
      window.speechSynthesis.cancel();
      setAvatarSpeaking(false);
    }
  });
  voiceReplay.addEventListener('click', () => {
    if (!voiceEnabled) voiceEnabled = true;
    updateVoiceControls();
    speakCurrentPrompt();
  });
  let renderedLanguage = currentLanguage();
  document.addEventListener('iqzodiac:languagechange', () => {
    if (renderedLanguage === currentLanguage()) return;
    renderedLanguage = currentLanguage();
    render();
  });
  render();
})();
