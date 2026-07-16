// ===== SIDEBAR TOGGLE =====
const SIDEBAR_MOBILE_BREAKPOINT = 1024;

function isMobileSidebar() {
    return window.innerWidth <= SIDEBAR_MOBILE_BREAKPOINT;
}

function getSavedSidebarState() {
    try {
        return localStorage.getItem('sidebar-collapsed') === 'true';
    } catch (error) {
        return false;
    }
}

function saveSidebarState(isCollapsed) {
    try {
        localStorage.setItem('sidebar-collapsed', String(isCollapsed));
    } catch (error) {
        // The sidebar still works when storage is unavailable (for example file:// privacy restrictions).
    }
}

function updateSidebarA11y(isOpen, isCollapsed) {
    const desktopToggle = document.querySelector('.sidebar-toggle');
    const mobileToggle = document.querySelector('.mobile-menu-toggle');

    if (desktopToggle) {
        desktopToggle.setAttribute('aria-expanded', String(isMobileSidebar() ? isOpen : !isCollapsed));
        desktopToggle.setAttribute('aria-label', isMobileSidebar() ? 'Đóng thanh điều hướng' : (isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'));
    }
    if (mobileToggle) {
        mobileToggle.setAttribute('aria-expanded', String(isOpen));
        mobileToggle.setAttribute('aria-label', isOpen ? 'Đóng thanh điều hướng' : 'Mở thanh điều hướng');
    }
}

function setMobileSidebar(isOpen) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const mainContent = document.querySelector('.main-content');
    if (!sidebar || !overlay) return;

    sidebar.classList.toggle('open', isOpen);
    sidebar.classList.remove('collapsed');
    if (mainContent) mainContent.classList.remove('expanded');
    overlay.classList.toggle('show', isOpen);
    overlay.setAttribute('aria-hidden', String(!isOpen));
    document.body.classList.toggle('sidebar-open', isOpen);
    updateSidebarA11y(isOpen, false);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    if (!sidebar) return;

    if (isMobileSidebar()) {
        setMobileSidebar(!sidebar.classList.contains('open'));
        return;
    }

    const isCollapsed = sidebar.classList.toggle('collapsed');
    if (mainContent) mainContent.classList.toggle('expanded', isCollapsed);
    saveSidebarState(isCollapsed);
    updateSidebarA11y(false, isCollapsed);
}

function closeSidebar() {
    if (isMobileSidebar()) setMobileSidebar(false);
}

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    if (!sidebar) return;

    if (isMobileSidebar()) {
        setMobileSidebar(false);
    } else {
        const isCollapsed = getSavedSidebarState();
        sidebar.classList.toggle('collapsed', isCollapsed);
        if (mainContent) mainContent.classList.toggle('expanded', isCollapsed);
        updateSidebarA11y(false, isCollapsed);
    }
}

let sidebarWasMobile = isMobileSidebar();
window.addEventListener('resize', function() {
    const isMobile = isMobileSidebar();
    if (isMobile !== sidebarWasMobile) {
        sidebarWasMobile = isMobile;
        initSidebar();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeSidebar();
});

document.addEventListener('click', function(e) {
    if (!isMobileSidebar()) return;
    const navLink = e.target.closest('.sidebar a:not(.has-submenu)');
    if (navLink) closeSidebar();
});

initSidebar();

// ===== CHAPTER SUBMENU TOGGLE =====
function toggleChapterMenu(event) {
    if (event.target.classList.contains('submenu-item')) {
        return;
    }
    event.preventDefault();
    const navGroup = document.querySelector('.nav-group');
    navGroup.classList.toggle('open');
}

// ===== ANSWER TOGGLE (Questions Page - legacy) =====
function toggleAnswer(element) {
    const answerContent = element.nextElementSibling;
    const toggleIcon = element.querySelector('.toggle-icon');

    if (answerContent.classList.contains('show')) {
        answerContent.classList.remove('show');
        toggleIcon.textContent = '+';
    } else {
        answerContent.classList.add('show');
        toggleIcon.textContent = '−';
    }
}

// ===== QUESTIONS BANK - Parse docs/quiz_75cau_dapan.txt =====

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Parse file txt thành mảng câu hỏi
// Format:
//   Câu hỏi N
//   <dòng câu hỏi có thể nhiều dòng>
//   A. ...
//   B. ...
//   C. ...
//   D. ...
//   👉 Đáp án đúng: X
function parseQuizTxt(raw) {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const questions = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        const m = /^Câu hỏi\s+(\d+)/i.exec(line);
        if (!m) { i++; continue; }

        const qNum = parseInt(m[1], 10);
        i++;

        // Gom text câu hỏi cho tới khi gặp dòng bắt đầu bằng "A./B./C./D."
        // mà CÂU HỎI trước đó đã có text rồi.
        // (Trường hợp đặc biệt: câu hỏi có thể bắt đầu bằng "C. Mác..." thì
        // regex A./B./C./D. cũng match nhầm — ta bỏ qua regex ở dòng đầu tiên
        // và cứ lấy làm text câu hỏi.)
        const qTextLines = [];
        let isFirstTextLine = true;
        while (i < lines.length) {
            const cur = lines[i].trim();
            const looksLikeOption = /^[ABCD]\.\s/.test(cur);
            if (looksLikeOption && !isFirstTextLine) break;
            if (cur.startsWith('👉')) break;
            if (cur === '') {
                if (qTextLines.length === 0) { i++; continue; }
                break;
            }
            qTextLines.push(lines[i]);
            i++;
            isFirstTextLine = false;
        }
        const qText = qTextLines.join('\n').trim();

        // Đọc 4 đáp án A/B/C/D
        const options = {};
        while (i < lines.length) {
            const cur = lines[i].trim();
            const optMatch = /^([ABCD])\.\s?(.*)$/.exec(cur);
            if (optMatch) {
                options[optMatch[1]] = optMatch[2];
                i++;
                continue;
            }
            break;
        }

        // Đọc dòng "👉 Đáp án đúng: X"
        let correct = '';
        while (i < lines.length) {
            const cur = lines[i].trim();
            if (cur.startsWith('👉')) {
                const ansMatch = /[ABCD]/.exec(cur);
                if (ansMatch) correct = ansMatch[0];
                i++;
                break;
            }
            if (cur === '') { i++; continue; }
            break;
        }

        if (qText && options.A && options.B && options.C && options.D && correct) {
            questions.push({
                num: qNum,
                text: qText,
                options: [options.A, options.B, options.C, options.D],
                correct,
                correctText: options[correct] || '',
            });
        }
    }
    return questions;
}

function highlightText(html, term) {
    if (!term) return html;
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return html.replace(new RegExp(`(${safe})`, 'gi'), '<mark class="bank-hl">$1</mark>');
}

function renderBank(questions, term) {
    const container = document.getElementById('questionsBank');
    if (!container) return;
    const lower = term ? term.toLowerCase() : '';
    const html = questions.map(q => {
        const qHtml = highlightText(escapeHtml(q.text), term);
        const optHtml = q.options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isCorrect = letter === q.correct;
            const content = highlightText(escapeHtml(opt), term);
            return `<div class="bank-option${isCorrect ? ' is-correct' : ''}">
                <span class="opt-letter">${letter}.</span>
                <span class="opt-content">${content}</span>
            </div>`;
        }).join('');
        const correctLetterHtml = highlightText(escapeHtml(q.correct), term);
        const correctTextHtml = highlightText(escapeHtml(q.correctText), term);
        return `<div class="bank-question" data-qnum="${q.num}">
            <div class="bank-header">
                <span class="bank-q-number">Câu ${q.num}</span>
            </div>
            <div class="bank-text">${qHtml}</div>
            <div class="bank-options">${optHtml}</div>
            <div class="bank-answer">
                <span class="bank-answer-label">Đáp án đúng:</span>
                <span class="bank-answer-letter">${correctLetterHtml}</span>
                <span class="bank-answer-text">${correctTextHtml}</span>
            </div>
        </div>`;
    }).join('');
    container.innerHTML = html;
}

function applyFilterAndSearch() {
    const term = (document.getElementById('searchInput') || {}).value || '';
    const items = document.querySelectorAll('.bank-question');
    let visible = 0;
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        const matchSearch = !term || text.includes(term.toLowerCase());
        if (matchSearch) {
            item.classList.remove('hidden');
            visible++;
        } else {
            item.classList.add('hidden');
        }
    });
    const empty = document.getElementById('bankEmpty');
    if (empty) empty.hidden = visible > 0;
    const meta = document.getElementById('searchMeta');
    if (meta) {
        meta.textContent = term ? `Tìm thấy ${visible} / ${items.length} câu phù hợp với "${term}"` : '';
    }
}

async function initQuestionsBank() {
    const bank = document.getElementById('questionsBank');
    if (!bank) return; // không phải trang questions.html

    const loading = document.getElementById('bankLoading');
    const errorEl = document.getElementById('bankError');
    const errorMsg = document.getElementById('bankErrorMsg');
    const empty = document.getElementById('bankEmpty');

    let questions = [];
    try {
        let txt = (typeof window.QUIZ_BANK_TEXT === 'string') ? window.QUIZ_BANK_TEXT : '';
        if (!txt) {
            const res = await fetch('docs/quiz_75cau_dapan.txt', { cache: 'no-cache' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            txt = await res.text();
        }
        questions = parseQuizTxt(txt);
    } catch (err) {
        if (loading) loading.hidden = true;
        if (errorEl) errorEl.hidden = false;
        if (errorMsg) errorMsg.textContent = 'Chi tiết lỗi: ' + err.message + '. Hãy chạy web qua local server hoặc mở file qua http:// (không dùng file://).';
        return;
    }

    if (questions.length === 0) {
        if (loading) loading.hidden = true;
        if (empty) empty.hidden = false;
        return;
    }

    if (loading) loading.hidden = true;
    bank.hidden = false;

    renderBank(questions, '');
    applyFilterAndSearch();

    // Search input
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const cachedQuestions = questions;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const term = searchInput.value;
            if (searchClear) searchClear.classList.toggle('visible', !!term);
            renderBank(cachedQuestions, term);
            applyFilterAndSearch();
        });
    }
    if (searchClear) {
        searchClear.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchClear.classList.remove('visible');
                renderBank(cachedQuestions, '');
                applyFilterAndSearch();
                searchInput.focus();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initQuestionsBank();
    initQuizPage();
    initContentNavigation();
});

// ===== CONTENT PAGE CHAPTER NAVIGATION =====
function initContentNavigation() {
    const nav = document.querySelector('.content-page .chapter-nav');
    if (!nav) return;

    const links = Array.from(nav.querySelectorAll('a[href^="#chapter"]'));
    const sections = links
        .map(link => document.querySelector(link.getAttribute('href')))
        .filter(Boolean);
    if (!sections.length) return;

    let ticking = false;
    let activeId = '';

    function updateActiveChapter() {
        const marker = window.innerWidth <= SIDEBAR_MOBILE_BREAKPOINT ? 150 : 110;
        let active = sections[0];

        sections.forEach(section => {
            if (section.getBoundingClientRect().top <= marker) active = section;
        });

        if (active.id !== activeId) {
            activeId = active.id;
            links.forEach(link => {
                const isCurrent = link.getAttribute('href') === `#${activeId}`;
                link.classList.toggle('current', isCurrent);
                if (isCurrent) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            });

            const currentLink = nav.querySelector('.chapter-nav-item.current');
            if (currentLink && nav.scrollWidth > nav.clientWidth) {
                nav.scrollTo({
                    left: currentLink.offsetLeft - (nav.clientWidth - currentLink.clientWidth) / 2,
                    behavior: 'smooth',
                });
            }
        }
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(updateActiveChapter);
        }
    }, { passive: true });

    updateActiveChapter();
}

// ===== QUIZ PAGE =====
const QUIZ_MODE_TITLES = {
    random30: 'Bài thi ngẫu nhiên (30 câu)',
    all75: 'Bài thi tổng (75 câu)',
};

let quizState = null;

async function initQuizPage() {
    const modeSelect = document.getElementById('quizModeSelect');
    if (!modeSelect) return; // không phải trang quiz.html

    let questions = [];
    try {
        let txt = (typeof window.QUIZ_BANK_TEXT === 'string') ? window.QUIZ_BANK_TEXT : '';
        if (!txt) {
            const res = await fetch('docs/quiz_75cau_dapan.txt', { cache: 'no-cache' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            txt = await res.text();
        }
        questions = parseQuizTxt(txt);
    } catch (err) {
        console.error('Quiz: không tải được ngân hàng câu hỏi:', err);
        return;
    }

    if (questions.length === 0) {
        console.error('Quiz: ngân hàng câu hỏi rỗng');
        return;
    }

    // Disable nút không có đủ câu
    document.querySelectorAll('.quiz-mode-card').forEach(btn => {
        const mode = btn.dataset.mode;
        const need = mode === 'random30' ? 30 : questions.length;
        if (questions.length < need) {
            btn.disabled = true;
            btn.title = `Cần ${need} câu nhưng chỉ có ${questions.length}`;
            btn.style.opacity = '0.45';
            btn.style.cursor = 'not-allowed';
        }
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            startQuiz(questions, mode);
        });
    });

    // Các nút điều khiển quiz
    const prevBtn = document.getElementById('quizPrev');
    const nextBtn = document.getElementById('quizNext');
    const exitBtn = document.getElementById('quizExit');
    const retryBtn = document.getElementById('quizRetry');
    const backBtn = document.getElementById('quizBackModes');
    if (prevBtn) prevBtn.addEventListener('click', goPrev);
    if (nextBtn) nextBtn.addEventListener('click', goNext);
    if (exitBtn) exitBtn.addEventListener('click', exitQuiz);
    if (retryBtn) retryBtn.addEventListener('click', retryQuiz);
    if (backBtn) backBtn.addEventListener('click', backToModes);
}

function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function startQuiz(allQuestions, mode) {
    let list;
    if (mode === 'random30') {
        list = shuffleArray(allQuestions).slice(0, 30);
    } else {
        list = allQuestions.slice().sort((a, b) => a.num - b.num);
    }
    quizState = {
        list,
        mode,
        index: 0,
        answers: new Array(list.length).fill(null), // letter hoặc null
        correctCount: 0,
    };

    document.getElementById('quizModeSelect').hidden = true;
    document.getElementById('quizRunner').hidden = false;
    document.getElementById('quizModeTitle').textContent = QUIZ_MODE_TITLES[mode] || '';

    renderCurrentQuestion();
}

function renderCurrentQuestion() {
    const state = quizState;
    if (!state) return;
    const q = state.list[state.index];
    const card = document.getElementById('quizCard');
    const total = state.list.length;
    const answeredLetter = state.answers[state.index];

    document.getElementById('quizProgress').textContent = `Câu ${state.index + 1} / ${total}`;
    document.getElementById('quizScore').textContent = `Điểm: ${state.correctCount}`;

    const optsHtml = q.options.map((opt, idx) => {
        const letter = String.fromCharCode(65 + idx);
        const selected = answeredLetter === letter;
        const isCorrectOpt = letter === q.correct;
        let cls = 'quiz-option';
        if (answeredLetter) {
            cls += ' disabled';
            if (isCorrectOpt) cls += ' correct';
            else if (selected) cls += ' wrong';
        } else if (selected) {
            cls += ' selected';
        }
        return `<div class="${cls}" data-letter="${letter}">
            <span class="quiz-option-letter">${letter}</span>
            <span class="quiz-option-text">${escapeHtml(opt)}</span>
        </div>`;
    }).join('');

    const feedback = answeredLetter ? (answeredLetter === q.correct
        ? `<div class="quiz-feedback is-correct">Đúng rồi! Đáp án chính xác là ${q.correct}.</div>`
        : `<div class="quiz-feedback is-wrong">Sai rồi. Đáp án đúng là ${q.correct}. ${escapeHtml(q.correctText)}</div>`) : '';

    card.innerHTML = `
        <div class="quiz-q-number">Câu ${q.num}</div>
        <div class="quiz-q-text">${escapeHtml(q.text)}</div>
        <div class="quiz-options">${optsHtml}</div>
        ${feedback}
    `;

    if (!answeredLetter) {
        card.querySelectorAll('.quiz-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const letter = opt.dataset.letter;
                selectAnswer(letter);
            });
        });
    }

    // Update nav buttons
    const prevBtn = document.getElementById('quizPrev');
    const nextBtn = document.getElementById('quizNext');
    prevBtn.disabled = state.index === 0;
    const isLast = state.index === state.list.length - 1;
    nextBtn.disabled = !answeredLetter;
    nextBtn.textContent = isLast ? 'Nộp bài' : 'Câu sau →';
}

function selectAnswer(letter) {
    const state = quizState;
    if (!state || state.answers[state.index]) return; // đã chọn rồi
    state.answers[state.index] = letter;
    const q = state.list[state.index];
    if (letter === q.correct) state.correctCount++;
    renderCurrentQuestion();
}

function goNext() {
    const state = quizState;
    if (!state) return;
    if (!state.answers[state.index]) return; // chưa chọn thì không cho next
    if (state.index === state.list.length - 1) {
        showResult();
        return;
    }
    state.index++;
    renderCurrentQuestion();
}

function goPrev() {
    const state = quizState;
    if (!state || state.index === 0) return;
    state.index--;
    renderCurrentQuestion();
}

function showResult() {
    const state = quizState;
    const total = state.list.length;
    const score = state.correctCount;
    const pct = Math.round((score / total) * 100);
    document.getElementById('quizResultScore').textContent = `${score} / ${total}`;
    let label = '';
    if (pct >= 80) label = 'Xuất sắc! Bạn nắm rất vững kiến thức.';
    else if (pct >= 60) label = 'Khá tốt! Cần ôn thêm một vài điểm.';
    else if (pct >= 40) label = 'Trung bình. Hãy xem lại ngân hàng câu hỏi nhé.';
    else label = 'Cần ôn tập thêm nhiều. Đừng nản!';
    document.getElementById('quizResultPercent').textContent = `${pct}% — ${label}`;
    document.getElementById('quizResultModal').hidden = false;
}

function exitQuiz() {
    quizState = null;
    document.getElementById('quizRunner').hidden = true;
    document.getElementById('quizResultModal').hidden = true;
    document.getElementById('quizModeSelect').hidden = false;
}

function retryQuiz() {
    if (!quizState) return;
    const all = quizState.list; // dùng lại danh sách đã shuffle/sort
    startQuiz(all.concat([]), quizState.mode); // truyền bản copy để tránh mutate
    document.getElementById('quizResultModal').hidden = true;
}

function backToModes() {
    document.getElementById('quizResultModal').hidden = true;
    exitQuiz();
}
