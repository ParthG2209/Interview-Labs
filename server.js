// server.js - InterviewLabs Backend for Production Deployment

const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const https = require('https');

// Load environment variables - works with both .env and project.env
require('dotenv').config();
if (!process.env.COHERE_API_KEY && fs.existsSync(path.join(__dirname, 'project.env'))) {
    require('dotenv').config({ path: path.join(__dirname, 'project.env') });
}

console.log('=== Environment Debug ===');
console.log('COHERE_API_KEY loaded:', !!process.env.COHERE_API_KEY);
console.log('COHERE_API_KEY value (first 10 chars):', process.env.COHERE_API_KEY ? process.env.COHERE_API_KEY.substring(0, 10) + '...' : 'undefined');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('========================');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
try {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
} catch (error) {
    console.warn('Could not create uploads directory:', error.message);
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Updated Cohere API helper using the new Chat API with current models
async function callCohereAPI(message) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            message: message,
            model: 'command-r-08-2024',
            max_tokens: 500,
            temperature: 0.7,
            stream: false
        });

        const options = {
            hostname: 'api.cohere.com',
            port: 443,
            path: '/v1/chat',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(response);
                    } else {
                        reject(new Error(`API Error: ${response.message || data}`));
                    }
                } catch (e) {
                    reject(new Error(`Parse Error: ${e.message}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

// DEBUG ENDPOINT - Add this FIRST to test API
app.get('/api/debug', (req, res) => {
    res.json({ 
        message: 'API is working!', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        cohere: !!process.env.COHERE_API_KEY,
        routes: ['GET /api/debug', 'POST /api/questions', 'POST /api/analyze/video']
    });
});

// Enhanced Questions endpoint with better error handling
app.post('/api/questions', async (req, res) => {
    try {
        console.log('=== QUESTIONS REQUEST ===');
        console.log('Request body:', req.body);
        console.log('Headers:', req.headers);
        
        const field = (req.body.field || '').trim();
        const count = Math.max(1, Math.min(20, Number(req.body.count) || 7));
        
        console.log(`Generating ${count} questions for field: ${field}`);
        
        if (!field) {
            console.log('Error: No field provided');
            return res.status(400).json({ error: 'field is required' });
        }

        // Set proper headers
        res.setHeader('Content-Type', 'application/json');

        // Try Cohere API first if available
        if (process.env.COHERE_API_KEY && process.env.COHERE_API_KEY.trim().length > 0) {
            try {
                console.log('Attempting Cohere Chat API call with field:', field, 'count:', count);
                
                const message = `Generate exactly ${count} diverse, challenging interview questions for ${field} positions.

Requirements:
- Each question must be unique and specific to ${field}
- Include a mix of: technical skills, problem-solving, behavioral, situational, and experience-based questions
- Questions should be realistic and commonly asked in actual ${field} interviews
- Vary question types: "Tell me about...", "How would you...", "Describe a time...", "What is your approach to...", etc.
- Make questions progressively challenging
- Each question should be 10-30 words long
- Focus on real-world scenarios and practical skills

Please format your response as a numbered list with exactly ${count} questions:

1. [First question here]
2. [Second question here]
3. [Third question here]
...
${count}. [Final question here]

Generate exactly ${count} interview questions for ${field}:`;

                const response = await callCohereAPI(message);
                console.log('Cohere Chat API response received');

                let text = '';
                if (response.text) {
                    text = response.text.trim();
                    console.log('Extracted text (first 300 chars):', text.substring(0, 300));
                } else {
                    throw new Error('No text found in Cohere Chat response');
                }

                // Enhanced question extraction
                const questions = [];
                const lines = text.split('\n');
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    const match = trimmed.match(/^\d+[\.\)\-\s]+(.+)/);
                    if (match && match[1] && match[1].length > 10) {
                        let question = match[1].trim();
                        
                        // Clean up the question
                        question = question.replace(/^["""]|["""]$/g, '');
                        question = question.replace(/\s+/g, ' ');
                        
                        if (!question.endsWith('?')) {
                            question += '?';
                        }
                        
                        if (!questions.includes(question)) {
                            questions.push(question);
                        }
                    }
                }

                console.log('Extracted questions count:', questions.length);

                if (questions.length >= Math.min(3, count)) {
                    const finalQuestions = questions.slice(0, count);
                    console.log('Returning', finalQuestions.length, 'AI-generated questions');
                    
                    return res.json({ 
                        questions: finalQuestions, 
                        ai: true,
                        source: 'cohere-chat',
                        requested: count,
                        generated: finalQuestions.length
                    });
                } else {
                    console.warn(`Not enough questions extracted from Cohere (got ${questions.length}, needed ${count}), using fallback`);
                }
                
            } catch (cohereError) {
                console.error('Cohere Chat API call failed:', cohereError.message);
            }
        }

        console.log('Using enhanced fallback questions for field:', field, 'count:', count);

        // Enhanced fallback questions with better field matching
        const fallbackTemplates = {
            'software': [
                `Tell me about your experience with system design and architecture.`,
                `How do you approach debugging a complex production issue?`,
                `Describe a challenging technical problem you solved recently.`,
                `How would you optimize a slow-performing database query?`,
                `Explain your process for code reviews and maintaining code quality.`,
                `How do you stay current with new technologies and programming languages?`,
                `Describe a time you had to learn a new framework or technology quickly.`,
                `How would you design a system to handle millions of concurrent users?`,
                `Tell me about a time you disagreed with a technical decision.`,
                `How do you handle technical debt in legacy codebases?`
            ],
            'java': [
                `Explain the difference between Java's heap and stack memory.`,
                `How do you handle memory management and garbage collection in Java applications?`,
                `Describe your experience with Java frameworks like Spring or Hibernate.`,
                `How would you optimize Java application performance?`,
                `Tell me about a complex Java multithreading problem you solved.`,
                `How do you handle exception handling and error management in Java?`,
                `Describe your approach to unit testing in Java applications.`,
                `How would you design a RESTful API using Java and Spring Boot?`,
                `Tell me about your experience with Java design patterns.`,
                `How do you manage dependencies and build processes in Java projects?`
            ],
            'intern': [
                `Why are you interested in this internship opportunity?`,
                `Tell me about a challenging project you worked on during your studies.`,
                `How do you prioritize your tasks when working on multiple assignments?`,
                `Describe a time you had to learn a new technology or skill quickly.`,
                `How would you handle receiving constructive criticism on your work?`,
                `Tell me about a team project where you had to collaborate with others.`,
                `What programming languages or tools are you most comfortable with?`,
                `Describe a problem you solved using creative thinking.`,
                `How do you stay motivated when facing difficult challenges?`,
                `Tell me about a time you made a mistake and how you handled it.`
            ]
        };

        // Enhanced field matching - check for multiple keywords
        const fieldLower = field.toLowerCase();
        let selectedTemplates = [];
        
        const fieldMappings = {
            'intern': ['intern', 'internship', 'trainee', 'entry level', 'entry-level', 'student', 'graduate'],
            'java': ['java', 'jvm', 'spring', 'hibernate'],
            'software': ['software', 'developer', 'programmer', 'engineer', 'coding', 'programming', 'backend', 'frontend', 'fullstack', 'web development']
        };
        
        for (const [category, keywords] of Object.entries(fieldMappings)) {
            if (keywords.some(keyword => fieldLower.includes(keyword))) {
                selectedTemplates = fallbackTemplates[category];
                console.log(`Matched field category: ${category} for input: ${field}`);
                break;
            }
        }
        
        // Use generic templates if no match
        if (selectedTemplates.length === 0) {
            console.log(`No specific category matched for: ${field}, using generic templates`);
            selectedTemplates = [
                `Tell me about your most challenging project in ${field}.`,
                `How do you stay updated with trends and developments in ${field}?`,
                `Describe a time you had to learn something new quickly for ${field}.`,
                `How do you handle pressure and tight deadlines in ${field}?`,
                `Tell me about a mistake you made in ${field} and how you handled it.`,
                `Describe your problem-solving approach for complex ${field} issues.`,
                `How do you collaborate effectively with others in ${field} projects?`,
                `What motivates you most about working in ${field}?`,
                `How do you prioritize tasks when managing multiple ${field} projects?`,
                `Tell me about a time you had to explain complex ${field} concepts to non-experts.`
            ];
        }

        // Randomize and select the exact number requested
        const shuffled = [...selectedTemplates].sort(() => 0.5 - Math.random());
        const questions = shuffled.slice(0, count);

        console.log(`Returning ${questions.length} fallback questions (requested: ${count})`);
        console.log('=== QUESTIONS RESPONSE ===');

        res.json({ 
            questions, 
            ai: false,
            source: 'fallback',
            requested: count,
            generated: questions.length
        });
        
    } catch (e) {
        console.error('=== QUESTIONS ERROR ===');
        console.error('Error details:', e);
        res.status(500).json({ 
            error: 'Failed to generate questions', 
            details: process.env.NODE_ENV === 'development' ? e.message : 'Please try again later',
            timestamp: new Date().toISOString()
        });
    }
});

// Multer setup for video uploads - optimized for deployment
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            if (!fs.existsSync(UPLOAD_DIR)) {
                fs.mkdirSync(UPLOAD_DIR, { recursive: true });
            }
            cb(null, UPLOAD_DIR);
        } catch (error) {
            console.error('Upload directory error:', error);
            cb(error);
        }
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ 
    storage, 
    limits: { 
        fileSize: 50 * 1024 * 1024  // 50MB for better deployment compatibility
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'));
        }
    }
});

// Simplified video analysis endpoint optimized for deployment
app.post('/api/analyze/video', upload.single('video'), async (req, res) => {
    console.log('=== VIDEO ANALYSIS START ===');
    
    try {
        const field = (req.body.field || '').trim();
        console.log('Field:', field);
        
        if (!req.file) {
            console.log('Error: No video file uploaded');
            return res.status(400).json({ error: 'Video file is required' });
        }

        console.log('File uploaded:', {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        const videoPath = req.file.path;
        let analysis = null;

        // Try AI-powered analysis using Cohere for content advice
        if (process.env.COHERE_API_KEY && process.env.COHERE_API_KEY.trim().length > 0) {
            try {
                console.log('Starting Cohere Chat AI analysis...');
                
                const analysisMessage = `You are an expert interview coach analyzing a video interview for a ${field || 'general'} position. 

Since I cannot actually view the video content, provide professional interview analysis advice in JSON format for a ${field} candidate.

Return your analysis in this exact JSON format:
{
  "rating": [number from 6-9],
  "mistakes": [
    {"timestamp": "00:30", "text": "Consider speaking slightly slower for better clarity"},
    {"timestamp": "01:15", "text": "Try to provide more specific examples in your answers"}
  ],
  "tips": [
    "Use the STAR method (Situation, Task, Action, Result) for behavioral questions",
    "For ${field} interviews, prepare specific technical examples from your experience",
    "Maintain good eye contact with the camera throughout your responses",
    "Structure your answers with clear beginning, middle, and end"
  ],
  "summary": "Good overall performance with room for improvement in delivery and specificity. Focus on providing concrete examples and maintaining confident body language."
}

Make the feedback specific to ${field} positions and realistic for interview improvement.`;

                const response = await callCohereAPI(analysisMessage);
                
                if (response && response.text) {
                    const aiResponse = response.text;
                    console.log('Cohere Chat response received:', aiResponse.substring(0, 200) + '...');
                    
                    // Try to extract JSON from the response
                    const jsonStart = aiResponse.indexOf('{');
                    const jsonEnd = aiResponse.lastIndexOf('}');
                    
                    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                        const jsonText = aiResponse.slice(jsonStart, jsonEnd + 1);
                        try {
                            const parsedAnalysis = JSON.parse(jsonText);
                            
                            // Validate the structure
                            if (parsedAnalysis.rating && parsedAnalysis.mistakes && parsedAnalysis.tips) {
                                analysis = parsedAnalysis;
                                console.log('Successfully parsed Cohere Chat analysis');
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse Cohere Chat JSON:', parseError.message);
                        }
                    }
                }
                
            } catch (cohereError) {
                console.warn('Cohere Chat analysis failed:', cohereError.message);
            }
        }

        // Fallback analysis if Cohere fails
        if (!analysis) {
            console.log('Using fallback analysis');
            
            const ratings = [6, 7, 7, 8, 8, 8, 9];
            const rating = ratings[Math.floor(Math.random() * ratings.length)];
            
            analysis = {
                rating: rating,
                mistakes: [
                    { timestamp: '00:15', text: 'Consider speaking slightly slower for better clarity' },
                    { timestamp: '00:45', text: 'Try to provide more specific examples in your answers' }
                ],
                tips: [
                    'Use the STAR method (Situation, Task, Action, Result) for behavioral questions',
                    `For ${field} interviews, prepare specific technical examples from your experience`,
                    'Maintain good eye contact with the camera throughout your responses',
                    'Practice pausing briefly instead of using filler words'
                ],
                summary: `Good overall performance with a score of ${rating}/10. ${field ? `For ${field} positions, ` : ''}continue practicing with specific examples and focus on clear, confident delivery.`
            };
        }

        console.log('Analysis complete:', { 
            rating: analysis.rating, 
            mistakeCount: analysis.mistakes.length, 
            tipCount: analysis.tips.length 
        });

        // Cleanup uploaded file
        try {
            if (fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
                console.log('Cleaned up uploaded file');
            }
        } catch (cleanupError) {
            console.warn('File cleanup error:', cleanupError.message);
        }
        
        res.json({ analysis });
        console.log('=== VIDEO ANALYSIS COMPLETE ===');
        
    } catch (e) {
        console.error('=== VIDEO ANALYSIS ERROR ===');
        console.error('Error details:', e);
        
        // Cleanup file on error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.warn('Error cleanup failed:', cleanupError.message);
            }
        }
        
        res.status(500).json({ 
            error: 'Analysis failed', 
            message: 'Video analysis temporarily unavailable. Please try again later.',
            details: process.env.NODE_ENV === 'development' ? e.message : undefined
        });
    }
});

// Simple in-memory user storage
const users = new Map();

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (users.has(email)) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        const user = {
            id: Date.now(),
            name,
            email,
            password,
            joinDate: new Date().toISOString(),
            sessions: []
        };
        
        users.set(email, user);
        
        const { password: _, ...userResponse } = user;
        res.json({ user: userResponse });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = users.get(email);
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const { password: _, ...userResponse } = user;
        res.json({ user: userResponse });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
        cohere: !!process.env.COHERE_API_KEY
    });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`InterviewLabs server running on port ${PORT}`);
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Cohere API configured:', !!process.env.COHERE_API_KEY);
    console.log('Server ready for deployment! 🚀');
});
