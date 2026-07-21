/**
 * KidsGate - Elegant Dark Web Portal Integration Engine
 */

// 1. Supabase-ə qoşulma
const SUPABASE_URL = 'https://xxruhthpxxmcnigogreh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4cnVodGhweHhtY25pZ29ncmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1OTU2NzksImV4cCI6MjEwMDE3MTY3OX0.ace0D6OaDcbmFnw8GHKPAgvBAg7vKa8Sg9HlUbkZrOo'; // Kopyaladığınız sb_publishable_... key-i bura yapışdırın

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Form Göndəriləndə Supabase Bazasına Yazmaq
document.getElementById('registrationForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const studentData = {
        student_name: document.getElementById('studentName').value,
        student_surname: document.getElementById('studentSurname').value,
        school: document.getElementById('studentSchool').value,
        class_name: document.getElementById('studentClass').value,
        phone: document.getElementById('studentPhone').value,
        status: 'PENDING'
    };

    // Supabase-ə yeni sorğu əlavə edirik
    const { data, error } = await supabase
        .from('login_requests')
        .insert([studentData])
        .select();

    if (error) {
        console.error("Xəta baş verdi:", error.message);
        return;
    }

    const currentRequestId = data[0].id;
    showScreen(waitingScreen);

    // Canlı status dəyişikliyini dinləməyə başlayırıq
    listenToStatusChange(currentRequestId);
});

// 3. Tətbiq tərəfindən status dəyişəndə (APPROVED / REJECTED) saytı CANLI yeniləmək
function listenToStatusChange(requestId) {
    const channel = supabase
        .channel('public:login_requests')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'login_requests',
                filter: `id=eq.${requestId}`
            },
            (payload) => {
                const newStatus = payload.new.status;
                console.log("Canlı status yeniləndi:", newStatus);

                if (newStatus === 'APPROVED' || newStatus === 'REJECTED') {
                    supabase.removeChannel(channel);
                    handleStatusChange(newStatus);
                }
            }
        )
        .subscribe();
}

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
