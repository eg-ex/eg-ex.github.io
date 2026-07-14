// ============================================
//  منطق تطبيق إختبارات سلاح الأزهري
//  يعتمد على المتغيرات: app, database, auth
//  المُعرّفة في ملف firebase-config.js (يجب تحميله قبل هذا الملف)
// ============================================

// متغيرات التطبيق
let currentQuestionIndex = 0;
let score = 0;
let questions = [];
let questionsCache = [];
let userAnswers = [];
let clickCount = 0;
let adminPassword = localStorage.getItem('adminPassword') || "gohary01010081147mo";
let categories = new Set();
let quizStartTime;
let timerInterval;
let selectedYear = '';
let selectedSection = '';
let isLoadingQuestions = false; // علم لمنع تحميل الأسئلة مرات متعددة
let isQuizStarted = false; // علم لمنع بدء الاختبار مرات متعددة
let selectedSubject = '';
let selectedLesson = '';
let selectedSublesson = '';
let subjects = [];
let sections = [];
let lessons = [];
let sublessons = [];
let examActive = true;
let defaultExamTime = 10;
let currentUser = null;
let savedState = JSON.parse(localStorage.getItem('quizState')) || {};
let currentEditingQuestionId = null;
let currentAd = JSON.parse(localStorage.getItem('currentAd')) || null;
let autoBackupEnabled = localStorage.getItem('autoBackupEnabled') !== 'false';
let userStats = (() => {
    const saved = JSON.parse(localStorage.getItem('userStats'));
    return saved ? {
        totalVisits: saved.totalVisits || 0,
        uniqueUsers: new Set(saved.uniqueUsers || []),
        dailyActiveUsers: new Set(saved.dailyActiveUsers || []),
        userSessions: saved.userSessions || [],
        activeUsers: new Set(saved.activeUsers || []),
        permanentUsers: new Set(saved.permanentUsers || []),
        userActivities: saved.userActivities || []
    } : {
        totalVisits: 0,
        uniqueUsers: new Set(),
        dailyActiveUsers: new Set(),
        userSessions: [],
        activeUsers: new Set(),
        permanentUsers: new Set(),
        userActivities: []
    };
})();

// متغير Dark Mode
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// ===== نظام روابط المواد المقفلة =====
let directLinkHandled = false;          // عولج الرابط المباشر مرة واحدة
let sectionsLoaded = false;             // اكتمل تحميل الأقسام
let subjectsLoaded = false;             // اكتمل تحميل المواد
let lessonsLoaded = false;              // اكتمل تحميل الدروس
let sublessonsLoaded = false;           // اكتمل تحميل الأقسام الفرعية

function getQuestionsCacheKey() {
    return 'cachedQuestions_' + [selectedYear, selectedSection, selectedSubject, selectedLesson, selectedSublesson]
        .map(value => encodeURIComponent(value || ''))
        .join('_');
}

function loadCachedQuestions() {
    try {
        const cacheKey = getQuestionsCacheKey();
        const cached = localStorage.getItem(cacheKey);
        if (!cached) {
            return null;
        }
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
        console.error('خطأ في تحميل الأسئلة من التخزين المؤقت:', error);
        return null;
    }
}

function cacheQuestions(questionsToCache) {
    try {
        const cacheKey = getQuestionsCacheKey();
        localStorage.setItem(cacheKey, JSON.stringify(questionsToCache));
    } catch (error) {
        console.error('خطأ في حفظ الأسئلة في التخزين المؤقت:', error);
    }
}

// عناصر DOM
const elements = {
    quizContainer: document.getElementById('quiz-container'),
    questionContainer: document.getElementById('question-container'),
    resultsContainer: document.getElementById('results-container'),
    progressBar: document.getElementById('progress-bar'),
    nextBtn: document.getElementById('next-btn'),
    prevBtn: document.getElementById('prev-btn'),
    submitBtn: document.getElementById('submit-btn'),
    restartBtn: document.getElementById('restart-btn'),
    quizTitle: document.getElementById('quiz-title'),
    scoreDisplay: document.getElementById('score-value'),
    percentageDisplay: document.getElementById('percentage'),
    timeTakenDisplay: document.getElementById('time-taken'),
    feedbackDisplay: document.getElementById('feedback'),
    quizLoading: document.getElementById('quiz-loading'),
    categoryFilter: document.getElementById('category-filter'),
    categorySelect: document.getElementById('category-select'),
    timerDisplay: document.getElementById('timer'),
    yearSelectionContainer: document.getElementById('year-selection-container'),
    sectionSelectionContainer: document.getElementById('section-selection-container'),
    subjectSelectionContainer: document.getElementById('subject-selection-container'),
    lessonSelectionContainer: document.getElementById('lesson-selection-container'),
    sublessonSelectionContainer: document.getElementById('sublesson-selection-container'),
    backBtn: document.getElementById('back-btn'),
    adContainer: document.getElementById('ad-container'),
    sectionContainer: document.getElementById('section-container'),
    subjectContainer: document.getElementById('subject-container'),
    lessonContainer: document.getElementById('lesson-container'),
    sublessonContainer: document.getElementById('sublesson-container'),
    adClose: document.getElementById('ad-close'),
    adTitle: document.getElementById('ad-title'),
    adDescription: document.getElementById('ad-description'),
    adAction: document.getElementById('ad-action')
};

// التحقق من وجود section / subject في URL (لروابط المواد المباشرة وQR Code)
const urlParams = new URLSearchParams(window.location.search);
const sectionFromUrl = urlParams.get('section');
const subjectFromUrl = urlParams.get('subject');
const isFromQR = sectionFromUrl !== null;
const hasDirectLink = sectionFromUrl !== null || subjectFromUrl !== null;

// اللوجو - ثابت لجميع العناوين
const LOGO_URL = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhdyuIMWOk4qbKO_qCaKOHo859JMs3To_OJjpQ8u5fU0ULewA-AdNp7Izuv9PUOIOTGTUsNM6DTVVbRWKe2OEDTBcHnxOnOrCylsq_V3YhUFPqTkPJ7XOuzWzbCXKW-UnoLEwqsE8XjaHiWPZu2dC_pESia4uQOATzelupKDAUbuO1_jH2003wsgUO0PPiO/s1080/Selah%20Elazhary%20Transperant%20logo.png";

// تهيئة التطبيق
function initApp() {
    try {
        trackUserVisit();

        if (isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        setupEventListeners();
        loadInitialData();
        checkExamStatus();
        restoreSavedState();
        loadAd();

        checkUrlForSection();

        if (hasDirectLink) {
            // أي رابط مباشر (مادة أو قسم): أظهر شاشة التحميل فوراً
            // ولا تُظهر أي شاشة اختيار قبل الدخول
            if (elements.quizLoading) elements.quizLoading.style.display = 'flex';
        } else {
            elements.yearSelectionContainer.style.display = 'grid';
        }

        window.addEventListener('beforeunload', saveCurrentState);

        console.log('التطبيق تم تهيئته بنجاح');
    } catch (error) {
        console.error('خطأ في تهيئة التطبيق:', error);
        showError('حدث خطأ في تهيئة التطبيق. الرجاء تحديث الصفحة.');
    }
}

// التحقق من وجود section في URL
// ملاحظة: معالجة روابط الأقسام انتقلت إلى tryHandleDirectLink() + openSectionDirect()
// لتدخل المادة مباشرة دون إظهار شاشة "اختر القسم". أُبقيت هذه الدالة فارغة للتوافق.
function checkUrlForSection() {
    // لا شيء — تُدار الروابط المباشرة عبر tryHandleDirectLink()
}

// تحميل القسم من الرابط (نفس الصفحة - للـ QR Code)
function loadSectionFromUrl(sectionId) {
    try {
        console.log('جاري تحميل القسم من الرابط:', sectionId);

        elements.yearSelectionContainer.style.display = 'none';

        const sectionRef = database.ref('sections/' + sectionId);
        sectionRef.once('value', (snapshot) => {
            if (snapshot.exists()) {
                const section = snapshot.val();
                console.log('تم العثور على القسم:', section);

                if (section.grades && section.grades.length > 0) {
                    selectedYear = section.grades[0];
                    selectedSection = sectionId;

                    elements.sectionSelectionContainer.style.display = 'block';

                    loadSectionsForYear(selectedYear, sectionId);
                } else {
                    showError('القسم المطلوب غير مرتبط بأي صف');
                }
            } else {
                console.error('القسم المطلوب غير موجود:', sectionId);
                showError('القسم المطلوب غير موجود');
            }
        }, (error) => {
            console.error('خطأ في تحميل القسم من الرابط:', error);
            showError('حدث خطأ في تحميل القسم من الرابط');
        });
    } catch (error) {
        console.error('خطأ في تحميل القسم من الرابط:', error);
        showError('حدث خطأ في تحميل القسم من الرابط');
    }
}

// دالة المشاركة - إنشاء رابط القسم (نفس الرابط القديم)
function shareSection(sectionId, sectionName) {
    try {
        const shareUrl = `${window.location.origin}${window.location.pathname}?section=${sectionId}`;

        navigator.clipboard.writeText(shareUrl).then(() => {
            showNotification(`تم نسخ رابط قسم "${sectionName}"`, 'success');
        }).catch(err => {
            console.error('فشل في نسخ الرابط:', err);
            prompt('انسخ الرابط:', shareUrl);
        });

        const shareRef = database.ref('shares');
        shareRef.push({
            sectionId: sectionId,
            sectionName: sectionName,
            timestamp: new Date().toISOString()
        }).catch(error => {
            console.error('خطأ في حفظ المشاركة:', error);
        });
    } catch (error) {
        console.error('خطأ في مشاركة القسم:', error);
        showError('حدث خطأ في مشاركة القسم');
    }
}

// إظهار إشعار
function showNotification(message, type = 'info') {
    try {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? 'var(--gradient-success)' : 'var(--gradient-primary)'};
            color: white;
            padding: 12px 24px;
            border-radius: 50px;
            box-shadow: var(--shadow-lg);
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideDown 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    } catch (error) {
        console.error('خطأ في إظهار الإشعار:', error);
    }
}

// تتبع دخول المستخدم
function trackUserVisit() {
    try {
        let userId = localStorage.getItem('userId');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('userId', userId);
        }

        const session = {
            userId: userId,
            timestamp: new Date().toISOString(),
            action: 'visit',
            page: window.location.href
        };

        userStats.totalVisits++;
        userStats.uniqueUsers.add(userId);

        const today = new Date().toDateString();
        const userKey = `${userId}_${today}`;
        userStats.dailyActiveUsers.add(userKey);

        userStats.activeUsers.add(userId);

        userStats.userActivities.push(session);

        if (userStats.userActivities.length > 100) {
            userStats.userActivities = userStats.userActivities.slice(-100);
        }

        const userSessions = userStats.userSessions.find(s => s.userId === userId);
        if (userSessions) {
            userSessions.count++;
            userSessions.lastVisit = new Date().toISOString();
        } else {
            userStats.userSessions.push({
                userId: userId,
                count: 1,
                firstVisit: new Date().toISOString(),
                lastVisit: new Date().toISOString()
            });
        }

        saveUserStats();
        saveUserActivityToFirebase(session);
    } catch (error) {
        console.error('خطأ في تتبع دخول المستخدم:', error);
    }
}

// حفظ إحصائيات المستخدمين
function saveUserStats() {
    try {
        const statsToSave = {
            totalVisits: userStats.totalVisits,
            uniqueUsers: Array.from(userStats.uniqueUsers),
            dailyActiveUsers: Array.from(userStats.dailyActiveUsers),
            userSessions: userStats.userSessions,
            activeUsers: Array.from(userStats.activeUsers),
            permanentUsers: Array.from(userStats.permanentUsers),
            userActivities: userStats.userActivities
        };

        localStorage.setItem('userStats', JSON.stringify(statsToSave));
    } catch (error) {
        console.error('خطأ في حفظ إحصائيات المستخدمين:', error);
    }
}

// تحميل إحصائيات المستخدمين
function loadUserStats() {
    try {
        const savedStats = JSON.parse(localStorage.getItem('userStats'));
        if (savedStats) {
            userStats = {
                totalVisits: savedStats.totalVisits || 0,
                uniqueUsers: new Set(savedStats.uniqueUsers || []),
                dailyActiveUsers: new Set(savedStats.dailyActiveUsers || []),
                userSessions: savedStats.userSessions || [],
                activeUsers: new Set(savedStats.activeUsers || []),
                permanentUsers: new Set(savedStats.permanentUsers || []),
                userActivities: savedStats.userActivities || []
            };
        }
    } catch (error) {
        console.error('خطأ في تحميل إحصائيات المستخدمين:', error);
    }
}

// حفظ نشاط المستخدم في Firebase
function saveUserActivityToFirebase(session) {
    try {
        const userActivityRef = database.ref('userActivities');
        userActivityRef.push(session)
            .catch(error => {
                console.error('Error saving user activity:', error);
            });
    } catch (error) {
        console.error('خطأ في حفظ نشاط المستخدم:', error);
    }
}

// تحميل البيانات الأولية
function loadInitialData() {
    try {
        loadSections();
        loadSubjects();
        loadLessons();
        loadSublessons();
        loadUserStats();
    } catch (error) {
        console.error('خطأ في تحميل البيانات الأولية:', error);
    }
}

// تحميل الأقسام
function loadSections() {
    try {
        const sectionsRef = database.ref('sections');
        sectionsRef.on('value', (snapshot) => {
            sections = [];
            snapshot.forEach((childSnapshot) => {
                const section = childSnapshot.val();
                section.id = childSnapshot.key;
                sections.push(section);
            });
            console.log('تم تحميل الأقسام:', sections.length);
            sectionsLoaded = true;
            tryHandleDirectLink();
        }, (error) => {
            console.error('خطأ في تحميل الأقسام:', error);
        });
    } catch (error) {
        console.error('خطأ في دالة تحميل الأقسام:', error);
    }
}

// تحميل المواد
function loadSubjects() {
    try {
        const subjectsRef = database.ref('subjects');
        subjectsRef.on('value', (snapshot) => {
            subjects = [];
            snapshot.forEach((childSnapshot) => {
                const subject = childSnapshot.val();
                subject.id = childSnapshot.key;
                subjects.push(subject);
            });
            console.log('تم تحميل المواد:', subjects.length);
            subjectsLoaded = true;
            tryHandleDirectLink();
        }, (error) => {
            console.error('خطأ في تحميل المواد:', error);
        });
    } catch (error) {
        console.error('خطأ في دالة تحميل المواد:', error);
    }
}

// تحميل الدروس
function loadLessons() {
    try {
        const lessonsRef = database.ref('lessons');
        lessonsRef.on('value', (snapshot) => {
            lessons = [];
            snapshot.forEach((childSnapshot) => {
                const lesson = childSnapshot.val();
                lesson.id = childSnapshot.key;
                lessons.push(lesson);
            });
            console.log('تم تحميل الدروس:', lessons.length);
            lessonsLoaded = true;
            tryHandleDirectLink();
        }, (error) => {
            console.error('خطأ في تحميل الدروس:', error);
        });
    } catch (error) {
        console.error('خطأ في دالة تحميل الدروس:', error);
    }
}

// تحميل الأقسام الفرعية
function loadSublessons() {
    try {
        const sublessonsRef = database.ref('sublessons');
        sublessonsRef.on('value', (snapshot) => {
            sublessons = [];
            snapshot.forEach((childSnapshot) => {
                const sublesson = childSnapshot.val();
                sublesson.id = childSnapshot.key;
                sublessons.push(sublesson);
            });
            console.log('تم تحميل الأقسام الفرعية:', sublessons.length);
            sublessonsLoaded = true;
            tryHandleDirectLink();
        }, (error) => {
            console.error('خطأ في تحميل الأقسام الفرعية:', error);
        });
    } catch (error) {
        console.error('خطأ في دالة تحميل الأقسام الفرعية:', error);
    }
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    try {
        elements.nextBtn.addEventListener('click', nextQuestion);
        elements.prevBtn.addEventListener('click', prevQuestion);
        elements.submitBtn.addEventListener('click', submitQuiz);
        elements.restartBtn.addEventListener('click', restartQuiz);

        elements.categorySelect.addEventListener('change', function() {
            try {
                filterQuestionsByCategory(this.value);
            } catch (error) {
                console.error('خطأ في تصفية الأسئلة:', error);
            }
        });

        if (elements.adClose) {
            elements.adClose.addEventListener('click', function() {
                elements.adContainer.style.display = 'none';
            });
        }

        if (elements.adAction) {
            elements.adAction.addEventListener('click', function() {
                try {
                    if (currentAd && currentAd.url) {
                        window.open(currentAd.url, '_blank');
                    }
                } catch (error) {
                    console.error('خطأ في فتح رابط الإعلان:', error);
                }
            });
        }
    } catch (error) {
        console.error('خطأ في إعداد مستمعي الأحداث:', error);
    }
}

// تحميل الأقسام بناءً على الصف المختار
function loadSectionsForYear(year, highlightSectionId = null) {
    try {
        if (!elements.sectionContainer) {
            console.error('عنصر sectionContainer غير موجود');
            return;
        }

        elements.sectionContainer.innerHTML = '';
        console.log('تحميل الأقسام للصف:', year);
        console.log('الأقسام المتاحة:', sections);

        const yearSections = sections.filter(section =>
            section.grades && section.grades.includes(year)
        );

        console.log('الأقسام المصفاة:', yearSections.length);

        if (yearSections.length > 0) {
            yearSections.forEach(section => {
                const sectionCard = document.createElement('div');
                sectionCard.className = 'section-card';
                if (highlightSectionId && section.id === highlightSectionId) {
                    sectionCard.classList.add('selected');
                    selectedSection = section.id;
                }
                sectionCard.dataset.section = section.id;

                sectionCard.innerHTML = `
                    <div class="section-share-btn" data-section-id="${section.id}" data-section-name="${section.name}">
                        <i class="fas fa-share-alt"></i>
                    </div>
                    <i class="${section.icon}"></i>
                    <h3>${section.name}</h3>
                    <p>${section.description || ''}</p>
                `;

                elements.sectionContainer.appendChild(sectionCard);

                // عند الضغط على القسم - يفتح في صفحة جديدة (للمستخدم العادي)
                sectionCard.addEventListener('click', function(e) {
                    if (e.target.closest('.section-share-btn')) return;

                    try {
                        // التحقق: إذا كان المستخدم جاي من QR Code، يفتح في نفس الصفحة
                        // وإلا يفتح في صفحة جديدة
                        if (isFromQR) {
                            // من QR كود -> يفتح في نفس الصفحة
                            document.querySelectorAll('.section-card').forEach(c => c.classList.remove('selected'));
                            this.classList.add('selected');
                            selectedSection = this.dataset.section;

                            const sectionObj = sections.find(s => s.id === selectedSection);
                            const sectionName = sectionObj ? sectionObj.name : '';
                            console.log('تم اختيار القسم (من QR):', sectionName);

                            const yearText = getYearText(selectedYear);
                            elements.quizTitle.textContent = `اختبار إختبارات سلاح الأزهري - ${yearText} - ${sectionName}`;

                            loadSubjectsForSection(selectedSection);
                            saveCurrentState();
                        } else {
                            // من المستخدم العادي -> يفتح في صفحة جديدة
                            window.open(`?section=${this.dataset.section}`, '_blank');
                        }
                    } catch (error) {
                        console.error('خطأ في اختيار القسم:', error);
                        showError('حدث خطأ في اختيار القسم');
                    }
                });

                const shareBtn = sectionCard.querySelector('.section-share-btn');
                shareBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const sectionId = this.dataset.sectionId;
                    const sectionName = this.dataset.sectionName;
                    shareSection(sectionId, sectionName);
                });
            });

            if (highlightSectionId && isFromQR) {
                setTimeout(() => {
                    loadSubjectsForSection(highlightSectionId);
                }, 500);
            }
        } else {
            elements.sectionContainer.innerHTML = `
                <div class="no-questions" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                    <i class="fas fa-info-circle" style="font-size: 48px; color: var(--primary);"></i>
                    <h3 style="margin: 20px 0;">لا توجد أقسام متاحة</h3>
                    <p style="color: var(--text-secondary);">لم يتم إضافة أقسام لهذا الصف بعد.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('خطأ في تحميل الأقسام للصف:', error);
        showError('حدث خطأ في تحميل الأقسام');
    }
}

// تحميل المواد بناءً على القسم المختار
function loadSubjectsForSection(sectionId) {
    try {
        if (!elements.subjectContainer) {
            console.error('عنصر subjectContainer غير موجود');
            return;
        }

        elements.subjectContainer.innerHTML = '';
        console.log('تحميل المواد للقسم:', sectionId);

        // تغيير النص إلى اسم القسم الأساسي
        const subjectTitleElem = document.getElementById('subject-selection-title');
        if (subjectTitleElem) {
            const sectionObj = sections.find(s => s.id === sectionId);
            if (sectionObj) {
                subjectTitleElem.textContent = sectionObj.name;
            } else {
                subjectTitleElem.textContent = 'اختر المادة الدراسية';
            }
        }

        const sectionSubjects = subjects.filter(subject =>
            subject.sectionId === sectionId
        );

        console.log('المواد المصفاة:', sectionSubjects.length);

        if (sectionSubjects.length > 0) {
            sectionSubjects.forEach(subject => {
                const subjectCard = document.createElement('div');
                subjectCard.className = 'subject-card';
                subjectCard.dataset.subject = subject.id;
                subjectCard.innerHTML = `
                    <i class="fas ${subject.icon || 'fa-book'}"></i>
                    <h3>${subject.name}</h3>
                    <p>${subject.description || ''}</p>
                `;

                subjectCard.addEventListener('click', function() {
                    try {
                        document.querySelectorAll('.subject-card').forEach(c => c.classList.remove('selected'));
                        this.classList.add('selected');
                        selectedSubject = this.dataset.subject;

                        const subjectObj = subjects.find(s => s.id === selectedSubject);
                        const subjectName = subjectObj ? subjectObj.name : '';
                        console.log('تم اختيار المادة:', subjectName);

                        const yearText = getYearText(selectedYear);
                        const sectionObj = sections.find(s => s.id === selectedSection);
                        const sectionName = sectionObj ? sectionObj.name : '';
                        elements.quizTitle.textContent = `اختبار إختبارات سلاح الأزهري - ${yearText} - ${sectionName} - ${subjectName}`;

                        // تحديث عنوان الدرس
                        const lessonTitleElem = document.getElementById('lesson-selection-title');
                        if (lessonTitleElem) {
                            lessonTitleElem.textContent = `دروس ${subjectName}`;
                        }

                        loadLessonsForSubject(selectedSubject);

                        saveCurrentState();
                    } catch (error) {
                        console.error('خطأ في اختيار المادة:', error);
                        showError('حدث خطأ في اختيار المادة');
                    }
                });

                elements.subjectContainer.appendChild(subjectCard);
            });

            elements.sectionSelectionContainer.style.display = 'none';
            elements.subjectSelectionContainer.style.display = 'block';
            updateGradeDisplay();
        } else {
            elements.subjectContainer.innerHTML = `
                <div class="no-questions" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                    <i class="fas fa-info-circle" style="font-size: 48px; color: var(--primary);"></i>
                    <h3 style="margin: 20px 0;">لا توجد مواد متاحة</h3>
                    <p style="color: var(--text-secondary);">لم يتم إضافة مواد لهذا القسم بعد.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('خطأ في تحميل المواد للقسم:', error);
        showError('حدث خطأ في تحميل المواد');
    }
}

// تحميل الدروس للمادة المختارة
function loadLessonsForSubject(subjectId) {
    try {
        if (!elements.lessonContainer) {
            console.error('عنصر lessonContainer غير موجود');
            return;
        }

        elements.lessonContainer.innerHTML = '';
        console.log('تحميل الدروس للمادة:', subjectId);

        const subjectObj = subjects.find(s => s.id === subjectId);
        const subjectName = subjectObj ? subjectObj.name : '';

        // تحديث عنوان الدرس مع اسم المادة
        const lessonTitleElem = document.getElementById('lesson-selection-title');
        if (lessonTitleElem) {
            lessonTitleElem.textContent = `دروس ${subjectName}`;
        }

        const subjectLessons = lessons.filter(lesson =>
            lesson.subjectId === subjectId
        );

        console.log('الدروس المصفاة:', subjectLessons.length);

        if (subjectLessons.length > 0) {
            subjectLessons.sort((a, b) => (a.order || 999) - (b.order || 999));

            subjectLessons.forEach(lesson => {
                const lessonCard = document.createElement('div');
                lessonCard.className = 'lesson-card';
                lessonCard.dataset.lesson = lesson.id;
                lessonCard.innerHTML = `
                    <i class="fas ${lesson.icon || 'fa-book-open'}"></i>
                    <h3>${lesson.name}</h3>
                    <p>${lesson.description || ''}</p>
                `;

                lessonCard.addEventListener('click', function() {
                    try {
                        document.querySelectorAll('.lesson-card').forEach(c => c.classList.remove('selected'));
                        this.classList.add('selected');
                        selectedLesson = this.dataset.lesson;

                        const lessonObj = lessons.find(l => l.id === selectedLesson);
                        const lessonName = lessonObj ? lessonObj.name : '';
                        console.log('تم اختيار الدرس:', lessonName);

                        const yearText = getYearText(selectedYear);
                        const sectionObj = sections.find(s => s.id === selectedSection);
                        const sectionName = sectionObj ? sectionObj.name : '';
                        const subjectObj = subjects.find(s => s.id === selectedSubject);
                        const subjectName = subjectObj ? subjectObj.name : '';
                        elements.quizTitle.textContent = `اختبار إختبارات سلاح الأزهري - ${yearText} - ${sectionName} - ${subjectName} - ${lessonName}`;

                        // تحديث عنوان القسم الفرعي
                        const sublessonTitleElem = document.getElementById('sublesson-selection-title');
                        if (sublessonTitleElem) {
                            sublessonTitleElem.textContent = `أقسام ${lessonName}`;
                        }

                        loadSublessonsForLesson(selectedLesson);

                        saveCurrentState();
                    } catch (error) {
                        console.error('خطأ في اختيار الدرس:', error);
                        showError('حدث خطأ في اختيار الدرس');
                    }
                });

                elements.lessonContainer.appendChild(lessonCard);
            });

            elements.subjectSelectionContainer.style.display = 'none';
            elements.lessonSelectionContainer.style.display = 'block';
        } else {
            console.log('لا توجد دروس، الانتقال مباشرة للاختبارات');
            setTimeout(() => {
                elements.subjectSelectionContainer.style.display = 'none';
                elements.quizContainer.style.display = 'block';
                loadQuestions();
            }, 500);
        }
    } catch (error) {
        console.error('خطأ في تحميل الدروس للمادة:', error);
        showError('حدث خطأ في تحميل الدروس');
    }
}

// تحميل الأقسام الفرعية للدرس المختار
function loadSublessonsForLesson(lessonId) {
    try {
        if (!elements.sublessonContainer) {
            console.error('عنصر sublessonContainer غير موجود');
            return;
        }

        elements.sublessonContainer.innerHTML = '';
        console.log('تحميل الأقسام الفرعية للدرس:', lessonId);

        const lessonObj = lessons.find(l => l.id === lessonId);
        const lessonName = lessonObj ? lessonObj.name : '';

        // تحديث عنوان القسم الفرعي
        const sublessonTitleElem = document.getElementById('sublesson-selection-title');
        if (sublessonTitleElem) {
            sublessonTitleElem.textContent = `أقسام ${lessonName}`;
        }

        const lessonSublessons = sublessons.filter(sublesson =>
            sublesson.lessonId === lessonId
        );

        console.log('الأقسام الفرعية المصفاة:', lessonSublessons.length);

        if (lessonSublessons.length > 0) {
            lessonSublessons.sort((a, b) => (a.order || 999) - (b.order || 999));

            lessonSublessons.forEach(sublesson => {
                const sublessonCard = document.createElement('div');
                sublessonCard.className = 'sublesson-card';
                sublessonCard.dataset.sublesson = sublesson.id;
                sublessonCard.innerHTML = `
                    <i class="fas ${sublesson.icon || 'fa-folder'}"></i>
                    <h3>${sublesson.name}</h3>
                    <p>${sublesson.description || ''}</p>
                `;

                sublessonCard.addEventListener('click', function() {
                    try {
                        document.querySelectorAll('.sublesson-card').forEach(c => c.classList.remove('selected'));
                        this.classList.add('selected');
                        selectedSublesson = this.dataset.sublesson;

                        const sublessonObj = sublessons.find(s => s.id === selectedSublesson);
                        const sublessonName = sublessonObj ? sublessonObj.name : '';
                        console.log('تم اختيار القسم الفرعي:', sublessonName);

                        const yearText = getYearText(selectedYear);
                        const sectionObj = sections.find(s => s.id === selectedSection);
                        const sectionName = sectionObj ? sectionObj.name : '';
                        const subjectObj = subjects.find(s => s.id === selectedSubject);
                        const subjectName = subjectObj ? subjectObj.name : '';
                        const lessonObj = lessons.find(l => l.id === selectedLesson);
                        const lessonName = lessonObj ? lessonObj.name : '';
                        elements.quizTitle.textContent = `اختبار إختبارات سلاح الأزهري - ${yearText} - ${sectionName} - ${subjectName} - ${lessonName} - ${sublessonName}`;

                        setTimeout(() => {
                            elements.sublessonSelectionContainer.style.display = 'none';
                            elements.quizContainer.style.display = 'block';
                            loadQuestions();
                        }, 500);

                        saveCurrentState();
                    } catch (error) {
                        console.error('خطأ في اختيار القسم الفرعي:', error);
                        showError('حدث خطأ في اختيار القسم الفرعي');
                    }
                });

                elements.sublessonContainer.appendChild(sublessonCard);
            });

            elements.lessonSelectionContainer.style.display = 'none';
            elements.sublessonSelectionContainer.style.display = 'block';
        } else {
            console.log('لا توجد أقسام فرعية، الانتقال مباشرة للاختبارات');
            setTimeout(() => {
                elements.lessonSelectionContainer.style.display = 'none';
                elements.quizContainer.style.display = 'block';
                loadQuestions();
            }, 500);
        }
    } catch (error) {
        console.error('خطأ في تحميل الأقسام الفرعية للدرس:', error);
        showError('حدث خطأ في تحميل الأقسام الفرعية');
    }
}

// تحديث معلومات الـ Splash Screen ديناميكياً
function updateSplashScreen() {
    try {
        const subjectObj = subjects.find(s => s.id === selectedSubject);
        const subjectName = subjectObj ? subjectObj.name : '';
        const yearText = getYearText(selectedYear);

        const splashSubjectName = document.getElementById('splash-subject-name');
        const splashGradeInfo = document.getElementById('splash-grade-info');

        if (splashSubjectName) {
            splashSubjectName.textContent = subjectName;
        }

        if (splashGradeInfo) {
            splashGradeInfo.textContent = 'نظام إختبارات سلاح الأزهري - التعليم الذكي';
        }
    } catch (error) {
        console.error('خطأ في تحديث الـ Splash Screen:', error);
    }
}

// تحديث اسم الفصل الدراسي في صفحة المادة
function updateGradeDisplay() {
    try {
        const gradeDisplay = document.getElementById('subject-grade-display');
        if (gradeDisplay && selectedYear) {
            const yearText = getYearText(selectedYear);
            gradeDisplay.textContent = `${yearText}`;
        }
    } catch (error) {
        console.error('خطأ في تحديث اسم الفصل:', error);
    }
}

// تحميل الإختبارات من Firebase
function loadQuestions() {
    try {
        // منع تحميل الأسئلة مرات متعددة
        if (isLoadingQuestions) {
            console.log('الأسئلة قيد التحميل بالفعل، سيتم تجاهل الطلب الحالي');
            return;
        }

        const cachedQuestions = loadCachedQuestions();
        if (cachedQuestions && cachedQuestions.length > 0) {
            console.log('تحميل الأسئلة من التخزين المحلي (offline)');
            questions = cachedQuestions;
            questionsCache = cachedQuestions;
            updateCategoryFilters();

            if (questions.length > 0) {
                startQuiz();
            } else {
                showNoQuestionsMessage();
            }
            return;
        }

        isLoadingQuestions = true;

        // تحديث الـ splash screen بمعلومات الفصل والمادة
        updateSplashScreen();

        elements.quizLoading.style.display = 'flex';
        elements.questionContainer.innerHTML = '';

        console.log('جاري تحميل الأسئلة...');
        console.log('معايير التصفية:', {
            year: selectedYear,
            section: selectedSection,
            subject: selectedSubject,
            lesson: selectedLesson,
            sublesson: selectedSublesson
        });

        const questionsRef = database.ref('questions');
        questionsRef.once('value', (snapshot) => {
            const allQuestions = [];
            categories = new Set(['all']);

            snapshot.forEach((childSnapshot) => {
                const question = childSnapshot.val();
                question.id = childSnapshot.key;
                allQuestions.push(question);
            });

            console.log('إجمالي الأسئلة في Firebase:', allQuestions.length);

            questions = allQuestions.filter(q => {
                const yearMatch = q.year === selectedYear;
                const sectionMatch = q.section === selectedSection;
                const subjectMatch = !selectedSubject || q.subject === selectedSubject || !q.subject;
                const lessonMatch = !selectedLesson || q.lesson === selectedLesson || !q.lesson;
                const sublessonMatch = !selectedSublesson || q.sublesson === selectedSublesson || !q.sublesson;

                const matches = yearMatch && sectionMatch && subjectMatch && lessonMatch && sublessonMatch;

                if (matches && q.category) {
                    categories.add(q.category);
                }

                return matches;
            });

            console.log('الأسئلة بعد التصفية:', questions.length);
            questionsCache = questions;
            cacheQuestions(questions);

            updateCategoryFilters();

            if (questions.length > 0) {
                console.log('تم العثور على أسئلة، بدء الاختبار');
                startQuiz();
            } else {
                console.log('لم يتم العثور على أسئلة');
                showNoQuestionsMessage();
            }

            elements.quizLoading.style.display = 'none';
            isLoadingQuestions = false;
        }, (error) => {
            console.error('خطأ في تحميل الأسئلة:', error);
            elements.quizLoading.style.display = 'none';
            showError('حدث خطأ في تحميل الأسئلة: ' + error.message);
            isLoadingQuestions = false;
        });
    } catch (error) {
        console.error('خطأ في دالة تحميل الأسئلة:', error);
        elements.quizLoading.style.display = 'none';
        showError('حدث خطأ في تحميل الأسئلة');
        isLoadingQuestions = false;
    }
}

// تصفية الإختبارات حسب التصنيف
function filterQuestionsByCategory(selectedCategory) {
    try {
        if (!questionsCache || questionsCache.length === 0) {
            loadQuestions();
            return;
        }

        if (selectedCategory === 'all') {
            questions = questionsCache.slice();
        } else {
            questions = questionsCache.filter(question => question.category === selectedCategory);
        }

        currentQuestionIndex = 0;
        score = 0;
        userAnswers = Array(questions.length).fill(null);
        updateProgressBar();

        if (questions.length > 0) {
            showQuestion();
        } else {
            showNoQuestionsMessage();
        }
    } catch (error) {
        console.error('خطأ في تصفية الأسئلة:', error);
        elements.quizLoading.style.display = 'none';
        showError('حدث خطأ في تصفية الأسئلة');
    }
}

// تحديث قوائم التصنيفات
function updateCategoryFilters() {
    try {
        elements.categorySelect.innerHTML = '';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category === 'all' ? 'جميع التصنيفات' : category;
            elements.categorySelect.appendChild(option);
        });

        elements.categoryFilter.style.display = categories.size > 2 ? 'block' : 'none';
    } catch (error) {
        console.error('خطأ في تحديث قوائم التصنيفات:', error);
    }
}

// بدء الاختبار
function startQuiz() {
    try {
        // منع بدء الاختبار مرات متعددة
        if (isQuizStarted) {
            console.log('الاختبار قيد البدء بالفعل، سيتم تجاهل الطلب الحالي');
            return;
        }

        isQuizStarted = true;
        if (elements.quizLoading) elements.quizLoading.style.display = 'none';
        setCleanQuizTitle(); // عنوان نظيف باسم المادة فقط (بدون مسار)
        currentQuestionIndex = 0;
        score = 0;
        userAnswers = Array(questions.length).fill(null);
        quizStartTime = new Date();
        showQuestion();
        updateProgressBar();
        elements.quizContainer.style.display = 'block';
        elements.resultsContainer.style.display = 'none';
        console.log('تم بدء الاختبار بعدد أسئلة:', questions.length);
    } catch (error) {
        console.error('خطأ في بدء الاختبار:', error);
        showError('حدث خطأ في بدء الاختبار');
        isQuizStarted = false;
    }
}

// تحديث شريط التقدم
function updateProgressBar() {
    try {
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
        elements.progressBar.style.width = `${progress}%`;
    } catch (error) {
        console.error('خطأ في تحديث شريط التقدم:', error);
    }
}

// عرض السؤال الحالي
function showQuestion() {
    try {
        if (currentQuestionIndex >= questions.length) {
            submitQuiz();
            return;
        }

        const question = questions[currentQuestionIndex];
        let questionHTML = '';

        questionHTML += `
            <div class="question">
                <h3><span class="question-number">${currentQuestionIndex + 1}</span> ${escapeHtml(question.text)}</h3>
        `;

        if (question.type === 'mcq') {
            questionHTML += `<div class="options">`;

            for (let i = 1; i <= 4; i++) {
                const option = question[`option${i}`];
                if (!option) continue;

                const isSelected = userAnswers[currentQuestionIndex] === i.toString();
                questionHTML += `
                    <div class="option ${isSelected ? 'selected' : ''}" data-answer="${i}">
                        ${escapeHtml(option)}
                        <i class="fas fa-check option-icon"></i>
                    </div>
                `;
            }

            questionHTML += `</div>`;
        } else {
            questionHTML += `
                <div class="true-false-options">
                    <div class="true-false-btn ${userAnswers[currentQuestionIndex] === 'true' ? 'selected' : ''}" data-answer="true">
                        <i class="fas fa-check"></i> صح
                    </div>
                    <div class="true-false-btn ${userAnswers[currentQuestionIndex] === 'false' ? 'selected' : ''}" data-answer="false">
                        <i class="fas fa-times"></i> خطأ
                    </div>
                </div>
            `;
        }

        questionHTML += `</div>`;
        elements.questionContainer.innerHTML = questionHTML;

        if (question.type === 'mcq') {
            const options = document.querySelectorAll('.option');
            options.forEach(option => {
                option.addEventListener('click', () => {
                    options.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    userAnswers[currentQuestionIndex] = option.dataset.answer;
                });
            });
        } else {
            const trueFalseBtns = document.querySelectorAll('.true-false-btn');
            trueFalseBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    trueFalseBtns.forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    userAnswers[currentQuestionIndex] = btn.dataset.answer;
                });
            });
        }

        elements.prevBtn.disabled = currentQuestionIndex === 0;
        elements.nextBtn.style.display = currentQuestionIndex < questions.length - 1 ? 'flex' : 'none';
        elements.submitBtn.style.display = currentQuestionIndex === questions.length - 1 ? 'flex' : 'none';
    } catch (error) {
        console.error('خطأ في عرض السؤال:', error);
        showError('حدث خطأ في عرض السؤال');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// الانتقال إلى السؤال التالي
function nextQuestion() {
    try {
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            showQuestion();
            updateProgressBar();
        }
    } catch (error) {
        console.error('خطأ في الانتقال للسؤال التالي:', error);
        showError('حدث خطأ في الانتقال للسؤال التالي');
    }
}

// العودة إلى السؤال السابق
function prevQuestion() {
    try {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            showQuestion();
            updateProgressBar();
        }
    } catch (error) {
        console.error('خطأ في العودة للسؤال السابق:', error);
        showError('حدث خطأ في العودة للسؤال السابق');
    }
}

// إرسال الاختبار
function submitQuiz() {
    try {
        showResults();
    } catch (error) {
        console.error('خطأ في إرسال الاختبار:', error);
        showError('حدث خطأ في إرسال الاختبار');
    }
}

// عرض النتائج
function showResults() {
    try {
        score = 0;
        let feedbackHTML = '<h3>التصحيح:</h3><ul>';

        questions.forEach((question, index) => {
            const userAnswer = userAnswers[index];
            const isCorrect = userAnswer === question.correctAnswer;

            if (isCorrect) {
                score++;
            }

            feedbackHTML += `<li>
                <strong>السؤال ${index + 1}:</strong> ${escapeHtml(question.text)}<br>
                <span style="color: ${isCorrect ? 'green' : 'red'}">
                    إجابتك: ${formatAnswer(question, userAnswer)} -
                    ${isCorrect ? 'صحيح' : 'خطأ (الإجابة الصحيحة: ' + formatAnswer(question, question.correctAnswer) + ')'}
                </span>
            </li><br>`;
        });

        feedbackHTML += '</ul>';

        elements.quizContainer.style.display = 'none';
        elements.resultsContainer.style.display = 'block';
        elements.scoreDisplay.textContent = score;

        const percentage = Math.round((score / questions.length) * 100);
        elements.percentageDisplay.textContent = `${percentage}%`;

        let medal = '';
        if (percentage >= 90) {
            medal = '<i class="fas fa-medal gold"></i>';
        } else if (percentage >= 75) {
            medal = '<i class="fas fa-medal silver"></i>';
        } else if (percentage >= 50) {
            medal = '<i class="fas fa-medal bronze"></i>';
        }
        elements.percentageDisplay.innerHTML += ` ${medal}`;

        const timeTaken = calculateTimeTaken();
        elements.timeTakenDisplay.textContent = timeTaken;
        elements.feedbackDisplay.innerHTML = feedbackHTML;

        saveQuizResult(score, questions.length, timeTaken);
        trackQuizCompletion(score, percentage, timeTaken);

        console.log('تم عرض النتائج: الدرجة', score, 'من', questions.length);
    } catch (error) {
        console.error('خطأ في عرض النتائج:', error);
        showError('حدث خطأ في عرض النتائج');
    }
}

// تتبع إكمال الاختبار
function trackQuizCompletion(score, percentage, timeTaken) {
    try {
        const userId = localStorage.getItem('userId');
        const quizSession = {
            userId: userId,
            timestamp: new Date().toISOString(),
            action: 'quiz_complete',
            score: score,
            percentage: percentage,
            timeTaken: timeTaken,
            year: selectedYear,
            section: selectedSection,
            subject: selectedSubject,
            lesson: selectedLesson,
            sublesson: selectedSublesson
        };

        userStats.userActivities.push(quizSession);

        const userQuizCount = userStats.userActivities.filter(a =>
            a.userId === userId && a.action === 'quiz_complete'
        ).length;

        if (userQuizCount >= 3) {
            userStats.permanentUsers.add(userId);
        }

        if (userStats.userActivities.length > 100) {
            userStats.userActivities = userStats.userActivities.slice(-100);
        }

        saveUserStats();
        saveUserActivityToFirebase(quizSession);
    } catch (error) {
        console.error('خطأ في تتبع إكمال الاختبار:', error);
    }
}

// حساب الوقت المستغرق
function calculateTimeTaken() {
    try {
        if (!quizStartTime) return '00:00';

        const endTime = new Date();
        const timeDiff = endTime - quizStartTime;

        const minutes = Math.floor(timeDiff / 60000);
        const seconds = Math.floor((timeDiff % 60000) / 1000);

        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    } catch (error) {
        console.error('خطأ في حساب الوقت:', error);
        return '00:00';
    }
}

// حفظ نتيجة الاختبار
function saveQuizResult(score, totalQuestions, timeTaken) {
    try {
        const result = {
            score,
            totalQuestions,
            percentage: Math.round((score / totalQuestions) * 100),
            timestamp: new Date().toISOString(),
            timeTaken: timeTaken,
            year: selectedYear,
            section: selectedSection,
            subject: selectedSubject,
            lesson: selectedLesson,
            sublesson: selectedSublesson,
            userId: currentUser ? currentUser.id : null,
            userName: currentUser ? currentUser.name : 'زائر'
        };

        const resultsRef = database.ref('quizResults');
        resultsRef.push(result)
            .catch(error => {
                console.error('Error saving quiz result:', error);
            });
    } catch (error) {
        console.error('خطأ في حفظ نتيجة الاختبار:', error);
    }
}

// تنسيق الإجابة لعرضها
function formatAnswer(question, answer) {
    try {
        if (!answer) return 'لم يتم الإجابة';

        if (question.type === 'mcq') {
            return question[`option${answer}`] || answer;
        } else {
            return answer === 'true' ? 'صح' : 'خطأ';
        }
    } catch (error) {
        console.error('خطأ في تنسيق الإجابة:', error);
        return 'خطأ في التنسيق';
    }
}

// إعادة الاختبار
function restartQuiz() {
    try {
        isQuizStarted = false; // إعادة تعيين العلم لبدء اختبار جديد
        elements.quizContainer.style.display = 'block';
        elements.resultsContainer.style.display = 'none';
        currentQuestionIndex = 0;
        userAnswers = Array(questions.length).fill(null);
        startQuiz();
    } catch (error) {
        console.error('خطأ في إعادة الاختبار:', error);
        showError('حدث خطأ في إعادة الاختبار');
    }
}

// تعيين عنوان الاختبار باسم المادة فقط (دون إظهار المسار)
function setCleanQuizTitle() {
    try {
        const subj = subjects.find(s => s.id === selectedSubject);
        if (elements.quizTitle) {
            elements.quizTitle.textContent = subj && subj.name ? subj.name : 'الاختبار';
        }
    } catch (error) {
        console.error('خطأ في تعيين عنوان الاختبار:', error);
    }
}

// الحصول على نص الصف الدراسي
function getYearText(year) {
    switch(year) {
        case 'secondary1': return 'الصف الأول الثانوي';
        case 'secondary2': return 'الصف الثاني الثانوي';
        case 'secondary3': return 'الصف الثالث الثانوي';
        default: return '';
    }
}

// عرض رسالة عدم وجود إختبارات
function showNoQuestionsMessage() {
    try {
        if (elements.quizLoading) elements.quizLoading.style.display = 'none';
        elements.questionContainer.innerHTML = `
            <div class="no-questions" style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-info-circle" style="font-size: 64px; color: var(--primary); margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 15px;">لا توجد إختبارات متاحة</h3>
                <p style="color: var(--text-secondary); font-size: 16px;">لا توجد إختبارات متاحة حالياً للصف والقسم المحدد.</p>
            </div>
        `;
        elements.nextBtn.style.display = 'none';
        elements.submitBtn.style.display = 'none';
    } catch (error) {
        console.error('خطأ في عرض رسالة عدم وجود أسئلة:', error);
    }
}

// عرض رسالة خطأ
function showError(message) {
    try {
        alert(message);
    } catch (error) {
        console.error('خطأ في عرض رسالة الخطأ:', error);
    }
}

// مراقبة حالة الاختبار
function checkExamStatus() {
    try {
        const examStatusRef = database.ref('examStatus');
        examStatusRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                examActive = snapshot.val().active;
                defaultExamTime = snapshot.val().time || 10;

                if (!examActive) {
                    elements.yearSelectionContainer.innerHTML = `
                        <div class="no-questions" style="grid-column: 1 / -1; text-align: center; padding: 60px;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: var(--warning); margin-bottom: 20px;"></i>
                            <h3 style="margin-bottom: 15px;">الاختبارات متوقفة حالياً</h3>
                            <p style="color: var(--text-secondary);">الرجاء المحاولة لاحقاً عندما يتم تفعيل الاختبارات من قبل المسؤول</p>
                        </div>
                    `;
                }
            } else {
                examStatusRef.set({
                    active: true,
                    time: 10
                });
            }
        }, (error) => {
            console.error('خطأ في مراقبة حالة الاختبار:', error);
        });
    } catch (error) {
        console.error('خطأ في دالة مراقبة حالة الاختبار:', error);
    }
}

// استعادة الحالة المحفوظة
function restoreSavedState() {
    try {
        if (savedState.selectedYear) {
            selectedYear = savedState.selectedYear;

            if (savedState.selectedLesson) {
                selectedLesson = savedState.selectedLesson;
            }

            if (savedState.selectedSublesson) {
                selectedSublesson = savedState.selectedSublesson;
            }
        }
    } catch (error) {
        console.error('خطأ في استعادة الحالة:', error);
    }
}

// حفظ الحالة الحالية
function saveCurrentState() {
    try {
        const state = {
            user: currentUser,
            selectedYear: selectedYear,
            selectedSection: selectedSection,
            selectedSubject: selectedSubject,
            selectedLesson: selectedLesson,
            selectedSublesson: selectedSublesson
        };
        localStorage.setItem('quizState', JSON.stringify(state));
    } catch (error) {
        console.error('خطأ في حفظ الحالة:', error);
    }
}

// تحميل الإعلان
function loadAd() {
    try {
        const adsRef = database.ref('ads');
        adsRef.once('value', (snapshot) => {
            if (snapshot.exists()) {
                const ad = snapshot.val();
                if (ad.status === 'active') {
                    currentAd = ad;
                    localStorage.setItem('currentAd', JSON.stringify(ad));
                    displayAd(ad);
                    return;
                }
            }

            if (currentAd && currentAd.status === 'active') {
                displayAd(currentAd);
            }
        }, (error) => {
            console.error('خطأ في تحميل الإعلان:', error);
        });
    } catch (error) {
        console.error('خطأ في دالة تحميل الإعلان:', error);
    }
}

// عرض الإعلان
function displayAd(ad) {
    try {
        if (ad && ad.status === 'active') {
            elements.adTitle.textContent = ad.title;
            elements.adDescription.textContent = ad.description;
            elements.adContainer.style.display = 'block';

            if (ad.url) {
                elements.adAction.style.display = 'inline-flex';
            } else {
                elements.adAction.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('خطأ في عرض الإعلان:', error);
    }
}

// ===== معالجة الرابط المباشر بعد اكتمال تحميل كل البيانات =====
function tryHandleDirectLink() {
    try {
        if (directLinkHandled) return;
        // ننتظر حتى تكتمل جميع البيانات لضمان الفتح الصحيح
        if (!(sectionsLoaded && subjectsLoaded && lessonsLoaded && sublessonsLoaded)) return;

        directLinkHandled = true;

        if (subjectFromUrl) {
            // رابط مادة مباشر -> فتح اختبار المادة فقط
            openSubjectDirect(subjectFromUrl);
        } else if (sectionFromUrl) {
            // رابط قسم مباشر -> فتح القسم مباشرة (بدون شاشة "اختر القسم")
            openSectionDirect(sectionFromUrl);
        } else {
            // لا يوجد رابط مباشر -> قفل الموقع تماماً أمام الطالب
            showLockScreen();
        }
    } catch (error) {
        console.error('خطأ في معالجة الرابط المباشر:', error);
    }
}

// إخفاء كل الشاشات
function hideAllScreens() {
    [
        elements.yearSelectionContainer,
        elements.sectionSelectionContainer,
        elements.subjectSelectionContainer,
        elements.lessonSelectionContainer,
        elements.sublessonSelectionContainer,
        elements.quizContainer,
        elements.resultsContainer
    ].forEach(el => { if (el) el.style.display = 'none'; });
}

// فتح المادة الخاصة بالرابط مباشرة (وقفل كل ما عداها)
function openSubjectDirect(subjectId) {
    try {
        const subject = subjects.find(s => s.id === subjectId);
        if (!subject) {
            showLockScreen('عذراً، المادة المطلوبة غير موجودة أو تم حذفها.');
            return;
        }

        // ضبط السياق الكامل المطلوب لتصفية الأسئلة
        selectedSubject = subject.id;
        selectedSection = subject.sectionId || '';
        const sec = sections.find(s => s.id === selectedSection);
        selectedYear = sec && sec.grades && sec.grades.length ? sec.grades[0] : '';
        selectedLesson = '';
        selectedSublesson = '';

        // عنوان نظيف باسم المادة فقط (بدون إظهار المسار)
        elements.quizTitle.textContent = subject.name || '';

        // إخفاء كل الشاشات والدخول مباشرة إلى اختبار هذه المادة
        hideAllScreens();
        elements.quizContainer.style.display = 'block';
        loadQuestions();

        console.log('تم فتح اختبار المادة مباشرة عبر الرابط:', subject.name);
    } catch (error) {
        console.error('خطأ في فتح المادة من الرابط:', error);
        showLockScreen('حدث خطأ في فتح المادة المطلوبة.');
    }
}

// فتح القسم الخاص بالرابط مباشرة (بدون شاشة "اختر القسم" ولا المسار)
function openSectionDirect(sectionId) {
    try {
        const section = sections.find(s => s.id === sectionId);
        if (!section || !section.grades || !section.grades.length) {
            showLockScreen('عذراً، القسم المطلوب غير موجود أو تم حذفه.');
            return;
        }

        selectedYear = section.grades[0];
        selectedSection = sectionId;
        selectedSubject = '';
        selectedLesson = '';
        selectedSublesson = '';

        // إن كان القسم يحتوي مادة واحدة فقط -> ادخل اختبارها مباشرة
        const sectionSubjects = subjects.filter(s => s.sectionId === sectionId);
        if (sectionSubjects.length === 1) {
            openSubjectDirect(sectionSubjects[0].id);
            return;
        }

        // أكثر من مادة -> اعرض مواد هذا القسم فقط (بدون شاشة اختيار القسم)
        hideAllScreens();
        loadSubjectsForSection(sectionId);
        if (elements.quizLoading) elements.quizLoading.style.display = 'none';

        console.log('تم فتح القسم مباشرة عبر الرابط:', section.name);
    } catch (error) {
        console.error('خطأ في فتح القسم من الرابط:', error);
        showLockScreen('حدث خطأ في فتح القسم المطلوب.');
    }
}

// شاشة القفل: تمنع الطالب من رؤية أي محتوى دون رابط مادة
function showLockScreen(message) {
    try {
        hideAllScreens();
        if (elements.adContainer) elements.adContainer.style.display = 'none';

        const container = elements.yearSelectionContainer;
        if (!container) return;
        container.style.display = 'block';
        container.innerHTML = `
            <div class="card" style="text-align:center; padding:50px 26px;">
                <i class="fas fa-lock" style="font-size:60px; background:var(--gradient-primary); -webkit-background-clip:text; background-clip:text; color:transparent; margin-bottom:20px;"></i>
                <h2 style="background:var(--gradient-primary); -webkit-background-clip:text; background-clip:text; color:transparent; font-weight:900; margin-bottom:14px;">الوصول عبر رابط المادة فقط</h2>
                <p style="color:var(--text-secondary); font-size:1.05rem; line-height:1.9; max-width:460px; margin:0 auto;">
                    ${message || 'هذه المنصة تُفتح من خلال الرابط الخاص بكل مادة فقط.<br>يرجى استخدام رابط المادة الذي حصلت عليه من معلمك للوصول إلى الاختبار.'}
                </p>
                <div class="social-icons" style="margin-top:26px;">
                    <a href="https://whatsapp.com/channel/0029Vb6rrG2LdQehV1jBg22A" target="_blank" class="icon whatsapp"><i class="fab fa-whatsapp"></i></a>
                    <a href="https://www.facebook.com/share/1EvrxveXPn/" target="_blank" class="icon facebook"><i class="fab fa-facebook"></i></a>
                    <a href="https://youtube.com/@selahalazhary?si=XU1yeb9L40NZr9p8" target="_blank" class="icon youtube"><i class="fab fa-youtube"></i></a>
                    <a href="https://t.me/alazher2026" target="_blank" class="icon telegram"><i class="fab fa-telegram"></i></a>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('خطأ في عرض شاشة القفل:', error);
    }
}

// عرض الصفوف للمستخدم العادي
function displayYears() {
    try {
        const years = [
            { id: 'secondary1', name: 'الصف الأول الثانوي', icon: 'fas fa-book', description: 'اختبارات الصف الأول الثانوي' },
            { id: 'secondary2', name: 'الصف الثاني الثانوي', icon: 'fas fa-book-reader', description: 'اختبارات الصف الثاني الثانوي' },
            { id: 'secondary3', name: 'الصف الثالث الثانوي', icon: 'fas fa-graduation-cap', description: 'اختبارات الصف الثالث الثانوي' }
        ];

        elements.yearSelectionContainer.innerHTML = '';

        years.forEach(year => {
            const yearCard = document.createElement('div');
            yearCard.className = 'year-card';
            yearCard.dataset.year = year.id;
            yearCard.innerHTML = `
                <i class="${year.icon}"></i>
                <h3>${year.name}</h3>
                <p>${year.description}</p>
            `;

            yearCard.addEventListener('click', function() {
                try {
                    selectedYear = this.dataset.year;
                    elements.yearSelectionContainer.style.display = 'none';
                    elements.sectionSelectionContainer.style.display = 'block';

                    const yearText = getYearText(selectedYear);
                    elements.quizTitle.textContent = `اختبار إختبارات سلاح الأزهري - ${yearText}`;

                    loadSectionsForYear(selectedYear);
                    saveCurrentState();
                } catch (error) {
                    console.error('خطأ في اختيار السنة:', error);
                    showError('حدث خطأ في اختيار السنة');
                }
            });

            elements.yearSelectionContainer.appendChild(yearCard);
        });
    } catch (error) {
        console.error('خطأ في عرض السنوات:', error);
        showError('حدث خطأ في عرض السنوات');
    }
}

// بدء التطبيق
document.addEventListener('DOMContentLoaded', () => {
    try {
        // initApp يحمّل كل البيانات؛ وبعد اكتمالها يُستدعى tryHandleDirectLink()
        // الذي: يفتح المادة الخاصة بالرابط فقط، أو يقفل الموقع إن لم يوجد رابط.
        console.log('بدء التطبيق - نظام روابط المواد المقفلة');
        initApp();
    } catch (error) {
        console.error('خطأ في تهيئة التطبيق:', error);
        showError('حدث خطأ في بدء التطبيق');
    }
});
