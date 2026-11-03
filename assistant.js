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
      welcome: 'Welcome to IQZodiac! Your answers help us understand your interests and the way you think, so we can guide you toward real members who share them. I’ll be with you at every step.',
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
      birthdayPrompt: 'One last detail: enter your birth date so I can calculate your zodiac sign and save it to your account.',
      birthdayLabel: 'Date of birth',
      continue: 'Show my result',
      required: 'Please answer this question before continuing.',
      progress: (n, total) => `Step ${n} of ${total}`,
      resultTitle: 'Your discovery snapshot',
      resultNote: 'Your answers are saved to your account. This guided interpretation is not a psychological assessment or guarantee of compatibility.',
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
      completed: 'Your discovery profile is ready. Real member matches are next.',
      reset: 'Start over',
      saved: 'Progress saved securely to your account',
      matches: 'Continue to Match',
      noResults: 'No completed member profiles match yet. We will not invent people or compatibility scores.',
      voiceEnable: 'Hear questions',
      voiceDisable: 'Mute voice',
      voiceReplay: 'Repeat current question',
      voiceOn: 'Voice on — prompts use a warm, gently paced browser voice when available.',
      voiceOff: 'Voice is off.',
      voiceUnavailable: 'Voice playback is unavailable in this browser.',
      demoTitle: 'Connected discovery profile',
      demoNote: 'Your answers are stored in your private Supabase discovery profile and remain available on your account.',
      deviceOnly: 'SAVED TO YOUR ACCOUNT',
    },
    ar: {
      welcome: 'أهلًا بك في IQZodiac! ستساعدنا إجاباتك على فهم اهتماماتك وطريقة تفكيرك، لنرشدك إلى أعضاء حقيقيين يشاركونك الاهتمامات وطريقة التفكير. سأرافقك خطوة بخطوة.',
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
      birthdayPrompt: 'تفصيل أخير: أدخل تاريخ ميلادك لأحسب برجك وأحفظه في حسابك.',
      birthdayLabel: 'تاريخ الميلاد',
      continue: 'عرض نتيجتي',
      required: 'أجب عن هذا السؤال قبل المتابعة.',
      progress: (n, total) => `الخطوة ${n} من ${total}`,
      resultTitle: 'ملخص اكتشافك',
      resultNote: 'حُفظت إجاباتك في حسابك. هذا تفسير إرشادي وليس تقييماً نفسياً أو ضماناً للتوافق.',
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
      completed: 'اكتمل ملف اكتشافك. سنعرض الآن الأعضاء الحقيقيين المناسبين.',
      reset: 'ابدأ من جديد',
      saved: 'حُفظ التقدم بأمان في حسابك',
      matches: 'المتابعة إلى Match',
      noResults: 'لا توجد ملفات أعضاء مكتملة مناسبة بعد. لن نخترع أشخاصاً أو درجات توافق.',
      voiceEnable: 'استمع إلى الأسئلة',
      voiceDisable: 'إيقاف الصوت',
      voiceReplay: 'إعادة السؤال الحالي',
      voiceOn: 'الصوت يعمل — تُنطق الأسئلة بنبرة دافئة وهادئة قليلًا متى توفرت.',
      voiceOff: 'الصوت متوقف.',
      voiceUnavailable: 'ميزة الصوت غير متاحة في هذا المتصفح.',
      demoTitle: 'ملف الاكتشاف متصل',
      demoNote: 'تُحفظ إجاباتك في ملف اكتشافك الخاص داخل Supabase وتبقى متاحة في حسابك.',
      deviceOnly: 'محفوظ في حسابك',
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
  const emptyState = () => ({ questionIndex: 0, answers: [], interests: '', birthDate: '', stage: 'questions' });
  let state = emptyState();
  const questionnaireVersion = 'discover-v2';
  const database = () => window.IQZodiacSupabase?.ready;
  let advanceTimer = null;
  const persistToDatabase = async () => {
    try {
      const client = await database();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return;
      const element = tally().element;
      const zodiac = state.birthDate ? zodiacForDate(state.birthDate)?.[0] : null;
      const interests = state.interests.split(/[,،;؛\n]+/).map((item) => item.trim()).filter(Boolean);
      await client.from('discovery_profiles').upsert({
        user_id: userId, birth_date: state.birthDate || null, zodiac_sign: zodiac,
        personality_element: element, personality_summary: element ? ui().resultSummary[element] : null,
        interests, discoverable: state.stage === 'done',
        discovery_status: state.stage === 'done' ? 'completed' : 'in_progress',
        questionnaire_version: questionnaireVersion, completed_at: state.stage === 'done' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });
      const answerRows = state.answers.map((answer, index) => answer && ({
        user_id: userId, questionnaire_version: questionnaireVersion, question_id: `q${index + 1}`,
        answer_choice: answer.choice || null, answer_text: answer.text || null, answered_at: new Date().toISOString(),
      })).filter(Boolean);
      if (state.interests) answerRows.push({ user_id: userId, questionnaire_version: questionnaireVersion, question_id: 'interests', answer_choice: null, answer_text: state.interests, answered_at: new Date().toISOString() });
      if (answerRows.length) {
        const { error: answersError } = await client.from('discovery_answers').upsert(answerRows, { onConflict: 'user_id,questionnaire_version,question_id' });
        if (answersError) throw answersError;
      }
      const saveNote = document.querySelector('#assistant-demo-note');
      if (saveNote) saveNote.dataset.saveState = 'saved';
      return true;
    } catch (error) {
      console.warn('Discovery progress could not be synced to Supabase.', error);
      const saveNote = document.querySelector('#assistant-demo-note');
      if (saveNote) saveNote.dataset.saveState = 'error';
      return false;
    }
  };
  const hydrateFromDatabase = async () => {
    try {
      const client = await database();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return;
      const [{ data: profile }, { data: answers }] = await Promise.all([
        client.from('discovery_profiles').select('birth_date,discovery_status,interests').eq('user_id', userId).maybeSingle(),
        client.from('discovery_answers').select('question_id,answer_choice,answer_text').eq('user_id', userId).eq('questionnaire_version', questionnaireVersion).order('answered_at', { ascending: true }),
      ]);
      if (!profile && !answers?.length) return;
      const answerMap = new Map((answers || []).map((answer) => [answer.question_id, answer]));
      state = emptyState();
      state.answers = questions.map((question, index) => {
        const answer = answerMap.get(`q${index + 1}`);
        if (!answer) return undefined;
        const selected = question.a.find(([label]) => label === answer.answer_choice);
        return { choice: answer.answer_choice || undefined, element: selected?.[1], text: answer.answer_text || undefined };
      });
      const firstMissing = state.answers.findIndex((answer) => !answer);
      state.questionIndex = firstMissing === -1 ? questions.length : firstMissing;
      state.interests = answerMap.get('interests')?.answer_text || (profile?.interests || []).join(', ');
      state.birthDate = profile?.birth_date || '';
      if (profile?.discovery_status === 'completed' && state.birthDate) state.stage = 'done';
      else if (state.questionIndex >= questions.length && state.interests) state.stage = 'birthdate';
      else if (state.questionIndex >= questions.length) state.stage = 'interests';
      else state.stage = 'questions';
    } catch (error) {
      console.warn('Discovery progress could not be loaded from Supabase.', error);
    }
  };
  const isNewConversation = () => state.stage === 'questions' && state.questionIndex === 0 && state.answers.length === 0;
  const speechAvailable = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance === 'function';
  let voiceEnabled = speechAvailable;
  let activeUtterance = null;
  let pendingAvatarTime = null;
  let lastAvatarBoundary = null;
  const avatarExpressionClasses = ['is-speaking', 'is-smiling', 'is-thinking', 'is-welcoming'];
  const setAvatarExpression = (expression) => {
    if (!avatarStage) return;
    avatarStage.classList.remove(...avatarExpressionClasses);
    avatarStage.classList.add(`is-${expression}`);
  };
  const smileFrameTime = () => 0;
  const showAvatarSmile = () => {
    if (!avatarStage) return;
    setAvatarExpression('smiling');
    lastAvatarBoundary = null;
    if (!avatarVideo) return;
    avatarVideo.loop = true;
    avatarVideo.playbackRate = 1;
    avatarVideo.pause();
    if (avatarVideo.readyState >= 1 && Math.abs(avatarVideo.currentTime - smileFrameTime()) > 0.06) {
      try { avatarVideo.currentTime = smileFrameTime(); } catch { /* Keep the matching portrait visible if seeking is unavailable. */ }
    }
  };
  const showAvatarWelcome = () => {
    setAvatarExpression('welcoming');
    lastAvatarBoundary = null;
    if (!avatarVideo) return;
    avatarVideo.loop = true;
    avatarVideo.playbackRate = 1;
    avatarVideo.pause();
    if (avatarVideo.readyState >= 1 && avatarVideo.currentTime > 0.06) {
      try { avatarVideo.currentTime = smileFrameTime(); } catch { /* Keep the matching portrait visible if seeking is unavailable. */ }
    }
  };
  const showAvatarThinking = () => {
    activeUtterance = null;
    pendingAvatarTime = null;
    lastAvatarBoundary = null;
    if (speechAvailable) window.speechSynthesis.cancel();
    setAvatarExpression('thinking');
    if (!avatarVideo) return;
    avatarVideo.loop = true;
    avatarVideo.playbackRate = 1;
    avatarVideo.pause();
    try { avatarVideo.currentTime = smileFrameTime(); } catch { /* The generated thinking portrait remains visible. */ }
  };
  const setAvatarSpeaking = (speaking) => {
    if (!avatarStage || !avatarVideo) return;
    setAvatarExpression(speaking ? 'speaking' : 'smiling');
    if (speaking) {
      avatarVideo.loop = false;
      const playback = avatarVideo.play();
      if (playback && typeof playback.then === 'function') {
        playback.then(() => avatarStage.classList.remove('is-video-unavailable'))
          .catch(() => avatarStage.classList.add('is-video-unavailable'));
      } else {
        avatarStage.classList.remove('is-video-unavailable');
      }
      return;
    }
    pendingAvatarTime = null;
    lastAvatarBoundary = null;
    avatarVideo.loop = true;
    avatarVideo.playbackRate = 1;
    avatarVideo.pause();
    if (avatarVideo.readyState >= 1) {
      try { avatarVideo.currentTime = smileFrameTime(); } catch { /* Keep the matching portrait visible if seeking is unavailable. */ }
    }
  };
  avatarVideo?.addEventListener('loadeddata', () => {
    if (pendingAvatarTime === null || !activeUtterance) return;
    const target = pendingAvatarTime;
    pendingAvatarTime = null;
    try { avatarVideo.currentTime = target; } catch { pendingAvatarTime = target; }
  });
  avatarVideo?.addEventListener('loadedmetadata', () => {
    if (!activeUtterance && avatarStage?.classList.contains('is-smiling')) showAvatarSmile();
  });
  avatarVideo?.addEventListener('error', () => avatarStage?.classList.add('is-video-unavailable'));
  // Map each sentence's word progress to one pass of the short clip instead of looping on elapsed time.
  const syncAvatarToSpeech = (utterance, event) => {
    if (activeUtterance !== utterance || !avatarVideo) return;
    const elapsed = Number(event?.elapsedTime);
    const duration = avatarVideo.duration;
    const text = String(utterance.text || '');
    const textLength = text.length;
    if (!Number.isFinite(duration) || duration <= 0 || avatarVideo.readyState < 1 || !textLength) return;
    const charIndex = Number(event?.charIndex);
    const hasNewWordIndex = Number.isFinite(charIndex) && charIndex >= 0 && (!lastAvatarBoundary || charIndex > lastAvatarBoundary.charIndex);
    let sentenceStart = lastAvatarBoundary?.sentenceStart ?? 0;
    let sentenceEnd = textLength;
    if (Number.isFinite(charIndex)) {
      sentenceStart = 0;
      const sentenceBreaks = /[.!?؟]/g;
      let punctuation;
      while ((punctuation = sentenceBreaks.exec(text))) {
        if (punctuation.index < charIndex) sentenceStart = punctuation.index + 1;
        else { sentenceEnd = punctuation.index; break; }
      }
    }
    const sentenceLength = Math.max(1, sentenceEnd - sentenceStart);
    const sentenceChanged = !lastAvatarBoundary || lastAvatarBoundary.sentenceStart !== sentenceStart;
    const sentenceElapsedStart = sentenceChanged
      ? (Number.isFinite(elapsed) ? elapsed : 0)
      : lastAvatarBoundary.sentenceElapsedStart;
    const estimatedSpeechDuration = Math.max(1, sentenceLength / 14);
    const progress = hasNewWordIndex
      ? Math.min(1, Math.max(0, (charIndex - sentenceStart) / sentenceLength))
      : Math.min(1, Math.max(0, Number.isFinite(elapsed) ? (elapsed - sentenceElapsedStart) / estimatedSpeechDuration : 0));
    const target = Math.min(Math.max(0, duration - 0.04), progress * duration);
    if (sentenceChanged) avatarVideo.playbackRate = 1;
    else if (lastAvatarBoundary && Number.isFinite(elapsed) && elapsed > lastAvatarBoundary.elapsed && target > lastAvatarBoundary.target) {
      const rate = (target - lastAvatarBoundary.target) / (elapsed - lastAvatarBoundary.elapsed);
      avatarVideo.playbackRate = Math.max(0.25, Math.min(1.35, rate));
    }
    lastAvatarBoundary = {
      charIndex: Number.isFinite(charIndex) ? charIndex : (lastAvatarBoundary?.charIndex ?? -1),
      elapsed: Number.isFinite(elapsed) ? elapsed : (lastAvatarBoundary?.elapsed ?? 0),
      target,
      sentenceStart,
      sentenceElapsedStart,
    };
    if (avatarVideo.readyState < 2) {
      pendingAvatarTime = target;
      try { avatarVideo.currentTime = target; } catch { /* Apply the latest word position after media data arrives. */ }
      return;
    }
    if (Math.abs(target - avatarVideo.currentTime) > 0.16) {
      try { avatarVideo.currentTime = target; } catch { /* Wait for the next spoken-word boundary. */ }
    }
    pendingAvatarTime = null;
    if (avatarVideo.paused) {
      const playback = avatarVideo.play();
      if (playback && typeof playback.catch === 'function') playback.catch(() => avatarStage?.classList.add('is-video-unavailable'));
    }
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
    const firstTurn = isNewConversation();
    const prompt = firstTurn ? `${ui().welcome} ${ui().greeting} ${currentPrompt()}` : currentPrompt();
    if (!speechAvailable || !voiceEnabled || !prompt) return;
    activeUtterance = null;
    window.speechSynthesis.cancel();
    if (firstTurn) showAvatarWelcome(); else showAvatarSmile();
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
      lastAvatarBoundary = null;
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
      return persistToDatabase();
    } catch { /* Database sync reports its own error state. */ }
    return Promise.resolve(false);
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
    resultBox.innerHTML = `<p class="card-kicker">${language === 'ar' ? 'نتيجة اكتشافك' : 'YOUR DISCOVERY RESULT'}</p><h2>${escapeHTML(text.resultTitle)}</h2><p class="assistant-result-note">${escapeHTML(text.resultNote)}</p><div class="assistant-result-grid"><article><small>${escapeHTML(text.element)}</small><strong>${escapeHTML(element ? text.names[element] : (language === 'ar' ? 'غير محدد' : 'Undetermined'))}</strong><p>${escapeHTML(elementText)}</p></article><article><small>${escapeHTML(text.zodiac)}</small><strong>${escapeHTML(zodiac ? zodiac[language === 'ar' ? 1 : 0] : '')}</strong><p>${escapeHTML(state.birthDate)}</p></article><article class="assistant-result-interests"><small>${escapeHTML(text.interests)}</small><strong>${escapeHTML(savedInterests.length ? savedInterests.join(' · ') : text.noInterests)}</strong></article></div><p class="assistant-match-note">${escapeHTML(text.noResults)}</p><a class="button button-secondary" href="./match.html">${escapeHTML(text.matches)} <span class="button-arrow">↗</span></a>`;
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
      form.addEventListener('submit', (event) => { event.preventDefault(); if (advanceTimer !== null) return; const value = form.querySelector('textarea').value.trim(); if (!value) { form.querySelector('.assistant-validation').textContent = text.required; return; } state.interests = value; state.stage = 'birthdate'; saveState(); advanceWithThinking(); });
      turn.append(form);
    } else {
      const form = document.createElement('form'); form.className = 'assistant-answer-form assistant-birth-form';
      form.innerHTML = `<label for="birth-date">${escapeHTML(text.birthdayLabel)}</label><input id="birth-date" type="date" required max="${new Date().toISOString().slice(0, 10)}" value="${escapeHTML(state.birthDate)}" /><button class="button button-primary" type="submit">${escapeHTML(text.continue)} <span class="button-arrow">↗</span></button><p class="assistant-validation" aria-live="polite"></p>`;
      form.addEventListener('submit', (event) => { event.preventDefault(); if (advanceTimer !== null) return; const value = form.querySelector('input').value; if (!value || value > new Date().toISOString().slice(0, 10)) { form.querySelector('.assistant-validation').textContent = text.required; return; } state.birthDate = value; state.stage = 'done'; saveState(); advanceWithThinking(); });
      turn.append(form);
    }
  };
  const advanceWithThinking = () => {
    if (advanceTimer !== null) return;
    turn.inert = true;
    turn.setAttribute('aria-busy', 'true');
    showAvatarThinking();
    advanceTimer = window.setTimeout(() => {
      advanceTimer = null;
      turn.inert = false;
      turn.removeAttribute('aria-busy');
      render();
    }, 820);
  };
  const render = () => {
    turn.inert = false;
    turn.removeAttribute('aria-busy');
    log.replaceChildren(); appendQuestionHistory(); renderTurn();
    document.querySelector('.assistant-chat-foot p').textContent = `${ui().saved}. ${currentLanguage() === 'ar' ? 'يمكنك متابعة المحادثة من أي جهاز بعد تسجيل الدخول.' : 'You can continue from any device after signing in.'}`;
    document.querySelector('#restart-discovery').textContent = ui().reset;
    document.querySelector('#assistant-demo-title').textContent = ui().demoTitle;
    const saveNote = document.querySelector('#assistant-demo-note');
    saveNote.textContent = ui().demoNote;
    if (saveNote.dataset.saveState === 'error') saveNote.textContent = currentLanguage() === 'ar' ? 'تعذر حفظ التقدم. تحقق من الاتصال ثم أعد المحاولة.' : 'Progress could not be saved. Check your connection and try again.';
    if (saveNote.dataset.saveState === 'saved') saveNote.textContent = ui().saved;
    document.querySelector('#assistant-device-label').textContent = ui().deviceOnly;
    updateVoiceControls();
    if (isNewConversation()) showAvatarWelcome(); else showAvatarSmile();
    if (voiceEnabled) speakCurrentPrompt();
    log.scrollTop = log.scrollHeight;
  };
  const submitQuestion = (answer) => {
    if (advanceTimer !== null) return;
    state.answers[state.questionIndex] = answer;
    state.questionIndex += 1;
    if (state.questionIndex >= questions.length) state.stage = 'interests';
    saveState(); advanceWithThinking();
  };
  resetButton.addEventListener('click', async () => {
    if (advanceTimer !== null) { window.clearTimeout(advanceTimer); advanceTimer = null; }
    turn.inert = false;
    turn.removeAttribute('aria-busy');
    const previousState = state;
    state = emptyState();
    try {
      const client = await database();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (userId) await client.from('discovery_answers').delete().eq('user_id', userId).eq('questionnaire_version', questionnaireVersion);
    } catch (error) { console.warn('Discovery answers could not be reset.', error); state = previousState; }
    await saveState(); render();
  });
  voiceToggle.addEventListener('click', () => {
    if (advanceTimer !== null) return;
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
    if (advanceTimer !== null) return;
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
  showAvatarSmile();
  render();
  hydrateFromDatabase().then(() => render());
})();
