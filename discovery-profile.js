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
      welcome: 'Welcome to IQZodiac. Your answers shape a discovery profile that can help you meet members with shared interests.',
      signupWelcome: 'Your account is ready. Complete this short profile setup to save your interests, personality pattern and zodiac sign.',
      greeting: 'Start by choosing the response that best describes how you approach things.',
      typed: 'Your answer',
      choose: 'Choose an answer, or write your own below.',
      writeLabel: 'Your own answer',
      writePlaceholder: 'Type your answer…',
      send: 'Save answer',
      interestsPrompt: 'What interests or activities do you enjoy most? You can list a few, separated by commas.',
      interestsLabel: 'Interests',
      interestsPlaceholder: 'For example: music, hiking, art…',
      birthdayPrompt: 'Enter your birth date to calculate and save your zodiac sign to your profile.',
      birthdayLabel: 'Date of birth',
      elementPrompt: 'Choose the personality element that best reflects your selected answers.',
      elementLabel: 'Personality element',
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
      reset: 'Reset answers',
      saved: 'Progress saved securely to your account',
      matches: 'Continue to Match',
      noResults: 'No completed member profiles match yet. We will not invent people or compatibility scores.',
      voiceEnable: 'Hear questions',
      voiceDisable: 'Mute voice',
      voiceReplay: 'Repeat current question',
      voiceOn: 'Voice playback reads the questions using a browser voice when available.',
      voiceOff: 'Voice is off.',
      voiceUnavailable: 'Voice playback is unavailable in this browser.',
      demoTitle: 'Discovery profile connected',
      demoNote: 'Your answers are stored in your private Supabase discovery profile and remain available on your account.',
      deviceOnly: 'SAVED TO YOUR ACCOUNT',
    },
    ar: {
      welcome: 'مرحبًا بك في IQZodiac. تساعد إجاباتك في بناء ملف اكتشاف يسهّل العثور على أعضاء يشاركونك اهتماماتك.',
      signupWelcome: 'اكتمل إنشاء حسابك. أكمل إعداد الملف لحفظ اهتماماتك ونمط شخصيتك وبرجك.',
      greeting: 'ابدأ باختيار الإجابة التي تصف طريقتك في التعامل مع الأمور.',
      typed: 'إجابتك',
      choose: 'اختر إجابة أو اكتب إجابتك بنفسك أدناه.',
      writeLabel: 'إجابتك الخاصة',
      writePlaceholder: 'اكتب إجابتك…',
      send: 'حفظ الإجابة',
      interestsPrompt: 'ما الاهتمامات أو الأنشطة التي تستمتع بها؟ يمكنك كتابة بعضها وفصلها بفواصل.',
      interestsLabel: 'الاهتمامات',
      interestsPlaceholder: 'مثلًا: الموسيقى، المشي، الفن…',
      birthdayPrompt: 'أدخل تاريخ ميلادك لحساب برجك وحفظه في ملفك.',
      birthdayLabel: 'تاريخ الميلاد',
      elementPrompt: 'اختر عنصر الشخصية الذي يعكس إجاباتك المحددة أكثر.',
      elementLabel: 'عنصر الشخصية',
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
      reset: 'إعادة ضبط الإجابات',
      saved: 'حُفظ التقدم بأمان في حسابك',
      matches: 'المتابعة إلى Match',
      noResults: 'لا توجد ملفات أعضاء مكتملة مناسبة بعد. لن نخترع أشخاصاً أو درجات توافق.',
      voiceEnable: 'استمع إلى الأسئلة',
      voiceDisable: 'إيقاف الصوت',
      voiceReplay: 'إعادة السؤال الحالي',
      voiceOn: 'تُقرأ الأسئلة بصوت المتصفح عند توفر هذه الميزة.',
      voiceOff: 'الصوت متوقف.',
      voiceUnavailable: 'ميزة الصوت غير متاحة في هذا المتصفح.',
      demoTitle: 'ملف الاكتشاف محفوظ',
      demoNote: 'تُحفظ إجاباتك في ملف اكتشافك الخاص داخل Supabase وتبقى متاحة في حسابك.',
      deviceOnly: 'محفوظ في حسابك',
    },
  };

  const log = document.querySelector('#chat-log');
  const turn = document.querySelector('#chat-turn');
  const resultBox = document.querySelector('#discovery-result');
  const progress = document.querySelector('#chat-progress');
  const resetButton = document.querySelector('#restart-discovery');
  const voiceToggle = document.querySelector('#discovery-voice-toggle');
  const voiceLabel = document.querySelector('#discovery-voice-label');
  const voiceReplay = document.querySelector('#discovery-voice-replay');
  const voiceStatus = document.querySelector('#discovery-voice-status');
  const translations = window.IQZodiacTranslations || { arToEn: {} };
  const currentLanguage = () => document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const ui = () => copy[currentLanguage()];
  const fromArabic = (text) => currentLanguage() === 'ar' ? text : (translations.arToEn[text] || text);
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const emptyState = () => ({ questionIndex: 0, answers: [], interests: '', birthDate: '', personalityElement: '', stage: 'questions' });
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
      const element = tally().element || state.personalityElement || null;
      const zodiac = state.birthDate ? zodiacForDate(state.birthDate)?.[0] : null;
      const interests = state.interests.split(/[,،;؛\n]+/).map((item) => item.trim()).filter(Boolean);
      const complete = questions.every((_, index) => Boolean(state.answers[index])) && interests.length > 0 && Boolean(state.birthDate) && Boolean(zodiac) && Boolean(element);
      const { error: profileError } = await client.from('discovery_profiles').upsert({
        user_id: userId, birth_date: state.birthDate || null, zodiac_sign: zodiac,
        personality_element: element, personality_summary: element ? ui().resultSummary[element] : null,
        interests, discoverable: complete,
        discovery_status: complete ? 'completed' : 'in_progress',
        questionnaire_version: questionnaireVersion, completed_at: complete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;
      const answerRows = state.answers.map((answer, index) => answer && ({
        user_id: userId, questionnaire_version: questionnaireVersion, question_id: `q${index + 1}`,
        answer_choice: answer.choice || null, answer_text: answer.text || null, answered_at: new Date().toISOString(),
      })).filter(Boolean);
      if (state.interests) answerRows.push({ user_id: userId, questionnaire_version: questionnaireVersion, question_id: 'interests', answer_choice: null, answer_text: state.interests, answered_at: new Date().toISOString() });
      if (answerRows.length) {
        const { error: answersError } = await client.from('discovery_answers').upsert(answerRows, { onConflict: 'user_id,questionnaire_version,question_id' });
        if (answersError) throw answersError;
      }
      const saveNote = document.querySelector('#discovery-demo-note');
      if (saveNote) saveNote.dataset.saveState = 'saved';
      return true;
    } catch (error) {
      console.warn('Discovery progress could not be synced to Supabase.', error);
      const saveNote = document.querySelector('#discovery-demo-note');
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
      const [{ data: profile, error: profileError }, { data: answers, error: answersError }] = await Promise.all([
        client.from('discovery_profiles').select('birth_date,zodiac_sign,personality_element,discovery_status,discoverable,interests,questionnaire_version').eq('user_id', userId).maybeSingle(),
        client.from('discovery_answers').select('question_id,answer_choice,answer_text').eq('user_id', userId).eq('questionnaire_version', questionnaireVersion).order('answered_at', { ascending: true }).limit(50),
      ]);
      if (profileError) throw profileError;
      if (answersError) throw answersError;
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
      state.personalityElement = profile?.personality_element || '';
      if (firstMissing >= 0) state.stage = 'questions';
      else if (!state.interests.trim()) state.stage = 'interests';
      else if (!state.birthDate) state.stage = 'birthdate';
      else if (!state.personalityElement && !tally().element) state.stage = 'element';
      else { state.personalityElement = state.personalityElement || tally().element; state.stage = 'done'; }
      if (state.stage === 'done' && (profile?.discovery_status !== 'completed' || profile?.discoverable !== true || profile?.questionnaire_version !== questionnaireVersion)) await persistToDatabase();
    } catch (error) {
      console.warn('Discovery progress could not be loaded from Supabase.', error);
    }
  };
  const isNewProfileSetup = () => state.stage === 'questions' && state.questionIndex === 0 && state.answers.length === 0;
  const speechAvailable = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance === 'function';
  let voiceEnabled = speechAvailable;
  let activeUtterance = null;
  const currentPrompt = () => {
    if (state.stage === 'questions') return questionText(state.questionIndex);
    if (state.stage === 'interests') return ui().interestsPrompt;
    if (state.stage === 'birthdate') return ui().birthdayPrompt;
    if (state.stage === 'element') return ui().elementPrompt;
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
    const firstQuestion = isNewProfileSetup();
    const prompt = firstQuestion ? `${ui().welcome} ${ui().greeting} ${currentPrompt()}` : currentPrompt();
    if (!speechAvailable || !voiceEnabled || !prompt) return;
    activeUtterance = null;
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
      if (activeUtterance === utterance) activeUtterance = null;
    };
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
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  }

  const addBubble = (speaker, text, extraClass = '') => {
    if (speaker === 'guide') return;
    const bubble = document.createElement('div');
    bubble.className = `discovery-bubble discovery-bubble-${speaker} ${extraClass}`.trim();
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
  const nextMissingStage = () => {
    const firstMissing = state.answers.findIndex((answer) => !answer);
    if (firstMissing >= 0) { state.questionIndex = firstMissing; return 'questions'; }
    if (!state.interests.trim()) return 'interests';
    if (!state.birthDate) return 'birthdate';
    if (!tally().element && !state.personalityElement) return 'element';
    return 'done';
  };
  const appendQuestionHistory = () => {
    if (state.signupWelcome) addBubble('guide', ui().signupWelcome, 'discovery-bubble-surprise');
    addBubble('guide', ui().welcome);
    for (let i = 0; i < Math.min(state.questionIndex, questions.length); i += 1) {
      addBubble('guide', questionText(i));
      const answer = state.answers[i];
      if (answer) addBubble('member', answer.choice ? answerText(answer.choice) : answer.text);
    }
    if (state.stage !== 'questions' && state.interests) {
      addBubble('guide', ui().interestsPrompt); addBubble('member', state.interests);
    }
    if (state.birthDate) {
      addBubble('guide', ui().birthdayPrompt);
      addBubble('member', new Intl.DateTimeFormat(currentLanguage() === 'ar' ? 'ar' : 'en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${state.birthDate}T00:00:00Z`)));
    }
    if (state.stage === 'done') {
      return;
    }
    if (state.stage === 'birthdate') addBubble('guide', ui().birthdayPrompt);
    else if (state.stage === 'interests') addBubble('guide', ui().interestsPrompt);
    else if (state.stage === 'element') addBubble('guide', ui().elementPrompt);
    else if (state.questionIndex < questions.length) addBubble('guide', questionText(state.questionIndex));
  };
  const renderResult = () => {
    const language = currentLanguage(); const text = ui(); const element = tally().element || state.personalityElement; const zodiac = zodiacForDate(state.birthDate);
    const savedInterests = state.interests.split(/[,،;؛\n]+/).map((item) => item.trim()).filter(Boolean);
    const elementText = element ? `${text.names[element]} — ${text.resultSummary[element]}` : text.noScore;
    resultBox.innerHTML = `<p class="card-kicker">${language === 'ar' ? 'نتيجة اكتشافك' : 'YOUR DISCOVERY RESULT'}</p><h2>${escapeHTML(text.resultTitle)}</h2><p class="discovery-result-note">${escapeHTML(text.resultNote)}</p><div class="discovery-result-grid"><article><small>${escapeHTML(text.element)}</small><strong>${escapeHTML(element ? text.names[element] : (language === 'ar' ? 'غير محدد' : 'Undetermined'))}</strong><p>${escapeHTML(elementText)}</p></article><article><small>${escapeHTML(text.zodiac)}</small><strong>${escapeHTML(zodiac ? zodiac[language === 'ar' ? 1 : 0] : '')}</strong><p>${escapeHTML(state.birthDate)}</p></article><article class="discovery-result-interests"><small>${escapeHTML(text.interests)}</small><strong>${escapeHTML(savedInterests.length ? savedInterests.join(' · ') : text.noInterests)}</strong></article></div><p class="discovery-match-note">${escapeHTML(text.noResults)}</p><a class="button button-secondary" href="./match.html">${escapeHTML(text.matches)} <span class="button-arrow">↗</span></a>`;
    resultBox.hidden = false;
  };
  const renderTurn = () => {
    const text = ui(); const total = questions.length + 3;
    const step = state.stage === 'questions' ? state.questionIndex + 1 : state.stage === 'interests' ? questions.length + 1 : state.stage === 'birthdate' ? questions.length + 2 : questions.length + 3;
    progress.textContent = state.stage === 'done' ? text.completed : text.progress(step, total);
    turn.replaceChildren(); resultBox.hidden = true;
    if (state.stage === 'done') { turn.hidden = true; renderResult(); return; }
    turn.hidden = false;
    if (state.stage === 'questions') {
      const question = questions[state.questionIndex];
      const instruction = document.createElement('p'); instruction.className = 'discovery-turn-instruction'; instruction.textContent = text.choose; turn.append(instruction);
      const options = document.createElement('div'); options.className = 'discovery-choice-list';
      question.a.forEach(([arabic, element]) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'discovery-choice'; button.textContent = answerText(arabic); button.addEventListener('click', () => submitQuestion({ choice: arabic, element })); options.append(button);
      });
      turn.append(options);
      const form = document.createElement('form'); form.className = 'discovery-answer-form';
      form.innerHTML = `<label for="free-answer">${escapeHTML(text.writeLabel)}</label><textarea id="free-answer" rows="2" maxlength="500" placeholder="${escapeHTML(text.writePlaceholder)}"></textarea><button class="button button-primary" type="submit">${escapeHTML(text.send)} <span class="button-arrow">↗</span></button><p class="discovery-validation" aria-live="polite"></p>`;
      form.addEventListener('submit', (event) => { event.preventDefault(); const value = form.querySelector('textarea').value.trim(); if (!value) { form.querySelector('.discovery-validation').textContent = text.required; return; } submitQuestion({ text: value }); });
      turn.append(form);
    } else if (state.stage === 'interests') {
      const form = document.createElement('form'); form.className = 'discovery-answer-form';
      form.innerHTML = `<label for="interest-answer">${escapeHTML(text.interestsLabel)}</label><textarea id="interest-answer" rows="2" maxlength="500" required placeholder="${escapeHTML(text.interestsPlaceholder)}">${escapeHTML(state.interests)}</textarea><button class="button button-primary" type="submit">${escapeHTML(text.send)} <span class="button-arrow">↗</span></button><p class="discovery-validation" aria-live="polite"></p>`;
      form.addEventListener('submit', (event) => { event.preventDefault(); if (advanceTimer !== null) return; const value = form.querySelector('textarea').value.trim(); if (!value) { form.querySelector('.discovery-validation').textContent = text.required; return; } state.interests = value; state.stage = nextMissingStage(); saveState(); advanceToNextStep(); });
      turn.append(form);
    } else if (state.stage === 'element') {
      const instruction = document.createElement('p'); instruction.className = 'discovery-turn-instruction'; instruction.textContent = text.elementPrompt; turn.append(instruction);
      const options = document.createElement('div'); options.className = 'discovery-choice-list';
      Object.entries(text.names).forEach(([element, label]) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'discovery-choice'; button.textContent = label;
        button.addEventListener('click', () => { if (advanceTimer !== null) return; state.personalityElement = element; state.stage = 'done'; saveState(); advanceToNextStep(); });
        options.append(button);
      });
      turn.append(options);
    } else {
      const form = document.createElement('form'); form.className = 'discovery-answer-form discovery-birth-form';
      form.innerHTML = `<label for="birth-date">${escapeHTML(text.birthdayLabel)}</label><input id="birth-date" type="date" required max="${new Date().toISOString().slice(0, 10)}" value="${escapeHTML(state.birthDate)}" /><button class="button button-primary" type="submit">${escapeHTML(text.continue)} <span class="button-arrow">↗</span></button><p class="discovery-validation" aria-live="polite"></p>`;
      form.addEventListener('submit', (event) => { event.preventDefault(); if (advanceTimer !== null) return; const value = form.querySelector('input').value; if (!value || value > new Date().toISOString().slice(0, 10)) { form.querySelector('.discovery-validation').textContent = text.required; return; } state.birthDate = value; state.stage = nextMissingStage(); saveState(); advanceToNextStep(); });
      turn.append(form);
    }
  };
  const advanceToNextStep = () => {
    if (advanceTimer !== null) return;
    turn.inert = true;
    turn.setAttribute('aria-busy', 'true');
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
    document.querySelector('.discovery-chat-foot p').textContent = `${ui().saved}. ${currentLanguage() === 'ar' ? 'يمكنك متابعة إعداد الملف من أي جهاز بعد تسجيل الدخول.' : 'You can continue setting up your profile on another device after signing in.'}`;
    document.querySelector('#restart-discovery').textContent = ui().reset;
    document.querySelector('#discovery-demo-title').textContent = ui().demoTitle;
    const saveNote = document.querySelector('#discovery-demo-note');
    saveNote.textContent = ui().demoNote;
    if (saveNote.dataset.saveState === 'error') saveNote.textContent = currentLanguage() === 'ar' ? 'تعذر حفظ التقدم. تحقق من الاتصال ثم أعد المحاولة.' : 'Progress could not be saved. Check your connection and try again.';
    if (saveNote.dataset.saveState === 'saved') saveNote.textContent = ui().saved;
    document.querySelector('#discovery-device-label').textContent = ui().deviceOnly;
    updateVoiceControls();
    if (voiceEnabled) speakCurrentPrompt();
    log.scrollTop = log.scrollHeight;
  };
  const submitQuestion = (answer) => {
    if (advanceTimer !== null) return;
    state.answers[state.questionIndex] = answer;
    state.questionIndex += 1;
    if (state.questionIndex >= questions.length) state.stage = 'interests';
    saveState(); advanceToNextStep();
  };
  resetButton.addEventListener('click', async () => {
    if (advanceTimer !== null) { window.clearTimeout(advanceTimer); advanceTimer = null; }
    turn.inert = false;
    turn.removeAttribute('aria-busy');
    state = emptyState();
    await hydrateFromDatabase();
    render();
  });
  voiceToggle.addEventListener('click', () => {
    if (advanceTimer !== null) return;
    voiceEnabled = !voiceEnabled;
    updateVoiceControls();
    if (voiceEnabled) speakCurrentPrompt();
    else {
      activeUtterance = null;
      window.speechSynthesis.cancel();
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
  hydrateFromDatabase().then(() => render());
})();
