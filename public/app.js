/* InterviewLabs - Smart Interview Analyzer */

class InterviewApp {
    constructor() {
        this.currentUser = null;
        this.currentField = '';
        this.questions = [];
        this.currentVideo = null;
        this.mediaRecorder = null;
        this.mediaStream = null;
        this.recordedChunks = [];
        
        // Simple user storage (simulates a database)
        this.users = JSON.parse(localStorage.getItem('interviewlabs_users') || '[]');
        
        this.init();
    }

    async init() {
        // Check authentication
        this.checkAuth();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize app state
        if (this.currentUser) {
            this.showApp();
            this.loadUserData();
        } else {
            this.showAuth();
        }
    }

    // Enhanced checkAuth with debug info
    checkAuth() {
        this.showUserDebugInfo();
        
        const userData = localStorage.getItem('interviewlabs_user');
        if (userData) {
            try {
                this.currentUser = JSON.parse(userData);
                console.log('User found:', this.currentUser.email);
            } catch (e) {
                console.error('Invalid user data in localStorage');
                localStorage.removeItem('interviewlabs_user');
            }
        } else {
            console.log('No user found in localStorage');
        }
    }

    // Add debug function for user info
    showUserDebugInfo() {
        const userData = localStorage.getItem('interviewlabs_user');
        console.log('=== USER DEBUG INFO ===');
        console.log('Browser:', navigator.userAgent.substring(0, 100));
        console.log('Current user ', userData);
        console.log('Parsed user:', userData ? JSON.parse(userData) : null);
        console.log('All localStorage keys:', Object.keys(localStorage));
        console.log('========================');
    }

    setupEventListeners() {
        // Auth events
        this.setupAuthEvents();
        
        // Navigation events
        this.setupNavigationEvents();
        
        // Interface events
        this.setupInterfaceEvents();
        
        // Recording events
        this.setupRecordingEvents();
    }

    setupAuthEvents() {
        const authForm = document.getElementById('authForm');
        const authTabs = document.querySelectorAll('.auth-tab');
        const authSwitch = document.getElementById('authSwitch');

        if (authForm) authForm.addEventListener('submit', (e) => this.handleAuth(e));
        
        authTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.tab));
        });
        
        if (authSwitch) {
            authSwitch.addEventListener('click', () => {
                const activeTab = document.querySelector('.auth-tab.active');
                if (activeTab) {
                    this.switchAuthTab(activeTab.dataset.tab === 'signin' ? 'signup' : 'signin');
                }
            });
        }
    }

    setupNavigationEvents() {
        const logoutBtn = document.getElementById('logoutBtn');
        
        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');
                if (href === '#analyzer') {
                    this.switchTab('generate');
                } else if (href === '#history') {
                    this.switchTab('history');
                } else if (href === '#about') {
                    this.showNotification('About page - Coming soon!', 'info');
                }
            });
        });
        
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());
    }

    setupInterfaceEvents() {
        // Tab switching
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Generate questions
        const generateBtn = document.getElementById('generateQuestionsBtn');
        if (generateBtn) generateBtn.addEventListener('click', () => this.generateQuestions());

        // Analyze video
        const analyzeBtn = document.getElementById('analyzeVideoBtn');
        if (analyzeBtn) analyzeBtn.addEventListener('click', () => this.analyzeVideo());
    }

    setupRecordingEvents() {
        // Recording mode switch
        const recordOptions = document.querySelectorAll('.record-option-btn');
        recordOptions.forEach(btn => {
            btn.addEventListener('click', () => this.switchRecordMode(btn.dataset.mode));
        });

        // Recording controls
        const startRecordBtn = document.getElementById('startRecordBtn');
        const stopRecordBtn = document.getElementById('stopRecordBtn');
        
        if (startRecordBtn) startRecordBtn.addEventListener('click', () => this.startRecording());
        if (stopRecordBtn) stopRecordBtn.addEventListener('click', () => this.stopRecording());

        // File upload
        const browseFileBtn = document.getElementById('browseFileBtn');
        const videoFileInput = document.getElementById('videoFileInput');
        const uploadArea = document.getElementById('uploadArea');

        if (browseFileBtn && videoFileInput) {
            browseFileBtn.addEventListener('click', () => videoFileInput.click());
            videoFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        
        // Drag and drop
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
            uploadArea.addEventListener('click', () => {
                if (videoFileInput) videoFileInput.click();
            });
        }
    }

    switchAuthTab(tab) {
        // Update tabs
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        const targetTab = document.querySelector(`[data-tab="${tab}"]`);
        if (targetTab) targetTab.classList.add('active');

        // Update form
        const isSignUp = tab === 'signup';
        const nameGroup = document.getElementById('nameGroup');
        const nameInput = document.getElementById('name');
        const authTitle = document.getElementById('authTitle');
        const authSubtitle = document.getElementById('authSubtitle');
        const submitText = document.getElementById('submitText');
        const authSwitchText = document.getElementById('authSwitchText');

        // Handle name field visibility and required attribute
        if (nameGroup && nameInput) {
            if (isSignUp) {
                nameGroup.style.display = 'block';
                nameInput.setAttribute('required', '');
            } else {
                nameGroup.style.display = 'none';
                nameInput.removeAttribute('required');
            }
        }

        // Update text content with InterviewLabs branding
        if (authTitle) authTitle.textContent = isSignUp ? 'Join InterviewLabs' : 'Welcome Back';
        if (authSubtitle) {
            authSubtitle.textContent = isSignUp ? 
                'Create your account to start experimenting with interviews' : 
                'Sign in to continue your lab experiments';
        }
        if (submitText) submitText.textContent = isSignUp ? 'Sign Up' : 'Sign In';
        if (authSwitchText) {
            authSwitchText.innerHTML = isSignUp ? 
                'Already have an account? <span id="authSwitch">Sign in</span>' :
                'Don\'t have an account? <span id="authSwitch">Sign up</span>';

            // Re-attach event listener
            const newAuthSwitch = document.getElementById('authSwitch');
            if (newAuthSwitch) {
                newAuthSwitch.addEventListener('click', () => {
                    this.switchAuthTab(isSignUp ? 'signin' : 'signup');
                });
            }
        }
    }

    async handleAuth(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const activeTab = document.querySelector('.auth-tab.active');
        const isSignUp = activeTab ? activeTab.dataset.tab === 'signup' : false;
        
        const email = formData.get('email')?.trim();
        const password = formData.get('password')?.trim();
        const name = formData.get('name')?.trim();

        // Validation
        if (!email || !password) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        if (isSignUp && !name) {
            this.showNotification('Please enter your full name', 'error');
            return;
        }

        // Show loading state
        const submitBtn = document.querySelector('.auth-submit');
        if (!submitBtn) return;
        
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        submitBtn.disabled = true;

        // Simulate API delay
        setTimeout(() => {
            try {
                if (isSignUp) {
                    // Sign up logic
                    const existingUser = this.users.find(u => u.email === email);
                    if (existingUser) {
                        this.showNotification('An account with this email already exists', 'error');
                        return;
                    }

                    // Create new user
                    const newUser = {
                        id: Date.now(),
                        name: name,
                        email: email,
                        password: password, // In production, hash this!
                        joinDate: new Date().toISOString(),
                        sessions: []
                    };

                    this.users.push(newUser);
                    localStorage.setItem('interviewlabs_users', JSON.stringify(this.users));
                    
                    this.currentUser = newUser;
                    this.showNotification('Welcome to InterviewLabs!', 'success');
                    
                } else {
                    // Sign in logic
                    const user = this.users.find(u => u.email === email && u.password === password);
                    if (!user) {
                        this.showNotification('Invalid email or password', 'error');
                        return;
                    }

                    // Load user's sessions
                    user.sessions = JSON.parse(localStorage.getItem(`interviewlabs_sessions_${email}`) || '[]');
                    this.currentUser = user;
                    this.showNotification('Welcome back to the lab!', 'success');
                }

                // Save current user and show app
                localStorage.setItem('interviewlabs_user', JSON.stringify(this.currentUser));
                this.hideAuth();
                this.showApp();
                this.loadUserData();

            } catch (error) {
                console.error('Auth error:', error);
                this.showNotification('Authentication failed. Please try again.', 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }, 1000);
    }

    showAuth() {
        const authModal = document.getElementById('authModal');
        const app = document.getElementById('app');
        
        if (authModal) authModal.classList.remove('hidden');
        if (app) app.classList.add('hidden');
    }

    hideAuth() {
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.classList.add('hidden');
    }

    showApp() {
        const app = document.getElementById('app');
        const userName = document.getElementById('userName');
        
        if (app) app.classList.remove('hidden');
        if (userName && this.currentUser) userName.textContent = this.currentUser.name;
    }

    logout() {
        localStorage.removeItem('interviewlabs_user');
        this.currentUser = null;
        this.showAuth();
        this.showNotification('You have been logged out of the lab', 'info');
        
        // Reset form
        const authForm = document.getElementById('authForm');
        if (authForm) authForm.reset();
    }

    loadUserData() {
        if (!this.currentUser) return;
        
        const sessions = this.currentUser.sessions || [];
        
        // Update stats
        const totalSessions = document.getElementById('totalSessions');
        const avgScore = document.getElementById('avgScore');
        
        if (totalSessions) totalSessions.textContent = sessions.length;
        
        if (sessions.length > 0 && avgScore) {
            const average = (sessions.reduce((acc, s) => acc + s.rating, 0) / sessions.length).toFixed(1);
            avgScore.textContent = average;
        }

        // Load history
        this.loadHistory();
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetBtn) targetBtn.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById(`${tabName}Tab`);
        if (targetContent) targetContent.classList.add('active');

        // Hide results when switching tabs
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) resultsSection.classList.add('hidden');
    }

    // FIXED generateQuestions method
    async generateQuestions() {
        const fieldInput = document.getElementById('interviewField');
        const countSelect = document.getElementById('questionCount');
        
        if (!fieldInput || !countSelect) return;
        
        const field = fieldInput.value.trim();
        const count = countSelect.value;
        
        if (!field) {
            this.showNotification('Please enter an interview field', 'error');
            return;
        }

        this.currentField = field;
        const generateBtn = document.getElementById('generateQuestionsBtn');
        
        if (generateBtn) {
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            generateBtn.disabled = true;
        }

        try {
            console.log('Making API request to /api/questions');
            console.log('Request payload:', { field, count: parseInt(count) });
            
            const response = await fetch('/api/questions', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ field, count: parseInt(count) })
            });

            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('API response:', data);
            
            if (data.questions && data.questions.length > 0) {
                this.questions = data.questions;
                this.renderQuestions();
                this.showNotification(`Generated ${data.questions.length} lab questions successfully! (${data.source})`, 'success');
            } else {
                throw new Error('No questions returned from API');
            }
            
        } catch (error) {
            console.error('Failed to generate questions:', error);
            this.showNotification(`Failed to generate questions: ${error.message}`, 'error');
        } finally {
            if (generateBtn) {
                generateBtn.innerHTML = 'Generate Lab Questions';
                generateBtn.disabled = false;
            }
        }
    }

    renderQuestions() {
        const container = document.getElementById('questionsContainer');
        const list = document.getElementById('questionsList');
        
        if (!container || !list) return;
        
        list.innerHTML = this.questions.map((question, index) => `
            <div class="question-item">
                <div class="question-number">Question ${index + 1}</div>
                <div class="question-text">${question}</div>
            </div>
        `).join('');

        container.classList.remove('hidden');
    }

    switchRecordMode(mode) {
        // Update buttons
        document.querySelectorAll('.record-option-btn').forEach(btn => btn.classList.remove('active'));
        const targetBtn = document.querySelector(`[data-mode="${mode}"]`);
        if (targetBtn) targetBtn.classList.add('active');

        // Update modes
        document.querySelectorAll('.record-mode').forEach(m => m.classList.remove('active'));
        const targetMode = document.getElementById(`${mode}Mode`);
        if (targetMode) targetMode.classList.add('active');

        // Reset upload area if switching to upload mode
        if (mode === 'upload') {
            const uploadArea = document.getElementById('uploadArea');
            const filePreview = document.getElementById('filePreview');
            if (uploadArea) uploadArea.style.display = 'block';
            if (filePreview) filePreview.classList.add('hidden');
        }
    }

    async startRecording() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: true
            });

            const videoPreview = document.getElementById('videoPreview');
            if (!videoPreview) return;
            
            videoPreview.srcObject = this.mediaStream;

            this.mediaRecorder = new MediaRecorder(this.mediaStream);
            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.recordedChunks.push(e.data);
            };

            this.mediaRecorder.onstop = () => {
                this.currentVideo = new Blob(this.recordedChunks, { type: 'video/webm' });
                videoPreview.srcObject = null;
                videoPreview.src = URL.createObjectURL(this.currentVideo);
                videoPreview.controls = true;
                
                const analyzeBtn = document.getElementById('analyzeVideoBtn');
                if (analyzeBtn) analyzeBtn.disabled = false;
                this.showNotification('Recording completed! Ready for lab analysis.', 'success');
            };

            this.mediaRecorder.start();

            // Update UI
            const startBtn = document.getElementById('startRecordBtn');
            const stopBtn = document.getElementById('stopRecordBtn');
            
            if (startBtn && stopBtn) {
                startBtn.disabled = true;
                stopBtn.disabled = false;
                startBtn.innerHTML = '<i class="fas fa-circle" style="animation: pulse 2s infinite;"></i> Recording...';
            }

        } catch (error) {
            console.error('Camera access failed:', error);
            this.showNotification('Camera access denied. Please allow camera permissions.', 'error');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }

        // Update UI
        const startBtn = document.getElementById('startRecordBtn');
        const stopBtn = document.getElementById('stopRecordBtn');
        
        if (startBtn && stopBtn) {
            startBtn.disabled = false;
            stopBtn.disabled = true;
            startBtn.innerHTML = '<i class="fas fa-circle"></i> Start Recording';
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('video/')) {
            this.showNotification('Please select a video file', 'error');
            return;
        }

        if (file.size > 200 * 1024 * 1024) {
            this.showNotification('File size must be less than 200MB', 'error');
            return;
        }

        this.currentVideo = file;
        this.showFilePreview(file);
        
        const analyzeBtn = document.getElementById('analyzeVideoBtn');
        if (analyzeBtn) analyzeBtn.disabled = false;
        
        this.showNotification('Video file loaded successfully! Ready for lab analysis.', 'success');
    }

    showFilePreview(file) {
        const uploadArea = document.getElementById('uploadArea');
        const preview = document.getElementById('filePreview');
        const video = document.getElementById('uploadedVideo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');

        if (uploadArea) uploadArea.style.display = 'none';
        if (preview) preview.classList.remove('hidden');

        if (video) video.src = URL.createObjectURL(file);
        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            const videoFileInput = document.getElementById('videoFileInput');
            if (videoFileInput) {
                // Create new FileList
                const dt = new DataTransfer();
                dt.items.add(file);
                videoFileInput.files = dt.files;
                
                this.handleFileSelect({ target: { files: [file] } });
            }
        } else {
            this.showNotification('Please drop a video file', 'error');
        }
    }

    startAnalysis() {
        if (!this.currentVideo) {
            this.showNotification('Please record or upload a video first', 'error');
            // Switch to analyze tab
            this.switchTab('analyze');
            return;
        }
        this.analyzeVideo();
    }

    // FIXED analyzeVideo method - now sends actual video file data
    async analyzeVideo() {
        if (!this.currentVideo) {
            this.showNotification('Please record or upload a video first', 'error');
            return;
        }

        if (!this.currentField) {
            this.showNotification('Please generate questions first to set the field', 'error');
            this.switchTab('generate');
            return;
        }

        const analyzeBtn = document.getElementById('analyzeVideoBtn');
        
        // Show loading with video processing message
        if (analyzeBtn) {
            analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Video Content...';
            analyzeBtn.disabled = true;
        }

        try {
            console.log('📹 Starting actual video analysis...');
            console.log('Video file:', this.currentVideo);
            console.log('Video size:', (this.currentVideo.size / (1024 * 1024)).toFixed(2), 'MB');
            console.log('Video type:', this.currentVideo.type);
            console.log('Field:', this.currentField);
            
            // Create FormData to send actual video file
            const formData = new FormData();
            formData.append('video', this.currentVideo);
            formData.append('field', this.currentField);
            formData.append('hasVideo', 'true');
            
            console.log('📤 Uploading video for analysis...');
            
            // Send FormData (not JSON) to properly handle video file
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData  // No headers needed - browser sets multipart/form-data automatically
            });

            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Video analysis completed:', result);
            
            if (result.analysis) {
                this.showResults(result.analysis);
                this.saveSession(result.analysis);
                
                // Show appropriate success message based on actual video processing
                if (result.actualVideoProcessed) {
                    this.showNotification('🎥 Video content analyzed successfully!', 'success');
                } else {
                    this.showNotification('⚠️ Analysis completed - upload a video file for full video analysis', 'info');
                }
            } else {
                throw new Error('No analysis data received');
            }

        } catch (error) {
            console.error('❌ Video analysis failed:', error);
            this.showNotification(`Video analysis failed: ${error.message}`, 'error');
        } finally {
            if (analyzeBtn) {
                analyzeBtn.innerHTML = '<i class="fas fa-microscope"></i> Analyze Performance';
                analyzeBtn.disabled = false;
            }
        }
    }

    showResults(analysis) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsContent = document.getElementById('resultsContent');
        
        if (!resultsSection || !resultsContent) return;
        
        // Enhanced results display with video metrics if available
        let videoMetricsHTML = '';
        if (analysis.videoMetrics) {
            videoMetricsHTML = `
                <div class="result-card">
                    <h3><i class="fas fa-video"></i> Video Analysis Metrics</h3>
                    <div class="video-metrics">
                        <div class="metric-item">
                            <span class="metric-label">Speech Rate:</span>
                            <span class="metric-value">${analysis.videoMetrics.speechRate} WPM</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Eye Contact:</span>
                            <span class="metric-value">${analysis.videoMetrics.eyeContact}%</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Confidence Level:</span>
                            <span class="metric-value">${analysis.videoMetrics.confidence}%</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Clarity Score:</span>
                            <span class="metric-value">${analysis.videoMetrics.clarity}%</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        resultsContent.innerHTML = `
            <div class="result-card">
                <h3>Overall Lab Score</h3>
                <div class="score-display">
                    <div class="score-circle" style="--score-deg: ${analysis.rating * 36}deg;">
                        <span class="score-text">${analysis.rating}/10</span>
                    </div>
                    <p>${this.getScoreDescription(analysis.rating)}</p>
                </div>
            </div>
            
            ${videoMetricsHTML}
            
            <div class="result-card">
                <h3><i class="fas fa-exclamation-triangle"></i> Areas for Experimentation</h3>
                ${analysis.mistakes && analysis.mistakes.length > 0 ? 
                    analysis.mistakes.map(mistake => `
                        <div class="issue-item">
                            <div class="timestamp">${mistake.timestamp}</div>
                            <p>${mistake.text}</p>
                        </div>
                    `).join('') 
                    : '<p style="color: #10b981;">Excellent! No major issues detected in this lab session.</p>'
                }
            </div>
            
            <div class="result-card">
                <h3><i class="fas fa-lightbulb"></i> Lab Recommendations</h3>
                ${analysis.tips && analysis.tips.length > 0 ? 
                    analysis.tips.map(tip => `
                        <div class="tip-item">
                            <i class="fas fa-check-circle"></i>
                            <p>${tip}</p>
                        </div>
                    `).join('') 
                    : '<p>No specific recommendations available.</p>'
                }
            </div>
        `;

        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    getScoreDescription(rating) {
        if (rating >= 9) return 'Outstanding lab results! You\'re interview-ready.';
        if (rating >= 7) return 'Good performance with areas to experiment and improve.';
        if (rating >= 5) return 'Average results. Continue experimenting to enhance your skills.';
        return 'Room for improvement. Keep experimenting in the lab!';
    }

    saveSession(analysis) {
        if (!this.currentUser) return;
        
        if (!this.currentUser.sessions) {
            this.currentUser.sessions = [];
        }

        const session = {
            id: Date.now(),
            date: new Date().toISOString(),
            field: this.currentField,
            rating: analysis.rating,
            mistakes: analysis.mistakes ? analysis.mistakes.length : 0,
            tips: analysis.tips ? analysis.tips.length : 0
        };

        this.currentUser.sessions.push(session);
        
        // Save to localStorage with InterviewLabs keys
        localStorage.setItem('interviewlabs_user', JSON.stringify(this.currentUser));
        localStorage.setItem(`interviewlabs_sessions_${this.currentUser.email}`, JSON.stringify(this.currentUser.sessions));
        
        this.loadUserData();
    }

    loadHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList || !this.currentUser) return;
        
        const sessions = this.currentUser.sessions || [];

        if (sessions.length === 0) {
            historyList.innerHTML = `
                <div class="empty-history">
                    <i class="fas fa-chart-line"></i>
                    <p>No lab experiments yet. Start analyzing your interviews!</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = sessions.slice(-10).reverse().map(session => `
            <div class="history-item">
                <div class="history-info">
                    <h4>${session.field}</h4>
                    <p>${new Date(session.date).toLocaleDateString()} • ${session.mistakes} issues • ${session.tips} recommendations</p>
                </div>
                <div class="history-score">${session.rating}/10</div>
            </div>
        `).join('');
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: rgba(26, 26, 26, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-left: 4px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
            border-radius: 12px;
            padding: 1rem 1.5rem;
            backdrop-filter: blur(20px);
            color: #ffffff;
            z-index: 10000;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 350px;
            font-size: 0.9rem;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => notification.style.transform = 'translateX(0)', 100);

        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
}

// Add CSS animation for recording pulse
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    
    .video-metrics {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
        margin-top: 1rem;
    }
    
    .metric-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
    }
    
    .metric-label {
        font-size: 0.875rem;
        color: #9ca3af;
    }
    
    .metric-value {
        font-weight: bold;
        color: #10b981;
    }
`;
document.head.appendChild(style);

// Add error boundary
window.addEventListener('error', (e) => {
    console.error('Global error caught:', e.error);
    if (window.app) {
        window.app.showNotification('Something went wrong. Please refresh the page.', 'error');
    }
});

// Add offline detection
window.addEventListener('online', () => {
    if (window.app) {
        window.app.showNotification('Connection restored!', 'success');
    }
});

window.addEventListener('offline', () => {
    if (window.app) {
        window.app.showNotification('You are offline. Some features may not work.', 'error');
    }
});

// FIXED: Initialize app and assign to window.app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new InterviewApp();
    window.InterviewApp = InterviewApp; // For debugging
    console.log('InterviewLabs app initialized successfully!');
});
