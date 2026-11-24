const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz2WpP9-9tBcesmSuJ3GqvtPp2lHDAoXgsTCY9z1zwmGO4qXpAbKW83mdI1XjPolYgp/exec';

const STATIC_QUESTIONS = [
  {
    question_id: 'Q1',
    question_type: 'single_choice',
    text: 'How often do you usually consume hot chocolate?',
    options: [
      { option_id: 'o1', label: 'Once a week or more' },
      { option_id: 'o2', label: 'Two or three times a month' },
      { option_id: 'o3', label: 'About once a month' },
      { option_id: 'o4', label: 'Once every two or three months' },
      { option_id: 'o5', label: 'Less often than once every three months' },
    ],
  },
  {
    question_id: 'Q2',
    question_type: 'single_choice',
    text: 'Which weather makes you crave a warm mug most?',
    options: [
      { option_id: 's1', label: 'Monsoon' },
      { option_id: 's2', label: 'Winter' },
      { option_id: 's3', label: 'Spring' },
      { option_id: 's4', label: 'Summer' },
    ],
  },
  {
    question_id: 'Q3',
    question_type: 'single_choice',
    text: 'Where did you have hot chocolate on your most recent occasion?',
    options: [
      { option_id: 'm1', label: 'At home' },
      { option_id: 'm2', label: 'At a café or coffee shop' },
      { option_id: 'm3', label: 'At a restaurant or dessert outlet' },
      { option_id: 'm4', label: 'At work / college / school' },
      { option_id: 'm5', label: 'While travelling or sightseeing' },
      { option_id: 'm6', label: 'As takeaway while on the move' },
    ],
  },
  {
    question_id: 'Q4',
    question_type: 'single_choice',
    text: 'How sweet do you generally prefer hot chocolate?',
    options: [
      { option_id: 'sw1', label: 'Not sweet or barely sweet' },
      { option_id: 'sw2', label: 'Slightly sweet' },
      { option_id: 'sw3', label: 'Moderately sweet' },
      { option_id: 'sw4', label: 'Quite sweet' },
    ],
  },
  {
    question_id: 'Q5',
    question_type: 'multiple_choice',
    text: 'Which factors matter most when choosing hot chocolate? (Select up to 3)',
    options: [
      { option_id: 'f1', label: 'Taste' },
      { option_id: 'f2', label: 'Chocolate and ingredient quality' },
      { option_id: 'f3', label: 'Price / value for money' },
      { option_id: 'f4', label: 'Lower sugar / healthier' },
      { option_id: 'f5', label: 'Flavour variety' },
      { option_id: 'f6', label: 'Availability / convenience' },
      { option_id: 'f7', label: 'Ability to customise' },
    ],
  },
];

const STORAGE_KEY = 'melti-static-survey-responses';

function loadStore() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStore(data) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function resolveAnswerLabel(questionId, optionId, answerValue) {
  const question = STATIC_QUESTIONS.find((q) => q.question_id === questionId);
  if (!question) return optionId ?? answerValue ?? '';

  if (Array.isArray(answerValue)) {
    return answerValue.map(
      (id) => question.options.find((o) => o.option_id === id)?.label || id,
    );
  }
  const idToFind = optionId ?? answerValue;
  return question.options.find((o) => o.option_id === idToFind)?.label || idToFind || '';
}

export const apiResearchService = {
  async startSession() {
    const sessionId = `static-${Date.now()}`;
    const store = loadStore();
    store[sessionId] = { answers: {}, extras: {}, profile: {} };
    saveStore(store);

    return {
      sessionId,
      researchId: 'melti-static-5',
      totalQuestions: STATIC_QUESTIONS.length,
      maxQuestions: STATIC_QUESTIONS.length,
      surveyTitle: 'MÈLTI Taste Quest',
    };
  },

  async getNextQuestion({ sessionId }) {
    const store = loadStore();
    const sessionData = store[sessionId] || { answers: {}, extras: {}, profile: {} };
    const answeredIds = Object.keys(sessionData.answers || {});
    const nextQuestion =
      STATIC_QUESTIONS.find((q) => !answeredIds.includes(q.question_id)) || null;

    // All 5 questions finished -> send to Google Sheet + trigger Brevo event once
    if (!nextQuestion && !sessionData.synced && APPS_SCRIPT_URL) {
      sessionData.synced = true;
      store[sessionId] = sessionData;
      saveStore(store);

      const urlEmail = new URLSearchParams(window.location.search).get('email') || '';
      const finalEmail = (sessionData.profile?.email || urlEmail).trim();

      try {
        const res = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            email: finalEmail,
            profile: sessionData.profile,
            answers: sessionData.answers,
            extras: sessionData.extras,
          }),
        });
        const result = await res.json().catch(() => null);
        console.log('Google Sheet & Brevo sync:', result);
      } catch (err) {
        console.error('Sync failed:', err);
      }
    }

    return {
      status: nextQuestion ? 'in_progress' : 'completed',
      next_question: nextQuestion,
    };
  },

  async submitRespondentProfile({ sessionId, name, age, gender, email }) {
    const store = loadStore();
    store[sessionId] = {
      ...(store[sessionId] || { answers: {}, extras: {} }),
      profile: { name, age, gender, email },
    };
    saveStore(store);
    return { ok: true };
  },

  async submitResponse({ sessionId, questionId, optionId, answerValue }) {
    const store = loadStore();
    if (!store[sessionId]) store[sessionId] = { answers: {}, extras: {} };
    store[sessionId].answers[questionId] = resolveAnswerLabel(
      questionId,
      optionId,
      answerValue,
    );
    saveStore(store);
    return { ok: true };
  },

  async submitFeatureChallenge({ sessionId, feature }) {
    const store = loadStore();
    if (!store[sessionId]) store[sessionId] = { answers: {}, extras: {} };
    store[sessionId].extras.featureChallenge = feature;
    saveStore(store);
    return { ok: true };
  },

  async submitSweetnessDial({ sessionId, level }) {
    const store = loadStore();
    if (!store[sessionId]) store[sessionId] = { answers: {}, extras: {} };
    store[sessionId].extras.sweetnessDial = level;
    saveStore(store);
    return { ok: true };
  },

  async submitUsageOccasion({ sessionId, location, response }) {
    const store = loadStore();
    if (!store[sessionId]) store[sessionId] = { answers: {}, extras: {} };
    store[sessionId].extras.usageOccasion = {
      ...(store[sessionId].extras.usageOccasion || {}),
      [location]: response,
    };
    saveStore(store);
    return { ok: true };
  },
};