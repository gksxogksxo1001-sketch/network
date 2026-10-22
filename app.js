/**
 * 네트워크관리사 2급 필기 스마트 학습관 - 애플리케이션 로직
 *
 * 모드
 *  - 시험 모드(기본): 보기를 골라도 정답이 바로 공개되지 않음. '결과 확인'을 누르면 일괄 채점.
 *  - 즉시 채점 모드: 보기를 고르는 즉시 정답/해설 공개 (기존 동작).
 *
 * 상태는 localStorage에 저장되어 새로고침해도 유지된다.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'n2_exam_state_v1';
  const PAGE_SIZE = 5;
  const POINT_PER_Q = 2;     // 50문항 x 2점 = 100점
  const PASS_SCORE = 60;     // 네트워크관리사 2급 필기 합격 기준: 100점 만점 60점 이상
  const SYMBOLS = ['①', '②', '③', '④'];
  const SUBJECTS = [
    { key: '1과목', label: '1과목 TCP/IP' },
    { key: '2과목', label: '2과목 네트워크 일반' },
    { key: '3과목', label: '3과목 NOS' },
    { key: '4과목', label: '4과목 운용기기' }
  ];

  // ---------- State ----------
  let currentExamIndex = 0;
  let currentSubjectFilter = 'all';
  let currentPage = 1;
  let isPagingMode = true;
  let allExplanationsOpen = false;

  const saved = loadState();
  let isExamMode = saved.isExamMode !== false;               // 기본: 시험 모드
  const userAnswers = saved.userAnswers || {};               // { examCode: { qNum: optNum } }
  const submitted = saved.submitted || {};                   // { examCode: true }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ isExamMode, userAnswers, submitted }));
    } catch (e) { /* 저장 실패는 무시 (시크릿 모드 등) */ }
  }

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const examSelect = $('examSelect');
  const examDateBadge = $('currentDateText');
  const brandSubtitle = $('brandSubtitle');
  const questionsContainer = $('questionsContainer');
  const topPaginationBar = $('topPaginationBar');
  const bottomPaginationBar = $('bottomPaginationBar');
  const pageIndicator = $('pageIndicator');
  const pageIndicatorBottom = $('pageIndicatorBottom');
  const pageDotsContainer = $('pageDotsContainer');
  const prevPageBtn = $('prevPageBtn');
  const nextPageBtn = $('nextPageBtn');
  const prevPageBtnBottom = $('prevPageBtnBottom');
  const nextPageBtnBottom = $('nextPageBtnBottom');
  const viewModeToggleBtn = $('viewModeToggleBtn');
  const viewModeText = $('viewModeText');
  const toggleAllAnswersBtn = $('toggleAllAnswersBtn');
  const toggleAllBtnText = $('toggleAllBtnText');
  const quickAnswersBtn = $('quickAnswersBtn');
  const answersModal = $('answersModal');
  const modalCloseBtn = $('modalCloseBtn');
  const modalTableBody = $('modalTableBody');
  const modalExamTitle = $('modalExamTitle');
  const examModeBtn = $('examModeBtn');
  const examModeIcon = $('examModeIcon');
  const examModeText = $('examModeText');
  const examModeHint = $('examModeHint');
  const wrongOnlyTab = $('wrongOnlyTab');
  const submitPanel = $('submitPanel');
  const submitPanelTitle = $('submitPanelTitle');
  const submitPanelDesc = $('submitPanelDesc');
  const submitProgressFill = $('submitProgressFill');
  const submitExamBtn = $('submitExamBtn');
  const resetExamBtn = $('resetExamBtn');
  const floatingSubmitBtn = $('floatingSubmitBtn');
  const floatingSubmitCount = $('floatingSubmitCount');
  const resultModal = $('resultModal');
  const resultTitle = $('resultTitle');
  const resultBody = $('resultBody');
  const resultCloseBtn = $('resultCloseBtn');
  const resultRetryBtn = $('resultRetryBtn');
  const resultWrongOnlyBtn = $('resultWrongOnlyBtn');
  const resultReviewBtn = $('resultReviewBtn');
  const progressCountEl = $('progressCount');
  const correctCountEl = $('correctCount');
  const wrongCountEl = $('wrongCount');
  const scoreValueEl = $('scoreValue');

  // ---------- Helpers ----------
  const exam = () => window.EXAM_DATA[currentExamIndex];
  const answersOf = code => (userAnswers[code] = userAnswers[code] || {});
  const isSubmitted = () => !!submitted[exam().code];
  // 정답 공개 여부: 즉시 채점 모드이거나, 시험 모드에서 제출 완료한 경우
  const isRevealed = () => !isExamMode || isSubmitted();
  const pad2 = n => (n < 10 ? '0' + n : '' + n);

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')
      .replace(/<br>- /g, '<br>• ');
  }

  function computeResult(ex) {
    const answered = answersOf(ex.code);
    const res = { correct: 0, wrong: 0, unanswered: 0, answeredCount: 0, items: [], bySubject: {} };
    SUBJECTS.forEach(s => (res.bySubject[s.key] = { total: 0, correct: 0 }));
    ex.questions.forEach(q => {
      const choice = answered[q.num];
      let status = 'na';
      if (choice !== undefined) {
        res.answeredCount++;
        status = choice === q.answerNum ? 'ok' : 'ng';
      }
      if (status === 'ok') res.correct++;
      else if (status === 'ng') res.wrong++;
      else res.unanswered++;
      const subjKey = (q.subject || '').split(':')[0];
      if (res.bySubject[subjKey]) {
        res.bySubject[subjKey].total++;
        if (status === 'ok') res.bySubject[subjKey].correct++;
      }
      res.items.push({ q, choice, status });
    });
    res.total = ex.questions.length;
    res.score = res.correct * POINT_PER_Q;
    res.maxScore = res.total * POINT_PER_Q;
    res.passed = res.score >= PASS_SCORE;
    return res;
  }

  // ---------- Init ----------
  function initApp() {
    if (!window.EXAM_DATA || window.EXAM_DATA.length === 0) {
      questionsContainer.innerHTML = '<div style="padding:40px; text-align:center;">기출문제 데이터를 불러오지 못했습니다.</div>';
      return;
    }

    const list = window.EXAM_DATA;
    const fmt = d => d.replace(/(\d{4})년\s*(\d{2})월.*/, '$1.$2');
    brandSubtitle.textContent =
      `최신 ${list.length}회차(${fmt(list[0].date)} ~ ${fmt(list[list.length - 1].date)}) 기출문제 · 시험 모드 채점 · 원터치 정답/해설`;

    examSelect.innerHTML = '';
    list.forEach((ex, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${ex.date} (${ex.code})${submitted[ex.code] ? ' ✔' : ''}`;
      examSelect.appendChild(opt);
    });
    currentExamIndex = list.length - 1;   // 최신 회차 기본
    examSelect.value = currentExamIndex;

    examSelect.addEventListener('change', e => {
      currentExamIndex = parseInt(e.target.value, 10);
      currentPage = 1;
      setSubjectFilter('all');
      renderApp();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setSubjectFilter(btn.getAttribute('data-subject'));
        currentPage = 1;
        renderQuestions();
      });
    });

    prevPageBtn.addEventListener('click', () => goToPage(currentPage - 1));
    nextPageBtn.addEventListener('click', () => goToPage(currentPage + 1));
    prevPageBtnBottom.addEventListener('click', () => goToPage(currentPage - 1));
    nextPageBtnBottom.addEventListener('click', () => goToPage(currentPage + 1));

    viewModeToggleBtn.addEventListener('click', () => {
      isPagingMode = !isPagingMode;
      viewModeText.textContent = isPagingMode ? '한눈에 보기' : '페이지 분할 모드';
      renderQuestions();
    });

    toggleAllAnswersBtn.addEventListener('click', () => {
      if (!isRevealed()) return;
      allExplanationsOpen = !allExplanationsOpen;
      toggleAllBtnText.textContent = allExplanationsOpen ? '해설 전체 닫기' : '해설 전체 열기';
      document.querySelectorAll('.explanation-wrapper').forEach(w => {
        w.classList.toggle('open', allExplanationsOpen);
        w.previousElementSibling.classList.toggle('open', allExplanationsOpen);
      });
    });

    examModeBtn.addEventListener('click', () => {
      isExamMode = !isExamMode;
      saveState();
      renderApp();
    });

    quickAnswersBtn.addEventListener('click', () => {
      if (!isRevealed()) return;
      openQuickAnswersModal();
    });
    modalCloseBtn.addEventListener('click', () => answersModal.classList.remove('active'));
    answersModal.addEventListener('click', e => {
      if (e.target === answersModal) answersModal.classList.remove('active');
    });

    // 제출 / 결과
    submitExamBtn.addEventListener('click', handleSubmitClick);
    floatingSubmitBtn.addEventListener('click', handleSubmitClick);
    resetExamBtn.addEventListener('click', resetExam);
    resultCloseBtn.addEventListener('click', closeResultModal);
    resultModal.addEventListener('click', e => {
      if (e.target === resultModal) closeResultModal();
    });
    resultRetryBtn.addEventListener('click', () => {
      closeResultModal();
      resetExam();
    });
    resultWrongOnlyBtn.addEventListener('click', () => {
      closeResultModal();
      setSubjectFilter('wrong');
      currentPage = 1;
      renderQuestions();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    resultReviewBtn.addEventListener('click', () => {
      closeResultModal();
      setSubjectFilter('all');
      currentPage = 1;
      renderQuestions();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        answersModal.classList.remove('active');
        closeResultModal();
        return;
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (resultModal.classList.contains('active') || answersModal.classList.contains('active')) return;
      if (e.key === 'ArrowRight') goToPage(currentPage + 1);
      else if (e.key === 'ArrowLeft') goToPage(currentPage - 1);
    });

    renderApp();
  }

  function setSubjectFilter(subject) {
    currentSubjectFilter = subject;
    document.querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-subject') === subject));
  }

  function getFilteredQuestions(ex) {
    if (currentSubjectFilter === 'all') return ex.questions;
    if (currentSubjectFilter === 'wrong') {
      const ans = answersOf(ex.code);
      return ex.questions.filter(q => ans[q.num] !== q.answerNum);  // 오답 + 미응답
    }
    const key = currentSubjectFilter.split(':')[0];
    return ex.questions.filter(q => q.subject.includes(key));
  }

  function goToPage(page) {
    const totalPages = Math.ceil(getFilteredQuestions(exam()).length / PAGE_SIZE) || 1;
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      renderQuestions();
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  }

  // ---------- Render ----------
  function renderApp() {
    examDateBadge.textContent = `${exam().date} 필기 기출문제`;
    renderModeUI();
    renderQuestions();
    updateScoreBar();
  }

  function renderModeUI() {
    const revealed = isRevealed();
    const done = isSubmitted();

    examModeBtn.className = `btn ${isExamMode ? 'mode-exam' : 'mode-instant'}`;
    examModeIcon.textContent = isExamMode ? '📝' : '⚡';
    examModeText.textContent = isExamMode ? '시험 모드' : '즉시 채점 모드';
    examModeBtn.title = isExamMode
      ? '시험 모드: 50문항을 모두 푼 뒤 결과 확인으로 한 번에 채점 (클릭 시 즉시 채점 모드로 전환)'
      : '즉시 채점 모드: 보기를 고르면 바로 정답 공개 (클릭 시 시험 모드로 전환)';

    // 시험 진행 중에는 정답 노출 기능 잠금
    toggleAllAnswersBtn.disabled = !revealed;
    quickAnswersBtn.disabled = !revealed;
    toggleAllAnswersBtn.title = revealed ? '' : '시험 모드에서는 결과 확인 후 해설을 볼 수 있습니다.';
    quickAnswersBtn.title = revealed ? '' : '시험 모드에서는 결과 확인 후 정답표를 볼 수 있습니다.';
    if (!revealed) {
      allExplanationsOpen = false;
      toggleAllBtnText.textContent = '해설 전체 열기';
    }

    wrongOnlyTab.style.display = revealed && computeResult(exam()).answeredCount > 0 ? '' : 'none';
    if (wrongOnlyTab.style.display === 'none' && currentSubjectFilter === 'wrong') setSubjectFilter('all');

    if (isExamMode && !done) {
      examModeHint.className = 'exam-mode-hint';
      examModeHint.innerHTML = '📝 <span><b>시험 모드</b> · 보기를 골라도 정답이 바로 공개되지 않습니다. 50문항을 모두 푼 뒤 <b>결과 확인</b>을 누르세요. (선택은 언제든 변경 가능)</span>';
    } else if (isExamMode && done) {
      const r = computeResult(exam());
      examModeHint.className = 'exam-mode-hint done';
      examModeHint.innerHTML = `✅ <span><b>채점 완료</b> · ${r.score}점 (정답 ${r.correct} / 오답 ${r.wrong} / 미응답 ${r.unanswered}) — 답안이 잠겼습니다. 다시 풀려면 <b>다시 풀기</b>를 누르세요.</span>`;
    } else {
      examModeHint.className = 'exam-mode-hint';
      examModeHint.innerHTML = '⚡ <span><b>즉시 채점 모드</b> · 보기를 고르면 바로 정답과 해설이 표시됩니다.</span>';
    }

    floatingSubmitBtn.classList.toggle('hidden', !isExamMode);
    submitPanel.style.display = isExamMode ? 'flex' : 'none';
    updateSubmitUI();
  }

  function updateSubmitUI() {
    const r = computeResult(exam());
    const done = isSubmitted();
    const pct = Math.round((r.answeredCount / r.total) * 100);
    submitProgressFill.style.width = pct + '%';
    floatingSubmitCount.textContent = done ? `${r.score}점` : `${r.answeredCount}/${r.total}`;
    floatingSubmitBtn.firstElementChild.textContent = done ? '📊 결과 다시 보기' : '✅ 결과 확인';
    floatingSubmitBtn.classList.toggle('ready', !done && r.answeredCount === r.total);
    submitExamBtn.textContent = done ? '📊 결과 다시 보기' : '✅ 결과 확인';

    if (done) {
      submitPanelTitle.textContent = `채점 완료 · ${r.score}점 ${r.passed ? '(합격)' : '(불합격)'}`;
      submitPanelDesc.textContent = `정답 ${r.correct}개 · 오답 ${r.wrong}개 · 미응답 ${r.unanswered}개`;
    } else if (r.answeredCount === r.total) {
      submitPanelTitle.textContent = '🎯 50문항 모두 입력 완료!';
      submitPanelDesc.textContent = '결과 확인을 눌러 점수와 오답을 확인하세요.';
    } else {
      submitPanelTitle.textContent = `답안 입력 중 · ${r.answeredCount} / ${r.total}`;
      submitPanelDesc.textContent = `남은 문항 ${r.unanswered}개 · 모두 풀고 결과 확인을 누르면 점수와 오답을 알려드립니다.`;
    }
  }

  function renderQuestions() {
    const ex = exam();
    const answers = answersOf(ex.code);
    const revealed = isRevealed();
    const locked = isExamMode && isSubmitted();

    const filtered = getFilteredQuestions(ex);
    const totalQuestions = filtered.length;
    const totalPages = Math.ceil(totalQuestions / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    if (!isPagingMode || totalPages <= 1) {
      topPaginationBar.style.display = 'none';
      bottomPaginationBar.style.display = 'none';
    } else {
      topPaginationBar.style.display = 'flex';
      bottomPaginationBar.style.display = 'flex';
      pageIndicator.textContent = `${currentPage} / ${totalPages} 페이지 (총 ${totalQuestions}문항)`;
      pageIndicatorBottom.textContent = `${currentPage} / ${totalPages} 페이지`;
      prevPageBtn.disabled = prevPageBtnBottom.disabled = currentPage <= 1;
      nextPageBtn.disabled = nextPageBtnBottom.disabled = currentPage >= totalPages;

      pageDotsContainer.innerHTML = '';
      for (let p = 1; p <= totalPages; p++) {
        const dot = document.createElement('button');
        dot.className = `page-dot-btn ${p === currentPage ? 'active' : ''}`;
        dot.textContent = p;
        dot.addEventListener('click', () => goToPage(p));
        pageDotsContainer.appendChild(dot);
      }
    }

    let displayQuestions = filtered;
    if (isPagingMode) {
      const start = (currentPage - 1) * PAGE_SIZE;
      displayQuestions = filtered.slice(start, start + PAGE_SIZE);
    }

    questionsContainer.innerHTML = '';
    if (displayQuestions.length === 0) {
      questionsContainer.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">🎉 해당하는 문항이 없습니다.</div>';
      return;
    }

    displayQuestions.forEach(q => {
      const qCard = document.createElement('div');
      qCard.className = `question-card${locked ? ' locked' : ''}`;
      qCard.id = `qCard_${q.num}`;
      qCard.innerHTML = buildCardHtml(q, answers[q.num], revealed);

      qCard.querySelectorAll('.option-item').forEach(el => {
        el.addEventListener('click', () => selectOption(q, parseInt(el.getAttribute('data-opt'), 10)));
      });

      const toggleBtn = qCard.querySelector(`#toggleBtn_${q.num}`);
      const expWrapper = qCard.querySelector(`#expWrapper_${q.num}`);
      toggleBtn.addEventListener('click', () => {
        const open = !expWrapper.classList.contains('open');
        expWrapper.classList.toggle('open', open);
        toggleBtn.classList.toggle('open', open);
      });

      questionsContainer.appendChild(qCard);
    });
  }

  function statusBadge(chosen, answerNum, revealed) {
    const isAnswered = chosen !== undefined;
    if (!revealed) return { cls: '', text: '' };
    if (!isAnswered) return isSubmitted() ? { cls: 'unanswered', text: '⚪ 미응답' } : { cls: '', text: '' };
    return chosen === answerNum ? { cls: 'correct', text: '✔️ 정답' } : { cls: 'wrong', text: '❌ 오답' };
  }

  function optionClass(optNum, chosen, answerNum, revealed) {
    let cls = 'option-item';
    const isAnswered = chosen !== undefined;
    if (revealed) {
      // 제출 후에는 미응답 문항도 정답을 표시
      if ((isAnswered || isSubmitted()) && optNum === answerNum) cls += ' is-correct';
      else if (isAnswered && optNum === chosen) cls += ' is-wrong';
    } else if (optNum === chosen) {
      cls += ' selected';
    }
    return cls;
  }

  function buildCardHtml(q, chosen, revealed) {
    const isAnswered = chosen !== undefined;
    const badge = statusBadge(chosen, q.answerNum, revealed);
    const expOpen = revealed && (allExplanationsOpen || isAnswered);
    return `
      <div class="question-header">
        <div class="q-badge-row">
          <span class="q-number-badge">${pad2(q.num)}</span>
          <span class="q-subject-badge">${q.subject}</span>
          <span class="q-status-badge ${badge.cls}" id="status_${q.num}">${badge.text}</span>
        </div>
        <div style="font-size:12px; color:var(--text-muted); font-weight:600;">배점: ${POINT_PER_Q}점</div>
      </div>

      <div class="q-stem">${q.question}</div>

      ${q.image ? `
        <div class="q-image-box">
          <img src="${q.image}" alt="Q${q.num} 지문 이미지" loading="lazy">
        </div>` : ''}

      <div class="options-grid" id="optionsGrid_${q.num}">
        ${q.options.map((optText, i) => `
          <div class="${optionClass(i + 1, chosen, q.answerNum, revealed)}" data-q="${q.num}" data-opt="${i + 1}">
            <span class="option-symbol">${SYMBOLS[i]}</span>
            <span class="option-text">${optText}</span>
          </div>`).join('')}
      </div>

      <button class="accordion-toggle-btn ${expOpen ? 'open' : ''}" id="toggleBtn_${q.num}" style="${revealed ? '' : 'display:none;'}">
        <span>💡 정답 및 초심자 맞춤 해설</span>
        <span class="arrow-icon">▼</span>
      </button>

      <div class="explanation-wrapper ${expOpen ? 'open' : ''}" id="expWrapper_${q.num}" style="${revealed ? '' : 'display:none;'}">
        <div class="explanation-box">
          <div class="ans-highlight">
            <span>🎯 정답:</span>
            <span>${q.answer} ${q.options[q.answerNum - 1] || ''}</span>
          </div>
          <div class="exp-content">${formatMarkdown(q.explanation)}</div>
        </div>
      </div>`;
  }

  // ---------- Interaction ----------
  function selectOption(q, optNum) {
    const ex = exam();
    if (isExamMode && isSubmitted()) return;   // 제출 후 답안 잠금

    const answers = answersOf(ex.code);
    answers[q.num] = optNum;
    saveState();

    const card = $(`qCard_${q.num}`);
    if (card) {
      const revealed = isRevealed();
      card.querySelectorAll('.option-item').forEach(el => {
        el.className = optionClass(parseInt(el.getAttribute('data-opt'), 10), optNum, q.answerNum, revealed);
      });
      const badge = statusBadge(optNum, q.answerNum, revealed);
      const badgeEl = card.querySelector(`#status_${q.num}`);
      badgeEl.className = `q-status-badge ${badge.cls}`;
      badgeEl.textContent = badge.text;

      if (revealed) {
        card.querySelector(`#expWrapper_${q.num}`).classList.add('open');
        card.querySelector(`#toggleBtn_${q.num}`).classList.add('open');
      }
    }

    if (!isExamMode) {
      wrongOnlyTab.style.display = '';
    }
    updateScoreBar();
    updateSubmitUI();
  }

  function updateScoreBar() {
    const r = computeResult(exam());
    progressCountEl.textContent = `${r.answeredCount}/${r.total}`;
    if (isRevealed()) {
      correctCountEl.textContent = `${r.correct}`;
      wrongCountEl.textContent = `${r.wrong}`;
      scoreValueEl.textContent = `${r.score}점 ${r.passed ? '🎉 합격선!' : ''}`;
    } else {
      correctCountEl.textContent = '-';
      wrongCountEl.textContent = '-';
      scoreValueEl.textContent = '채점 전';
    }
  }

  function handleSubmitClick() {
    if (isSubmitted()) {
      openResultModal();
      return;
    }
    const r = computeResult(exam());
    if (r.answeredCount === 0) {
      alert('아직 선택한 답이 없습니다. 문제를 먼저 풀어주세요.');
      return;
    }
    if (r.unanswered > 0) {
      const missing = r.items.filter(i => i.status === 'na').map(i => i.q.num);
      const preview = missing.slice(0, 15).join(', ') + (missing.length > 15 ? ' …' : '');
      const ok = confirm(`아직 풀지 않은 문항이 ${r.unanswered}개 있습니다.\n(${preview}번)\n\n미응답 문항은 오답으로 처리됩니다. 그래도 채점할까요?`);
      if (!ok) {
        jumpToQuestion(missing[0]);
        return;
      }
    }
    submitted[exam().code] = true;
    saveState();
    refreshExamSelectLabel();
    renderApp();
    openResultModal();
  }

  function resetExam() {
    const ex = exam();
    const hasAny = Object.keys(answersOf(ex.code)).length > 0;
    if (hasAny && !confirm(`${ex.date} 회차의 답안을 모두 지우고 처음부터 다시 풀까요?`)) return;
    userAnswers[ex.code] = {};
    delete submitted[ex.code];
    saveState();
    refreshExamSelectLabel();
    setSubjectFilter('all');
    currentPage = 1;
    renderApp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function refreshExamSelectLabel() {
    const opt = examSelect.options[currentExamIndex];
    const ex = exam();
    if (opt) opt.textContent = `${ex.date} (${ex.code})${submitted[ex.code] ? ' ✔' : ''}`;
  }

  function jumpToQuestion(num) {
    setSubjectFilter('all');
    const idx = exam().questions.findIndex(q => q.num === num);
    currentPage = Math.floor(Math.max(idx, 0) / PAGE_SIZE) + 1;
    renderQuestions();
    requestAnimationFrame(() => {
      const card = $(`qCard_${num}`);
      if (!card) return;
      const top = card.getBoundingClientRect().top + window.scrollY - 170;
      window.scrollTo({ top, behavior: 'smooth' });
      card.classList.remove('flash');
      void card.offsetWidth;
      card.classList.add('flash');
    });
  }

  // ---------- Result Modal ----------
  function openResultModal() {
    const ex = exam();
    const r = computeResult(ex);
    const pct = Math.round((r.score / r.maxScore) * 100);
    const ringColor = r.passed ? '#10b981' : '#ef4444';
    resultTitle.textContent = `📊 ${ex.date} 채점 결과`;

    const subjectRows = SUBJECTS.map(s => {
      const b = r.bySubject[s.key];
      if (!b || b.total === 0) return '';
      const p = Math.round((b.correct / b.total) * 100);
      return `
        <div class="subject-bar-row">
          <span class="label">${s.label}</span>
          <span class="track"><span class="fill" style="display:block; width:${p}%"></span></span>
          <span class="val">${b.correct}/${b.total} (${p}%)</span>
        </div>`;
    }).join('');

    const cells = r.items.map(({ q, choice, status }) => {
      const sub = status === 'na' ? '미응답' : SYMBOLS[choice - 1];
      const title = status === 'ok' ? '정답' : status === 'ng' ? `오답 · 내 답 ${SYMBOLS[choice - 1]} / 정답 ${q.answer}` : `미응답 · 정답 ${q.answer}`;
      return `<button class="result-cell ${status}" data-jump="${q.num}" title="${q.num}번 ${title}">${q.num}<small>${sub}</small></button>`;
    }).join('');

    const wrongItems = r.items.filter(i => i.status !== 'ok');
    const wrongList = wrongItems.length === 0
      ? '<div style="padding:14px; text-align:center; color:#15803d; font-weight:700;">🎉 만점입니다! 틀린 문제가 없습니다.</div>'
      : wrongItems.map(({ q, choice, status }) => `
          <div class="wrong-item" data-jump="${q.num}" title="클릭하면 해당 문항으로 이동합니다">
            <span class="num">${pad2(q.num)}번</span>
            <span class="stem">${escapeHtml(q.question.replace(/\s+/g, ' '))}</span>
            <span class="ans">
              내 답 <span class="mine">${status === 'na' ? '미응답' : SYMBOLS[choice - 1]}</span>
              → 정답 <span class="right">${q.answer}</span>
            </span>
          </div>`).join('');

    resultBody.innerHTML = `
      <div class="result-hero">
        <div class="score-ring" style="--pct:${pct}; --ring-color:${ringColor};">
          <div class="score-ring-inner"><b>${r.score}</b><span>/ ${r.maxScore}점</span></div>
        </div>
        <div class="result-summary">
          <span class="pass-badge ${r.passed ? 'pass' : 'fail'}">${r.passed ? '🎉 합격' : '😢 불합격'} (합격 기준 ${PASS_SCORE}점)</span>
          <h4>${r.total}문항 중 ${r.correct}문항 정답 · 정답률 ${Math.round((r.correct / r.total) * 100)}%</h4>
          <div class="result-stats">
            <div class="result-stat ok"><b>${r.correct}</b><span>맞은 문제</span></div>
            <div class="result-stat ng"><b>${r.wrong}</b><span>틀린 문제</span></div>
            <div class="result-stat na"><b>${r.unanswered}</b><span>미응답</span></div>
          </div>
        </div>
      </div>

      <div class="result-section-title">📚 과목별 정답률</div>
      <div class="subject-bars">${subjectRows}</div>

      <div class="result-section-title">🧾 문항별 채점표 <span style="font-weight:500; color:var(--text-muted); font-size:11.5px;">(번호를 누르면 해당 문제로 이동)</span></div>
      <div class="result-grid">${cells}</div>
      <div class="result-legend">
        <span><i style="background:#dcfce7"></i>정답</span>
        <span><i style="background:#fee2e2"></i>오답</span>
        <span><i style="background:#f1f5f9"></i>미응답</span>
      </div>

      <div class="result-section-title">❌ 틀린 문제 (${wrongItems.length}개)</div>
      <div class="wrong-list">${wrongList}</div>`;

    resultBody.querySelectorAll('[data-jump]').forEach(el => {
      el.addEventListener('click', () => {
        closeResultModal();
        jumpToQuestion(parseInt(el.getAttribute('data-jump'), 10));
      });
    });

    resultWrongOnlyBtn.style.display = wrongItems.length ? '' : 'none';
    resultModal.classList.add('active');
    resultBody.scrollTop = 0;
  }

  function closeResultModal() {
    resultModal.classList.remove('active');
  }

  // ---------- Quick Answers ----------
  function openQuickAnswersModal() {
    const ex = exam();
    modalExamTitle.textContent = `📌 ${ex.date} 빠른 정답표 (1번 ~ 50번)`;
    let html = '<table class="answer-table"><thead><tr>';
    for (let i = 0; i < 5; i++) html += '<th>번호</th><th>정답</th>';
    html += '</tr></thead><tbody>';
    for (let row = 0; row < 10; row++) {
      html += '<tr>';
      for (let col = 0; col < 5; col++) {
        const qNum = col * 10 + row + 1;
        const q = ex.questions.find(item => item.num === qNum);
        html += `<td><strong>${qNum}</strong></td><td>${q ? q.answer : '-'}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    modalTableBody.innerHTML = html;
    answersModal.classList.add('active');
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
