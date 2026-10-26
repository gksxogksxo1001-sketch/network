/**
 * 네트워크관리사 2급 필기 스마트 학습관 - 애플리케이션 로직 (Firebase 연동)
 *
 * 주요 기능:
 *  - 시험 모드(기본) vs 즉시 채점 모드
 *  - Google 계정 로그인 / 로그아웃 (Firebase Auth)
 *  - Cloud Firestore 자동 동기화 (응시 결과 및 누적 오답 보관함)
 *  - '내 문제풀이' 마이페이지 대시보드 (성적 히스토리 & 누적 오답 복습)
 *  - 오답 복습 완료 토글 기능
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'n2_exam_state_v1';
  const PAGE_SIZE = 5;
  const POINT_PER_Q = 2;     // 50문항 x 2점 = 100점
  const PASS_SCORE = 60;     // 네트워크관리사 2급 필기 합격 기준: 60점 이상
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
  window.userAnswers = userAnswers;

  // History modal state
  let cachedHistoryList = [];

  // Dedicated Standalone Review Viewer State
  let currentReviewRecord = null;
  let reviewOnlyWrong = false;

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
    } catch (e) { /* 시크릿 모드 등 예외 무시 */ }
  }

  // ---------- DOM Elements ----------
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
  const viewModeTextShort = $('viewModeTextShort');
  const toggleAllAnswersBtn = $('toggleAllAnswersBtn');
  const toggleAllBtnText = $('toggleAllBtnText');
  const toggleAllBtnTextShort = $('toggleAllBtnTextShort');
  const quickAnswersBtn = $('quickAnswersBtn');
  const answersModal = $('answersModal');
  const modalCloseBtn = $('modalCloseBtn');
  const modalTableBody = $('modalTableBody');
  const modalExamTitle = $('modalExamTitle');
  const examModeBtn = $('examModeBtn');
  const examModeIcon = $('examModeIcon');
  const examModeText = $('examModeText');
  const examModeTextShort = $('examModeTextShort');
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
  const resultGoHistoryBtn = $('resultGoHistoryBtn');
  const progressCountEl = $('progressCount');
  const correctCountEl = $('correctCount');
  const wrongCountEl = $('wrongCount');
  const scoreValueEl = $('scoreValue');

  // Firebase Auth & History DOM
  const googleLoginBtn = $('googleLoginBtn');
  const userProfileBadge = $('userProfileBadge');
  const userAvatar = $('userAvatar');
  const userName = $('userName');
  const myHistoryBtn = $('myHistoryBtn');
  const logoutBtn = $('logoutBtn');
  const myHistoryModal = $('myHistoryModal');
  const historyCloseBtn = $('historyCloseBtn');
  const historyModalBody = $('historyModalBody');

  // Dedicated Review Viewer DOM
  const dedicatedReviewViewer = $('dedicatedReviewViewer');
  const reviewViewerBackBtn = $('reviewViewerBackBtn');
  const reviewViewerCloseBtn = $('reviewViewerCloseBtn');
  const reviewViewerTitle = $('reviewViewerTitle');
  const reviewViewerMeta = $('reviewViewerMeta');
  const reviewFilterAllBtn = $('reviewFilterAllBtn');
  const reviewFilterWrongBtn = $('reviewFilterWrongBtn');
  const reviewWrongCountBadge = $('reviewWrongCountBadge');
  const reviewViewerNewTabBtn = $('reviewViewerNewTabBtn');
  const reviewViewerBody = $('reviewViewerBody');

  // ---------- Helpers ----------
  const exam = () => window.EXAM_DATA[currentExamIndex];
  const answersOf = code => (userAnswers[code] = userAnswers[code] || {});
  const isSubmitted = () => !!submitted[exam().code];
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

    const inline = str => str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');

    const lines = text.split('\n');
    let html = '';
    let inOptionsList = false;

    lines.forEach(rawLine => {
      const line = rawLine.trim();
      if (!line) return;

      // 1. 선지별 항목 (예: - ① **tracert** ✔️ [정답] ➔ ...)
      const optMatch = line.match(/^[-*]?\s*([①②③④])\s*(.*)$/);
      if (optMatch) {
        if (!inOptionsList) {
          html += '<div class="exp-options-grid">';
          inOptionsList = true;
        }
        const sym = optMatch[1];
        const content = optMatch[2];
        const isAnswer = content.includes('✔️') || content.includes('[정답]');
        const cleanContent = content
          .replace(/✔️\s*\[정답.*?\]\s*➔?\s*/, '')
          .replace(/❌\s*\[오답.*?\]\s*➔?\s*/, '');

        html += `
          <div class="exp-option-item ${isAnswer ? 'is-answer' : 'is-wrong'}">
            <span class="exp-opt-badge ${isAnswer ? 'badge-answer' : 'badge-wrong'}">${sym} ${isAnswer ? '정답' : '오답'}</span>
            <div class="exp-opt-desc">${inline(cleanContent)}</div>
          </div>`;
        return;
      }

      // 선지 리스트가 끝났으면 닫아주기
      if (inOptionsList) {
        html += '</div>';
        inOptionsList = false;
      }

      // 2. 들여쓰기된 서브 항목 (예:   - **개념 정의**: ...)
      const subHeaderMatch = rawLine.match(/^\s+[-*]\s*\*\*(.*?)\*\*:\s*(.*)$/);
      if (subHeaderMatch) {
        const subTitle = subHeaderMatch[1];
        const subText = subHeaderMatch[2];
        html += `<div class="exp-bullet-item sub-point"><span class="sub-point-badge">${subTitle}</span><span class="bullet-text">${inline(subText)}</span></div>`;
        return;
      }

      // 3. 메인 섹션 타이틀 (예: - **핵심 10초 컷 도출 공식...**: )
      const headerMatch = rawLine.match(/^[-*]\s*\*\*(.*?)\*\*:\s*(.*)$/);
      if (headerMatch) {
        const title = headerMatch[1];
        const extra = headerMatch[2];
        let icon = '💡';
        if (title.includes('서브넷') || title.includes('10초 컷') || title.includes('공식')) icon = '⚡';
        else if (title.includes('정답 판정') || title.includes('도출')) icon = '🎯';
        else if (title.includes('선지별') || title.includes('분석')) icon = '📋';
        else if (title.includes('클래스') || title.includes('포트') || title.includes('OSI') || title.includes('IPv6')) icon = '📌';

        html += `
          <div class="exp-section-title">
            <span class="sec-icon">${icon}</span>
            <span class="sec-text">${title}</span>
          </div>`;
        if (extra) {
          html += `<div class="exp-lead-text">${inline(extra)}</div>`;
        }
        return;
      }

      // 4. 서브 불릿 항목
      if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
        const bulletText = line.replace(/^[-*•]\s*/, '');
        html += `<div class="exp-bullet-item"><span class="bullet-dot">•</span><span class="bullet-text">${inline(bulletText)}</span></div>`;
        return;
      }

      // 5. 일반 문단
      html += `<p class="exp-paragraph">${inline(line)}</p>`;
    });

    if (inOptionsList) {
      html += '</div>';
    }

    return html;
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
      renderApp();
    });

    prevPageBtn.addEventListener('click', () => goToPage(currentPage - 1));
    nextPageBtn.addEventListener('click', () => goToPage(currentPage + 1));
    prevPageBtnBottom.addEventListener('click', () => goToPage(currentPage - 1));
    nextPageBtnBottom.addEventListener('click', () => goToPage(currentPage + 1));

    viewModeToggleBtn.addEventListener('click', () => {
      isPagingMode = !isPagingMode;
      viewModeText.textContent = isPagingMode ? '한눈에 보기' : '페이지 분할 모드';
      if (viewModeTextShort) viewModeTextShort.textContent = isPagingMode ? '한눈에' : '넘김';
      renderQuestions();
    });

    toggleAllAnswersBtn.addEventListener('click', () => {
      if (!isRevealed()) return;
      allExplanationsOpen = !allExplanationsOpen;
      toggleAllBtnText.textContent = allExplanationsOpen ? '해설 전체 닫기' : '해설 전체 열기';
      if (toggleAllBtnTextShort) toggleAllBtnTextShort.textContent = allExplanationsOpen ? '닫기' : '해설';
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

    // 제출 / 결과 핸들러
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
    if (resultGoHistoryBtn) {
      resultGoHistoryBtn.addEventListener('click', () => {
        closeResultModal();
        openMyHistoryModal();
      });
    }

    // Firebase Auth Events
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener('click', () => {
        window.FirebaseManager.loginWithGoogle();
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm("로그아웃 하시겠습니까?")) {
          window.FirebaseManager.logout();
        }
      });
    }
    if (myHistoryBtn) {
      myHistoryBtn.addEventListener('click', openMyHistoryModal);
    }
    if (historyCloseBtn) {
      historyCloseBtn.addEventListener('click', () => myHistoryModal.classList.remove('active'));
    }
    if (myHistoryModal) {
      myHistoryModal.addEventListener('click', e => {
        if (e.target === myHistoryModal) myHistoryModal.classList.remove('active');
      });
    }

    // Dedicated Review Viewer Events
    if (reviewViewerBackBtn) {
      reviewViewerBackBtn.addEventListener('click', closeStandaloneReviewViewer);
    }
    if (reviewViewerCloseBtn) {
      reviewViewerCloseBtn.addEventListener('click', closeStandaloneReviewViewer);
    }
    if (reviewFilterAllBtn) {
      reviewFilterAllBtn.addEventListener('click', () => {
        reviewOnlyWrong = false;
        reviewFilterAllBtn.classList.add('active');
        reviewFilterWrongBtn.classList.remove('active');
        renderReviewQuestions();
      });
    }
    if (reviewFilterWrongBtn) {
      reviewFilterWrongBtn.addEventListener('click', () => {
        reviewOnlyWrong = true;
        reviewFilterWrongBtn.classList.add('active');
        reviewFilterAllBtn.classList.remove('active');
        renderReviewQuestions();
      });
    }
    if (reviewViewerNewTabBtn) {
      reviewViewerNewTabBtn.addEventListener('click', openReviewInNewWindow);
    }

    // Auth State Listener
    if (window.FirebaseManager) {
      window.FirebaseManager.onAuthChange(user => {
        updateAuthUI(user);
      });
    }

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (dedicatedReviewViewer && dedicatedReviewViewer.classList.contains('active')) {
          closeStandaloneReviewViewer();
          return;
        }
        answersModal.classList.remove('active');
        myHistoryModal.classList.remove('active');
        closeResultModal();
        return;
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (resultModal.classList.contains('active') || answersModal.classList.contains('active') || myHistoryModal.classList.contains('active') || (dedicatedReviewViewer && dedicatedReviewViewer.classList.contains('active'))) return;
      if (e.key === 'ArrowRight') goToPage(currentPage + 1);
      else if (e.key === 'ArrowLeft') goToPage(currentPage - 1);
    });

    renderApp();
  }

  function updateAuthUI(user) {
    if (user) {
      googleLoginBtn.style.display = 'none';
      userProfileBadge.style.display = 'flex';
      userName.textContent = user.displayName || '수험생';
      if (user.photoURL) {
        userAvatar.src = user.photoURL;
        userAvatar.style.display = 'block';
      } else {
        userAvatar.style.display = 'none';
      }
    } else {
      googleLoginBtn.style.display = 'inline-flex';
      userProfileBadge.style.display = 'none';
    }
  }

  function setSubjectFilter(subject) {
    currentSubjectFilter = subject || 'all';
  }

  function getFilteredQuestions(ex) {
    return ex.questions;
  }

  function goToPage(page) {
    const totalPages = Math.ceil(getFilteredQuestions(exam()).length / PAGE_SIZE) || 1;
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      renderQuestions();
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  }

  // ---------- Render App ----------
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
    if (examModeTextShort) examModeTextShort.textContent = isExamMode ? '시험' : '즉시';
    examModeBtn.title = isExamMode
      ? '시험 모드: 50문항을 모두 푼 뒤 결과 확인으로 한 번에 채점 (클릭 시 즉시 채점 모드로 전환)'
      : '즉시 채점 모드: 보기를 고르면 바로 정답 공개 (클릭 시 시험 모드로 전환)';

    toggleAllAnswersBtn.disabled = !revealed;
    quickAnswersBtn.disabled = !revealed;
    toggleAllAnswersBtn.title = revealed ? '' : '시험 모드에서는 결과 확인 후 해설을 볼 수 있습니다.';
    quickAnswersBtn.title = revealed ? '' : '시험 모드에서는 결과 확인 후 정답표를 볼 수 있습니다.';
    if (!revealed) {
      allExplanationsOpen = false;
      toggleAllBtnText.textContent = '해설 전체 열기';
      if (toggleAllBtnTextShort) toggleAllBtnTextShort.textContent = '해설';
    }

    if (wrongOnlyTab) {
      wrongOnlyTab.style.display = revealed && computeResult(exam()).answeredCount > 0 ? '' : 'none';
      if (wrongOnlyTab.style.display === 'none' && currentSubjectFilter === 'wrong') setSubjectFilter('all');
    }

    if (isExamMode && !done) {
      examModeHint.className = 'exam-mode-hint';
      examModeHint.innerHTML = '📝 <span><b>시험 모드</b> · 보기를 골라도 정답이 바로 공개되지 않습니다. 문제를 푼 뒤 <b>성적 확인 및 저장</b>을 누르세요.</span>';
    } else if (done) {
      const r = computeResult(exam());
      examModeHint.className = 'exam-mode-hint done';
      examModeHint.innerHTML = `✅ <span><b>채점 완료</b> · 총점 <b>${r.score}점</b> (${r.passed ? '🎉 합격선!' : '불합격'}, 정답 ${r.correct} / 오답 ${r.wrong} / 미응답 ${r.unanswered}) — 내 문제풀이에 보관되었습니다.</span>`;
    } else {
      examModeHint.className = 'exam-mode-hint';
      examModeHint.innerHTML = '⚡ <span><b>즉시 채점 모드</b> · 보기를 고르면 바로 정답과 해설이 표시됩니다. 풀이를 마치면 아래 <b>성적 확인 및 저장</b>을 눌러주세요.</span>';
    }

    // Both modes have access to submit panel & floating submit button
    submitPanel.style.display = 'flex';
    floatingSubmitBtn.classList.toggle('hidden', computeResult(exam()).answeredCount === 0 && !done);
    updateSubmitUI();
  }

  function updateSubmitUI() {
    const r = computeResult(exam());
    const done = isSubmitted();
    const pct = Math.round((r.answeredCount / r.total) * 100);
    submitProgressFill.style.width = pct + '%';
    floatingSubmitCount.textContent = done ? `${r.score}점` : `${r.answeredCount}/${r.total}`;
    floatingSubmitBtn.firstElementChild.textContent = done ? '📊 채점 결과 확인' : (r.answeredCount === r.total ? '✅ 성적 확인 및 저장' : '✅ 성적 확인');
    floatingSubmitBtn.classList.toggle('ready', !done && r.answeredCount === r.total);
    floatingSubmitBtn.classList.toggle('hidden', r.answeredCount === 0 && !done);
    submitExamBtn.textContent = done ? '📊 채점 결과 다시 보기' : (r.answeredCount === r.total ? '✅ 성적 확인 & 내 문제풀이에 저장' : '✅ 성적 확인 및 저장');

    if (done) {
      submitPanelTitle.textContent = `채점 완료 · ${r.score}점 ${r.passed ? '(합격 🎉)' : '(불합격 😢)'}`;
      submitPanelDesc.textContent = `정답 ${r.correct}개 · 오답 ${r.wrong}개 · 미응답 ${r.unanswered}개 (내 문제풀이에 안전하게 보관됨)`;
    } else if (r.answeredCount === r.total) {
      submitPanelTitle.textContent = '🎉 50문항 모두 풀이 완료!';
      submitPanelDesc.textContent = '성적 확인 및 저장을 누르면 점수가 산출되고 내 문제풀이에 영구 보관됩니다.';
    } else {
      submitPanelTitle.textContent = `답안 입력 중 · ${r.answeredCount} / ${r.total}문항 완료 (${pct}%)`;
      submitPanelDesc.textContent = `남은 문항 ${r.unanswered}개 · 언제든 성적 확인을 눌러 채점하고 내 문제풀이에 저장할 수 있습니다.`;
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
            <span class="ans-label">🎯 정답</span>
            <span class="ans-val">${q.answer} ${q.options[q.answerNum - 1] || ''}</span>
          </div>
          <div class="exp-content">${formatMarkdown(q.explanation)}</div>
        </div>
      </div>`;
  }

  // ---------- Interaction ----------
  function selectOption(q, optNum) {
    const ex = exam();
    if (isExamMode && isSubmitted()) return;

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

  async function handleSubmitClick() {
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

    // Cloud Firestore Sync if logged in
    if (window.FirebaseManager && window.FirebaseManager.currentUser) {
      try {
        await window.FirebaseManager.saveExamResult(exam(), r);
        refreshWrongNotesCount();
      } catch (err) {
        console.warn("클라우드 저장 실패 (오프라인 모드 유지):", err);
      }
    }
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

  // ---------- My History Modal ----------
  async function openMyHistoryModal() {
    if (!window.FirebaseManager || !window.FirebaseManager.currentUser) {
      const goLogin = confirm("구글 로그인 후 '내 문제풀이' 기능을 이용할 수 있습니다.\n지금 구글 계정으로 로그인하시겠습니까?");
      if (goLogin && window.FirebaseManager) {
        window.FirebaseManager.loginWithGoogle();
      }
      return;
    }
    myHistoryModal.classList.add('active');
    historyModalBody.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted); font-size:14px;">☁️ 클라우드에서 학습 기록을 불러오는 중...</div>';

    try {
      cachedHistoryList = await window.FirebaseManager.fetchHistory();
      renderMyHistoryModal();
    } catch (err) {
      historyModalBody.innerHTML = '<div style="padding:40px; text-align:center; color:#ef4444; font-size:14px;">기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
    }
  }

  function renderMyHistoryModal() {
    if (!cachedHistoryList || cachedHistoryList.length === 0) {
      historyModalBody.innerHTML = `
        <div style="padding:60px 20px; text-align:center; color:var(--text-muted);">
          <div style="font-size:48px; margin-bottom:12px;">📝</div>
          <p style="font-size:16px; font-weight:800; color:#1e293b;">아직 응시한 시험 기록이 없습니다.</p>
          <p style="font-size:13.5px; margin-top:6px; color:#64748b;">시험을 풀고 '성적 확인 & 내 문제풀이에 저장'을 누르면 이곳에 성적과 답안이 자동으로 보관됩니다.</p>
        </div>`;
      return;
    }

    // 통계 계산
    const totalExams = cachedHistoryList.length;
    const avgScore = Math.round(cachedHistoryList.reduce((acc, h) => acc + (h.score || 0), 0) / totalExams);
    const passedCount = cachedHistoryList.filter(h => h.passed).length;
    const passRate = Math.round((passedCount / totalExams) * 100);
    const maxScore = Math.max(...cachedHistoryList.map(h => h.score || 0));

    let html = `
      <div class="history-stats-grid">
        <div class="history-stat-card">
          <div class="val">${totalExams}회</div>
          <div class="lbl">총 응시 횟수</div>
        </div>
        <div class="history-stat-card">
          <div class="val">${avgScore}점</div>
          <div class="lbl">평균 점수</div>
        </div>
        <div class="history-stat-card">
          <div class="val">${maxScore}점</div>
          <div class="lbl">최고 점수</div>
        </div>
        <div class="history-stat-card">
          <div class="val" style="color:${passRate >= 60 ? '#10b981' : '#ef4444'};">${passedCount}회 (${passRate}%)</div>
          <div class="lbl">합격 횟수 / 합격률</div>
        </div>
      </div>

      <div class="result-section-title" style="margin-top:0; font-size:14px; font-weight:800; color:#1e293b; margin-bottom:12px;">
        📅 내가 푼 회차별 시험 기록 (${totalExams}건)
        <span style="font-size:12px; font-weight:500; color:var(--text-muted); margin-left:6px;">(회차 카드를 클릭하면 당시 풀었던 화면 그대로 복원됩니다)</span>
      </div>
      <div class="history-list">`;

    cachedHistoryList.forEach(item => {
      const dateStr = item.updatedAt && item.updatedAt.toDate
        ? item.updatedAt.toDate().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '최근';

      html += `
        <div class="history-card" data-restore-exam="${item.examCode}" title="클릭하면 ${item.examDate} 풀이 화면으로 바로 이동합니다">
          <div class="history-card-left">
            <div class="history-card-title">
              <span>📌</span>
              <span>${item.examDate} 필기 기출문제 (${item.examCode})</span>
            </div>
            <div class="history-card-meta">
              <span>🕒 ${dateStr}</span>
              <span>·</span>
              <span>정답 <b style="color:#16a34a;">${item.correctCount}</b></span>
              <span>오답 <b style="color:#dc2626;">${item.wrongCount}</b></span>
              <span>미응답 ${item.unansweredCount}</span>
            </div>
          </div>
          <div class="history-card-right">
            <div class="history-score-box">
              <span class="history-score-num ${item.passed ? 'passed' : 'failed'}">${item.score}점</span>
              <span class="history-status-pill ${item.passed ? 'pass' : 'fail'}">${item.passed ? '합격' : '불합격'}</span>
            </div>
            <div class="history-card-arrow">
              <span>풀이 복원</span>
              <span>➔</span>
            </div>
          </div>
        </div>`;
    });

    html += `</div>`;
    historyModalBody.innerHTML = html;

    // Attach card click event to open dedicated review viewer (does not overwrite main test state)
    historyModalBody.querySelectorAll('[data-restore-exam]').forEach(card => {
      card.addEventListener('click', () => {
        const code = card.getAttribute('data-restore-exam');
        const targetRecord = cachedHistoryList.find(h => h.examCode === code);
        if (targetRecord) {
          openStandaloneReviewViewer(targetRecord);
        }
      });
    });
  }

  // ---------- Dedicated Standalone Review Viewer ----------
  function openStandaloneReviewViewer(record) {
    if (!record) return;
    currentReviewRecord = record;
    reviewOnlyWrong = false;

    const targetExam = window.EXAM_DATA.find(e => e.code === record.examCode) || window.EXAM_DATA[0];
    const wrongCount = record.wrongCount !== undefined ? record.wrongCount : (50 - (record.correctCount || 0));

    reviewViewerTitle.textContent = `📅 ${record.examDate} 풀이 결과`;
    reviewViewerMeta.textContent = `총점 ${record.score}점 (${record.passed ? '🎉 합격' : '😢 불합격'}) · 정답 ${record.correctCount} / 오답 ${record.wrongCount} / 미응답 ${record.unansweredCount}`;
    if (reviewWrongCountBadge) reviewWrongCountBadge.textContent = String(wrongCount);

    if (reviewFilterAllBtn) reviewFilterAllBtn.classList.add('active');
    if (reviewFilterWrongBtn) reviewFilterWrongBtn.classList.remove('active');

    renderReviewQuestions();

    myHistoryModal.classList.remove('active');
    dedicatedReviewViewer.classList.add('active');
    dedicatedReviewViewer.scrollTop = 0;
  }

  function closeStandaloneReviewViewer() {
    dedicatedReviewViewer.classList.remove('active');
    // Return smoothly to history modal
    myHistoryModal.classList.add('active');
  }

  function renderReviewQuestions() {
    if (!currentReviewRecord) return;
    const targetExam = window.EXAM_DATA.find(e => e.code === currentReviewRecord.examCode) || window.EXAM_DATA[0];
    const userAns = currentReviewRecord.answers || {};

    let list = targetExam.questions || [];
    if (reviewOnlyWrong) {
      list = list.filter(q => userAns[q.num] !== q.answerNum);
    }

    if (list.length === 0) {
      reviewViewerBody.innerHTML = `
        <div style="padding:60px 20px; text-align:center; color:var(--text-muted); background:#fff; border-radius:12px; border:1px solid var(--border-card);">
          <div style="font-size:42px; margin-bottom:10px;">🎉</div>
          <p style="font-size:16px; font-weight:800; color:#10b981;">틀린 문제가 없습니다!</p>
          <p style="font-size:13.5px; color:#64748b; margin-top:4px;">해당 회차는 모든 문제를 맞추셨습니다.</p>
        </div>`;
      return;
    }

    let html = '';
    list.forEach(q => {
      const chosen = userAns[q.num];
      const isAnswered = chosen !== undefined;
      const isCorrect = isAnswered && chosen === q.answerNum;
      const statusCls = !isAnswered ? 'is-unanswered' : (isCorrect ? 'is-correct' : 'is-wrong');
      const statusBadge = !isAnswered
        ? '<span class="q-status-badge unanswered">⚪ 미응답</span>'
        : (isCorrect ? '<span class="q-status-badge correct">✔️ 정답 (+2점)</span>' : '<span class="q-status-badge wrong">❌ 오답</span>');

      const myChoiceText = isAnswered ? `${SYMBOLS[chosen - 1]} ${q.options[chosen - 1] || ''}` : '<span style="color:#94a3b8;">미응답</span>';
      const realAnswerText = `${q.answer} ${q.options[q.answerNum - 1] || ''}`;

      html += `
        <div class="review-card ${statusCls}">
          <div class="review-card-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="q-number-badge">${pad2(q.num)}</span>
              <span class="q-subject-badge">${q.subject}</span>
              ${statusBadge}
            </div>
            <div style="font-size:12px; color:var(--text-muted); font-weight:600;">배점: 2점</div>
          </div>

          <div class="review-card-stem">${q.question}</div>

          ${q.image ? `<div class="q-image-box"><img src="${q.image}" alt="Q${q.num} 지문 이미지" loading="lazy"></div>` : ''}

          <div style="margin-bottom:12px;">
            ${q.options.map((optText, i) => {
              const optNum = i + 1;
              let optCls = 'review-option-item';
              let optTag = '';
              if (optNum === q.answerNum) {
                optCls += ' answer-target';
                optTag = '<span style="margin-left:auto; font-size:11px; font-weight:800; color:#166534; background:#dcfce7; padding:2px 6px; border-radius:4px;">🎯 정답</span>';
              }
              if (isAnswered && optNum === chosen) {
                if (isCorrect) {
                  optCls += ' choice-correct';
                } else {
                  optCls += ' choice-wrong';
                  optTag = '<span style="margin-left:auto; font-size:11px; font-weight:800; color:#991b1b; background:#fee2e2; padding:2px 6px; border-radius:4px;">내 선택 ❌</span>';
                }
              }
              return `
                <div class="${optCls}">
                  <span style="font-weight:800; font-size:14px; color:var(--primary);">${SYMBOLS[i]}</span>
                  <span>${optText}</span>
                  ${optTag}
                </div>`;
            }).join('')}
          </div>

          <div class="review-diff-bar">
            <div>내 답: <b style="color:${isCorrect ? '#166534' : '#dc2626'};">${myChoiceText}</b></div>
            <div>실제 정답: <b style="color:#166534;">${realAnswerText}</b></div>
          </div>

          <div class="explanation-box" style="margin-top:12px;">
            <div class="ans-highlight">
              <span>🎯 정답:</span>
              <span>${realAnswerText}</span>
            </div>
            <div class="exp-content">${formatMarkdown(q.explanation)}</div>
          </div>
        </div>`;
    });

    reviewViewerBody.innerHTML = html;
  }

  function openReviewInNewWindow() {
    if (!currentReviewRecord) return;
    const targetExam = window.EXAM_DATA.find(e => e.code === currentReviewRecord.examCode) || window.EXAM_DATA[0];
    const userAns = currentReviewRecord.answers || {};

    const win = window.open('', '_blank');
    if (!win) {
      alert("브라우저 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
      return;
    }

    let cardsHtml = '';
    (targetExam.questions || []).forEach(q => {
      const chosen = userAns[q.num];
      const isAnswered = chosen !== undefined;
      const isCorrect = isAnswered && chosen === q.answerNum;
      const badgeText = !isAnswered ? '⚪ 미응답' : (isCorrect ? '✔️ 정답 (+2점)' : '❌ 오답');
      const badgeBg = !isAnswered ? '#f1f5f9' : (isCorrect ? '#dcfce7' : '#fee2e2');
      const badgeColor = !isAnswered ? '#475569' : (isCorrect ? '#166534' : '#991b1b');
      const myChoiceText = isAnswered ? `${SYMBOLS[chosen - 1]} ${q.options[chosen - 1] || ''}` : '미응답';

      cardsHtml += `
        <div style="background:#fff; border:1px solid #e2e8f0; border-left:5px solid ${isCorrect ? '#10b981' : (isAnswered ? '#ef4444' : '#94a3b8')}; border-radius:12px; padding:20px; margin-bottom:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="display:flex; gap:8px; align-items:center;">
              <span style="font-weight:900; background:#2563eb; color:#fff; padding:2px 8px; border-radius:4px; font-size:12px;">${pad2(q.num)}번</span>
              <span style="background:#eff6ff; color:#1e40af; font-size:12px; font-weight:700; padding:2px 8px; border-radius:4px;">${q.subject}</span>
              <span style="background:${badgeBg}; color:${badgeColor}; font-size:12px; font-weight:800; padding:2px 8px; border-radius:4px;">${badgeText}</span>
            </div>
            <span style="font-size:12px; color:#64748b; font-weight:600;">배점 2점</span>
          </div>
          <div style="font-size:16px; font-weight:700; color:#0f172a; line-height:1.6; margin-bottom:14px;">${q.question}</div>
          ${q.image ? `<div style="text-align:center; margin-bottom:12px;"><img src="${q.image}" style="max-width:100%; border-radius:8px;"></div>` : ''}
          <div style="margin-bottom:12px;">
            ${q.options.map((opt, i) => {
              const optNum = i + 1;
              const isTarget = optNum === q.answerNum;
              const isMy = isAnswered && optNum === chosen;
              let bg = '#fafafa';
              let border = '#f1f5f9';
              let extra = '';
              if (isTarget) {
                bg = '#ecfdf5';
                border = '#86efac';
                extra = '<span style="margin-left:auto; font-size:11px; font-weight:800; color:#166534; background:#dcfce7; padding:2px 6px; border-radius:4px;">🎯 정답</span>';
              }
              if (isMy && !isCorrect) {
                bg = '#fef2f2';
                border = '#fca5a5';
                extra = '<span style="margin-left:auto; font-size:11px; font-weight:800; color:#991b1b; background:#fee2e2; padding:2px 6px; border-radius:4px;">내 선택 ❌</span>';
              }
              return `<div style="display:flex; align-items:flex-start; gap:10px; padding:10px 14px; border-radius:8px; border:1px solid ${border}; background:${bg}; margin-bottom:6px; font-size:14px; line-height:1.4;"><span style="font-weight:800; color:#2563eb;">${SYMBOLS[i]}</span><span>${opt}</span>${extra}</div>`;
            }).join('')}
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; font-size:13px; margin-bottom:12px;">
            <div>내 답: <b style="color:${isCorrect ? '#166534' : '#dc2626'};">${myChoiceText}</b></div>
            <div>실제 정답: <b style="color:#166534;">${q.answer} ${q.options[q.answerNum - 1] || ''}</b></div>
          </div>
          <div style="background:#eff6ff; border-left:4px solid #2563eb; padding:14px 16px; border-radius:8px;">
            <div style="font-weight:800; color:#1e40af; margin-bottom:6px;">💡 정답 및 초심자 맞춤 해설</div>
            <div style="font-size:13.5px; color:#334155; line-height:1.65; white-space:pre-wrap;">${formatMarkdown(q.explanation).replace(/<[^>]+>/g, '')}</div>
          </div>
        </div>`;
    });

    win.document.write(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${currentReviewRecord.examDate} 풀이 결과 (새 창)</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
        <style>
          body { font-family: Pretendard, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
          .container { max-width: 860px; margin: 0 auto; }
          .header { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.04); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
          .score-pill { font-size: 26px; font-weight: 900; color: ${currentReviewRecord.passed ? '#10b981' : '#ef4444'}; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <h2 style="margin:0; font-size:20px;">📅 ${currentReviewRecord.examDate} 필기 기출문제 풀이 결과</h2>
              <div style="color:#64748b; font-size:13px; margin-top:4px;">정답 ${currentReviewRecord.correctCount} / 오답 ${currentReviewRecord.wrongCount} / 미응답 ${currentReviewRecord.unansweredCount}</div>
            </div>
            <div>
              <div class="score-pill">${currentReviewRecord.score}점 (${currentReviewRecord.passed ? '합격' : '불합격'})</div>
            </div>
          </div>
          ${cardsHtml}
        </div>
      </body>
      </html>
    `);
    win.document.close();
  }

  // ---------- Quick Answers Modal ----------
  function openQuickAnswersModal() {
    const ex = exam();
    modalExamTitle.textContent = `📌 ${ex.date} 빠른 정답표 (1번 ~ 50번)`;
    let html = '<div class="quick-answers-grid">';
    for (let i = 1; i <= 50; i++) {
      const q = ex.questions.find(item => item.num === i);
      const ansText = q ? q.answer : '-';
      html += `
        <div class="quick-answer-card">
          <span class="q-num">${i}번</span>
          <span class="q-ans">${ansText}</span>
        </div>`;
    }
    html += '</div>';
    modalTableBody.innerHTML = html;
    answersModal.classList.add('active');
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
