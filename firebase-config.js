/**
 * Firebase 초기화 및 Cloud Firestore / Authentication 헬퍼 모듈
 */
const firebaseConfig = {
  apiKey: "AIzaSyC8sFWxH3RikLLWy8_vk2Km-PzR068T20o",
  authDomain: "network-f12cb.firebaseapp.com",
  projectId: "network-f12cb",
  storageBucket: "network-f12cb.firebasestorage.app",
  messagingSenderId: "472962778902",
  appId: "1:472962778902:web:7ca4f67c4af29b176f3237",
  measurementId: "G-RCHGHR99M0"
};

// Initialize Firebase using compat SDK
let auth = null;
let db = null;
let googleProvider = null;

try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    googleProvider = new firebase.auth.GoogleAuthProvider();
  }
} catch (e) {
  console.warn("Firebase 초기화 오류:", e);
}

// Global Firebase Manager
window.FirebaseManager = {
  get currentUser() {
    return auth ? auth.currentUser : null;
  },

  // 구글 로그인
  loginWithGoogle() {
    if (!auth || !googleProvider) {
      alert("Firebase 라이브러리가 로드되지 않았습니다.");
      return Promise.reject("Firebase not initialized");
    }
    return auth.signInWithPopup(googleProvider).catch(err => {
      console.error("로그인 실패:", err);
      if (err.code === 'auth/popup-blocked') {
        alert("팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도해주세요.");
      } else if (err.code !== 'auth/popup-closed-by-user') {
        alert(`로그인 오류: ${err.message}`);
      }
      throw err;
    });
  },

  // 로그아웃
  logout() {
    if (!auth) return Promise.resolve();
    return auth.signOut();
  },

  // 인증 상태 감시자 등록
  onAuthChange(callback) {
    if (!auth) return;
    auth.onAuthStateChanged(callback);
  },

  // 시험 결과 클라우드 저장
  async saveExamResult(examData, resultData) {
    if (!auth || !auth.currentUser || !db) return null;
    const uid = auth.currentUser.uid;
    const examCode = examData.code;

    const record = {
      examCode,
      examDate: examData.date,
      examTitle: examData.title,
      score: resultData.score,
      maxScore: resultData.maxScore,
      passed: resultData.passed,
      correctCount: resultData.correct,
      wrongCount: resultData.wrong,
      unansweredCount: resultData.unanswered,
      totalQuestions: resultData.total,
      answers: (window.userAnswers && window.userAnswers[examCode]) ? window.userAnswers[examCode] : {},
      bySubject: resultData.bySubject,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await db.collection('users').doc(uid).collection('exam_results').doc(examCode).set(record, { merge: true });
      console.log(`[Firebase] ${examCode} 시험 결과 클라우드 저장 완료`);
      return record;
    } catch (err) {
      console.error("클라우드 저장 실패:", err);
      throw err;
    }
  },

  // 사용자의 모든 응시 기록 불러오기
  async fetchHistory() {
    if (!auth || !auth.currentUser || !db) return [];
    const uid = auth.currentUser.uid;
    try {
      const snap = await db.collection('users').doc(uid).collection('exam_results')
        .orderBy('updatedAt', 'desc')
        .get();
      return snap.docs.map(doc => doc.data());
    } catch (err) {
      console.error("응시 기록 조회 실패:", err);
      return [];
    }
  },

  // 사용자의 누적 오답 노트 불러오기
  async fetchWrongNotes() {
    if (!auth || !auth.currentUser || !db) return [];
    const uid = auth.currentUser.uid;
    try {
      const snap = await db.collection('users').doc(uid).collection('wrong_notes')
        .orderBy('updatedAt', 'desc')
        .get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.error("오답 노트 조회 실패:", err);
      return [];
    }
  },

  // 오답 복습 완료(해결) 상태 토글
  async toggleWrongNoteResolved(noteId, resolved) {
    if (!auth || !auth.currentUser || !db) return;
    const uid = auth.currentUser.uid;
    try {
      await db.collection('users').doc(uid).collection('wrong_notes').doc(noteId).update({
        resolved: resolved,
        resolvedAt: resolved ? firebase.firestore.FieldValue.serverTimestamp() : null
      });
    } catch (err) {
      console.error("오답 상태 갱신 실패:", err);
    }
  },

  // 특정 회차 응시 기록 삭제
  async deleteExamResult(examCode) {
    if (!auth || !auth.currentUser || !db) return false;
    const uid = auth.currentUser.uid;
    try {
      await db.collection('users').doc(uid).collection('exam_results').doc(examCode).delete();
      console.log(`[Firebase] ${examCode} 시험 기록 삭제 완료`);
      return true;
    } catch (err) {
      console.error("시험 기록 삭제 실패:", err);
      throw err;
    }
  },

  // 모든 응시 기록 전체 삭제
  async clearAllHistory() {
    if (!auth || !auth.currentUser || !db) return false;
    const uid = auth.currentUser.uid;
    try {
      const snap = await db.collection('users').doc(uid).collection('exam_results').get();
      const batch = db.batch();
      snap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`[Firebase] 모든 시험 기록 삭제 완료`);
      return true;
    } catch (err) {
      console.error("전체 시험 기록 삭제 실패:", err);
      throw err;
    }
  }
};
