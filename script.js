/**
 * KidsGate - Dark Web Portal Script Engine
 */

// 1. Supabase Konfiqurasiyası və Qoşulma
const SUPABASE_URL = 'https://xxruhthpxxmcnigogreh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4cnVodGhweHhtY25pZ29ncmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1OTU2NzksImV4cCI6MjEwMDE3MTY3OX0.ace0D6OaDcbmFnw8GHKPAgvBAg7vKa8Sg9HlUbkZrOo';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    // UI Ekran Elementləri
    const formScreen = document.getElementById('registrationForm');
    const waitingScreen = document.getElementById('waitingScreen');
    const scheduleScreen = document.getElementById('scheduleScreen');
    const approvedScreen = document.getElementById('approvedScreen');
    const rejectedScreen = document.getElementById('rejectedScreen');

    // Dinamik Mətn Elementləri
    const waitName = document.getElementById('waitName');
    const waitSchoolClass = document.getElementById('waitSchoolClass');
    const waitPhone = document.getElementById('waitPhone');
    const countdownText = document.getElementById('countdownText');
    const rejectTitle = document.getElementById('rejectTitle');
    const finalScheduleText = document.getElementById('finalScheduleText');

    // Cədvəl Seçim Elementləri
    const daysSelect = document.getElementById('daysSelect');
    const timeSelect = document.getElementById('timeSelect');
    const submitScheduleBtn = document.getElementById('submitScheduleBtn');

    // İdarəetmə Dəyişənləri
    let countdownInterval = null;
    let activeTimer = 30;
    let realtimeChannel = null;
    let currentRequestId = null;
    let loadedSchedules = [];

    /**
     * Bütün ekranları gizlədib yalnız seçilmiş ekranı göstərən funksiya
     */
    function showScreen(screen) {
        [formScreen, waitingScreen, scheduleScreen, approvedScreen, rejectedScreen].forEach(s => {
            if (s) s.classList.add('hidden');
        });
        if (screen) screen.classList.remove('hidden');
    }

    /**
     * 1. QEYDİYYAT FORMU GÖNDƏRİLDİKDƏ (Form Submit)
     */
    if (formScreen) {
        formScreen.addEventListener('submit', async function (e) {
            e.preventDefault();

            const studentData = {
                student_name: document.getElementById('studentName').value.trim(),
                student_surname: document.getElementById('studentSurname').value.trim(),
                school: document.getElementById('studentSchool').value.trim(),
                class_name: document.getElementById('studentClass').value.trim(),
                phone: document.getElementById('studentPhone').value.trim(),
                status: 'PENDING'
            };

            // Supabase 'login_requests' cədvəlinə məlumat əlavə edirik
            const { data, error } = await supabaseClient
                .from('login_requests')
                .insert([studentData])
                .select();

            if (error) {
                console.error("Supabase xətası:", error.message);
                alert("Sorğu göndərilərkən xəta baş verdi: " + error.message);
                return;
            }

            currentRequestId = data[0].id;

            // Gözləmə ekranındakı məlumatları yeniləyirik
            waitName.textContent = `${studentData.student_name} ${studentData.student_surname}`;
            waitSchoolClass.textContent = `${studentData.school} / ${studentData.class_name}`;
            waitPhone.textContent = studentData.phone;

            showScreen(waitingScreen);
            startCountdown();

            // Supabase Realtime ilə canlı statusu izləyirik
            listenToStatusChange(currentRequestId);
        });
    }

    /**
     * 2. CANLI STATUSU İZLƏMƏK (Realtime Subscription)
     */
    function listenToStatusChange(requestId) {
        realtimeChannel = supabaseClient
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
                        stopTimer();
                        handleStatusChange(newStatus);
                    }
                }
            )
            .subscribe();
    }

    /**
     * 3. TƏSDİQ, İMTİNA VƏ TAYMAUT STATUSUNUN İDARƏ EDİLMƏSİ
     */
    function handleStatusChange(status) {
        stopTimer();

        if (status === 'APPROVED') {
            // Sorğu təsdiqləndi -> Cədvəl seçimi ekranını açırıq
            openScheduleSelection();
        } else if (status === 'REJECTED') {
            rejectTitle.textContent = "Giriş İmtina Edildi";
            showScreen(rejectedScreen);
        } else if (status === 'TIMEOUT') {
            rejectTitle.textContent = "Taymaut Başa Çatdı";
            showScreen(rejectedScreen);
        }
    }

    /**
     * 4. CƏDVƏL SEÇİMİ EKRANINI AÇMAQ VƏ BAZADAN MƏLUMATLARI ÇƏKMƏK
     */
    async function openScheduleSelection() {
        showScreen(scheduleScreen);
        await fetchScheduleData();

        // Cədvəllər bazada dəyişərsə canlı yeniləmək üçün kanala abunə oluruq
        supabaseClient.channel('public:schedule_options')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_options' }, () => {
                fetchScheduleData();
            })
            .subscribe();
    }

    /**
     * Supabase 'schedule_options' cədvəlindən günləri gətirir
     */
    async function fetchScheduleData() {
        const { data, error } = await supabaseClient
            .from('schedule_options')
            .select('*');

        if (error) {
            console.error("Cədvəl məlumatları alınarkən xəta:", error.message);
            return;
        }

        if (data) {
            loadedSchedules = data;
            daysSelect.innerHTML = '<option value="">-- Günləri Seçin --</option>';

            data.forEach(item => {
                const dayText = item.day_option || item.gün_seçimi;
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = dayText;
                daysSelect.appendChild(opt);
            });
        }
    }

    /**
     * Gün seçildikdə uyğun dərs saatlarını dolduran funksiya
     */
    if (daysSelect) {
        daysSelect.addEventListener('change', () => {
            const selectedId = daysSelect.value;
            timeSelect.innerHTML = '<option value="">-- Saatı Seçin --</option>';

            const selectedOption = loadedSchedules.find(x => x.id == selectedId);
            if (selectedOption) {
                const times = selectedOption.time_slots || selectedOption.vaxt_boşluğu || [];
                times.forEach(time => {
                    const opt = document.createElement('option');
                    opt.value = time;
                    opt.textContent = time;
                    timeSelect.appendChild(opt);
                });
            }
        });
    }

    /**
     * Cədvəl seçimini 'student_schedules' cədvəlinə yazmaq və təsdiqləyib yekun ekrana keçid
     */
    if (submitScheduleBtn) {
        submitScheduleBtn.addEventListener('click', async () => {
            if (!daysSelect.value || !timeSelect.value) {
                alert("Lütfən həm günü, həm də saatı seçin!");
                return;
            }

            const dayText = daysSelect.options[daysSelect.selectedIndex].text;
            const timeText = timeSelect.value;

            // Düyməni gözləmə rejiminə keçiririk
            submitScheduleBtn.disabled = true;
            submitScheduleBtn.textContent = "Yadda saxlanılır...";

            // Şagird məlumatlarını təkrar oxuyub yadda saxlayırıq
            const studentInfo = {
                student_name: document.getElementById('studentName').value.trim(),
                student_surname: document.getElementById('studentSurname').value.trim(),
                school: document.getElementById('studentSchool').value.trim(),
                class_name: document.getElementById('studentClass').value.trim(),
                phone: document.getElementById('studentPhone').value.trim(),
                selected_day: dayText,
                selected_time: timeText,
                request_id: currentRequestId
            };

            // Supabase 'student_schedules' cədvəlinə əlavə edirik
            const { error } = await supabaseClient
                .from('student_schedules')
                .insert([studentInfo]);

            if (error) {
                console.error("Cədvəl yadda saxlanılarkən xəta:", error.message);
                alert("Məlumatı yadda saxlamaq mümkün olmadı: " + error.message);
                submitScheduleBtn.disabled = false;
                submitScheduleBtn.textContent = "Cədvəli Təsdiqlə";
                return;
            }

            if (finalScheduleText) {
                finalScheduleText.innerHTML = `Təsdiqlənmiş Dərs Günləri: <b class="text-[var(--color-primary)]">${dayText}</b><br>Dərs Saatı: <b class="text-[var(--color-primary)]">${timeText}</b>`;
            }

            showScreen(approvedScreen);
        });
    }

    /**
     * 5. TAYMER VƏ LƏĞV ET MƏNTİQİ
     */
    function startCountdown() {
        activeTimer = 30;
        countdownText.textContent = `${activeTimer}s`;
        clearInterval(countdownInterval);

        countdownInterval = setInterval(() => {
            activeTimer--;
            countdownText.textContent = `${activeTimer}s`;

            if (activeTimer <= 0) {
                handleStatusChange("TIMEOUT");
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(countdownInterval);
        if (realtimeChannel) {
            supabaseClient.removeChannel(realtimeChannel);
        }
    }

    // Ləğv et düyməsi
    const cancelBtn = document.getElementById('cancelRequest');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            handleStatusChange("TIMEOUT");
        });
    }

    // Yenidən cəhd et düyməsi
    const retryBtn = document.getElementById('retryButton');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            if (formScreen) formScreen.reset();
            showScreen(formScreen);
        });
    }
});
