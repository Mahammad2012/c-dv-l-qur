/**
 * KidsGate - Elegant Dark Web Portal Integration Engine
 */

document.addEventListener('DOMContentLoaded', () => {
    // UI Ekranları
    const formScreen = document.getElementById('registrationForm');
    const waitingScreen = document.getElementById('waitingScreen');
    const approvedScreen = document.getElementById('approvedScreen');
    const rejectedScreen = document.getElementById('rejectedScreen');

    // Dinamik Elementlər
    const waitName = document.getElementById('waitName');
    const waitSchoolClass = document.getElementById('waitSchoolClass');
    const waitPhone = document.getElementById('waitPhone');
    const countdownText = document.getElementById('countdownText');
    const rejectTitle = document.getElementById('rejectTitle');

    // Taymer və dövri sorğu dəyişənləri
    let countdownInterval = null;
    let activeTimer = 30; // Maksimum gözləmə müddəti (30 saniyə)
    let mockPollInterval = null;

    // Real-time verilənlər bazası ünvanınız (Firebase REST API mərkəzi)
    const FIREBASE_DB_URL = "https://kidsgate-default-rtdb.firebaseio.com"; 

    /**
     * Ekranlar arası keçidi təmin edən funksiya
     */
    function showScreen(screen) {
        formScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
        approvedScreen.classList.add('hidden');
        rejectedScreen.classList.add('hidden');
        screen.classList.remove('hidden');
    }

    /**
     * Form təsdiqləndikdə icra olunan məntiq
     */
    if (formScreen) {
        formScreen.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const student = {
                ad: document.getElementById('studentName').value.trim(),
                soyad: document.getElementById('studentSurname').value.trim(),
                mekteb: document.getElementById('studentSchool').value.trim(),
                sinif: document.getElementById('studentClass').value.trim(),
                telefon: document.getElementById('studentPhone').value.trim(),
                status: "PENDING",
                timestamp: Date.now()
            };

            // Gözləmə ekranını tələbənin məlumatları ilə doldururuq
            waitName.textContent = `${student.ad} ${student.soyad}`;
            waitSchoolClass.textContent = `${student.mekteb} / ${student.sinif}`;
            waitPhone.textContent = student.telefon;

            showScreen(waitingScreen);
            startCountdown(student);

            // Sandboks testləri üçün valideyn pəncərəsinə bildiriş göndəririk
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: "NEW_REGISTRATION",
                    data: student
                }, "*");
            }

            // Real verilənlər bazasına sorğu yazmaq üçün (İstəyə bağlı aktivləşdirilə bilər):
            /*
            fetch(`${FIREBASE_DB_URL}/active_request.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(student)
            });
            */
            
            pollForStatusChange();
        });
    }

    /**
     * Geri sayım taymerini başladan funksiya
     */
    function startCountdown(student) {
        clearInterval(countdownInterval);
        activeTimer = 30;
        countdownText.textContent = `${activeTimer}s`;

        countdownInterval = setInterval(() => {
            activeTimer--;
            countdownText.textContent = `${activeTimer}s`;

            if (activeTimer <= 0) {
                clearInterval(countdownInterval);
                handleStatusChange("TIMEOUT");
            }
        }, 1000);
    }

    /**
     * Status dəyişikliklərini izləyən dövri sorğu (polling) funksiyası
     */
    function pollForStatusChange() {
        clearInterval(mockPollInterval);
        mockPollInterval = setInterval(() => {
            // Real bazada adminin qəbul/imtina cavabını izləmək üçün:
            /*
            fetch(`${FIREBASE_DB_URL}/active_request/status.json`)
                .then(r => r.json())
                .then(status => {
                    if (status && status !== "PENDING") {
                        handleStatusChange(status);
                    }
                })
                .catch(err => console.error("Bağlantı xətası: ", err));
            */
        }, 1000);
    }

    /**
     * Sandboks çərçivəsindən gələn mesajları qəbul etmək
     */
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === "STATUS_UPDATE") {
            handleStatusChange(event.data.status);
        }
    });

    /**
     * Qəbul, İmtina və ya Taymaut statusunun idarə olunması
     */
    function handleStatusChange(status) {
        clearInterval(countdownInterval);
        clearInterval(mockPollInterval);

        // Bazadakı qeydi təmizləmək üçün (İstəyə bağlı):
        /*
        fetch(`${FIREBASE_DB_URL}/active_request.json`, { method: 'DELETE' });
        */

        if (status === "APPROVED") {
            showScreen(approvedScreen);
            
            // Təsdiqləndikdən 3 saniyə sonra əsas səhifəyə avtomatik yönləndirilir
            setTimeout(() => {
                window.location.href = "https://example.com/esas-sehife"; 
            }, 3000);
        } else if (status === "REJECTED") {
            rejectTitle.textContent = "Giriş İmtina Edildi";
            showScreen(rejectedScreen);
        } else if (status === "TIMEOUT") {
            rejectTitle.textContent = "Taymaut Başa Çatdı";
            showScreen(rejectedScreen);
        }
    }

    /**
     * İstifadəçi ləğv et düyməsinə kliklədikdə
     */
    const cancelBtn = document.getElementById('cancelRequest');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            handleStatusChange("TIMEOUT");
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: "CANCEL_REQUEST" }, "*");
            }
        });
    }

    /**
     * Yenidən cəhd etmək düyməsi
     */
    const retryBtn = document.getElementById('retryButton');
    if (retryBtn) {
        retryBtn.addEventListener('click', function() {
            showScreen(formScreen);
        });
    }
});