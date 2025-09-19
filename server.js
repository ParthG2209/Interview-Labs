// server.js - Express backend for Smart Interview Analyzer

const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const https = require('https');

require('dotenv').config({ path: __dirname + '/project.env' });

console.log('=== Environment Debug ===');
console.log('COHERE_API_KEY loaded:', !!process.env.COHERE_API_KEY);
console.log('COHERE_API_KEY value (first 10 chars):', process.env.COHERE_API_KEY ? process.env.COHERE_API_KEY.substring(0, 10) + '...' : 'undefined');
console.log('========================');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

app.use(express.static(path.join(__dirname, 'public')));

// Updated Cohere API helper using the new Chat API with current models
async function callCohereAPI(message) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            message: message,
            model: 'command-r-08-2024', // Updated to current model
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

// Enhanced Questions endpoint with better field matching and current Cohere models
app.post('/api/questions', async (req, res) => {
    try {
        const field = (req.body.field || '').trim();
        const count = Math.max(1, Math.min(20, Number(req.body.count) || 7));
        
        console.log(`Generating ${count} questions for field: ${field}`);
        
        if (!field) return res.status(400).json({ error: 'field is required' });

        if (process.env.COHERE_API_KEY && process.env.COHERE_API_KEY.trim().length > 0) {
            try {
                console.log('Attempting Cohere Chat API call with field:', field, 'count:', count);
                
                // Enhanced prompt for the new Chat API
                const message = `I need you to generate exactly ${count} diverse, challenging interview questions for ${field} positions.

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
                console.log('Response structure:', {
                    hasText: !!response.text,
                    textLength: response.text ? response.text.length : 0
                });

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
                    // Match numbered questions: "1. Question text" or "1) Question text" or "1 - Question text"
                    const match = trimmed.match(/^\d+[\.\)\-\s]+(.+)/);
                    if (match && match[1] && match[1].length > 10) {
                        let question = match[1].trim();
                        
                        // Clean up the question
                        question = question.replace(/^["""]|["""]$/g, ''); // Remove quotes
                        question = question.replace(/\s+/g, ' '); // Normalize whitespace
                        
                        // Ensure question ends with question mark
                        if (!question.endsWith('?')) {
                            question += '?';
                        }
                        
                        // Skip duplicates
                        if (!questions.includes(question)) {
                            questions.push(question);
                        }
                    }
                }

                console.log('Extracted questions count:', questions.length);
                console.log('Target count:', count);
                console.log('First 3 questions:', questions.slice(0, 3));

                // If we got enough questions, return them
                if (questions.length >= Math.min(3, count)) {
                    const finalQuestions = questions.slice(0, count);
                    console.log('Returning', finalQuestions.length, 'questions');
                    
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

        // Enhanced fallback questions with better field matching including interns
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
                `How do you handle technical debt in legacy codebases?`,
                `Describe your approach to testing and quality assurance.`,
                `How would you troubleshoot a microservices architecture issue?`,
                `Tell me about a performance optimization project you worked on.`,
                `How do you ensure security best practices in your code?`,
                `Describe your experience with agile development methodologies.`,
                `How would you mentor a junior developer on your team?`,
                `Tell me about a time you had to refactor a large codebase.`,
                `How do you handle conflicting requirements from stakeholders?`,
                `Describe your approach to API design and documentation.`,
                `How would you implement a caching strategy for a web application?`
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
                `How do you manage dependencies and build processes in Java projects?`,
                `Describe a time you had to debug a Java memory leak.`,
                `How would you implement caching in a Java web application?`,
                `Tell me about your experience with Java database connectivity (JDBC).`,
                `How do you ensure thread safety in concurrent Java applications?`,
                `Describe your approach to logging and monitoring in Java applications.`,
                `How would you migrate a legacy Java application to a modern framework?`,
                `Tell me about your experience with Java application servers.`,
                `How do you handle configuration management in Java applications?`,
                `Describe a challenging Java integration project you worked on.`,
                `How would you implement security features in a Java enterprise application?`
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
                `Tell me about a time you made a mistake and how you handled it.`,
                `What interests you most about working in this field?`,
                `How would you approach a task you've never done before?`,
                `Describe your experience with version control systems like Git.`,
                `Tell me about a time you had to meet a tight deadline.`,
                `How do you balance academic work with personal projects?`,
                `What do you hope to gain from this internship experience?`,
                `Describe a technical concept you recently learned and found interesting.`,
                `How would you contribute to our team as an intern?`,
                `Tell me about a side project or personal coding project you've worked on.`,
                `How do you handle situations where you don't know the answer to something?`
            ],
            'data': [
                `How do you approach cleaning and validating large, messy datasets?`,
                `Describe a time your data analysis directly influenced a business decision.`,
                `How do you communicate complex statistical findings to non-technical stakeholders?`,
                `What's your process for building and validating predictive models?`,
                `How do you handle missing or incomplete data in your analysis?`,
                `Describe a challenging data visualization problem you solved.`,
                `How do you ensure the reliability and accuracy of your analytical results?`,
                `Tell me about a machine learning project you worked on from start to finish.`,
                `How would you design an A/B testing framework for a product team?`,
                `Describe your experience with big data tools and technologies.`,
                `How do you approach feature engineering for machine learning models?`,
                `Tell me about a time you had to work with multiple data sources.`,
                `How would you explain the concept of statistical significance to a business leader?`,
                `Describe your approach to data privacy and ethics in analytics.`,
                `How do you validate and monitor machine learning models in production?`,
                `Tell me about a time you discovered an error in a published analysis.`,
                `How would you build a real-time analytics dashboard?`,
                `Describe your experience with cloud-based data platforms.`,
                `How do you prioritize which metrics to track for a business?`,
                `Tell me about a complex SQL query you wrote to solve a business problem.`
            ],
            'marketing': [
                `Describe a successful marketing campaign you developed from start to finish.`,
                `How do you measure ROI and effectiveness of marketing initiatives?`,
                `Tell me about a time you had to pivot strategy based on poor initial results.`,
                `How do you identify and segment target audiences for campaigns?`,
                `Describe your experience with marketing automation and analytics tools.`,
                `How do you stay current with digital marketing trends and best practices?`,
                `Tell me about a time you disagreed with stakeholders on marketing strategy.`,
                `How would you approach launching a product in a new market?`,
                `Describe your experience with content marketing and SEO strategies.`,
                `How do you balance brand awareness with performance marketing goals?`,
                `Tell me about a challenging budget allocation decision you made.`,
                `How would you optimize a marketing funnel with low conversion rates?`,
                `Describe your approach to influencer and partnership marketing.`,
                `How do you handle competing priorities from different business units?`,
                `Tell me about a time you used data to change a marketing strategy.`,
                `How would you develop a go-to-market strategy for a new product?`,
                `Describe your experience with paid advertising platforms and optimization.`,
                `How do you ensure marketing messages resonate with diverse audiences?`,
                `Tell me about a crisis communication situation you managed.`,
                `How would you build and lead a high-performing marketing team?`
            ],
            'product': [
                `How do you prioritize features when everything seems important?`,
                `Describe a time you had to make a product decision with limited data.`,
                `How do you balance user needs with business objectives?`,
                `Tell me about a product launch that didn't go as planned.`,
                `How do you gather and validate customer feedback for product decisions?`,
                `Describe your approach to competitive analysis and positioning.`,
                `How would you improve user engagement for a declining product?`,
                `Tell me about a time you had to convince stakeholders to change direction.`,
                `How do you work with engineering teams to define technical requirements?`,
                `Describe your process for conducting user research and usability testing.`,
                `How would you handle conflicting feedback from different user segments?`,
                `Tell me about a successful product optimization or A/B test you ran.`,
                `How do you define and measure product success metrics?`,
                `Describe a time you had to sunset or deprecate a product feature.`,
                `How would you approach entering a new market with an existing product?`,
                `Tell me about your experience with agile development and sprint planning.`,
                `How do you stay current with industry trends and emerging technologies?`,
                `Describe a time you had to make a trade-off between quality and speed.`,
                `How would you build a product roadmap for the next 12 months?`,
                `Tell me about a time you turned user complaints into product improvements.`
            ],
            'design': [
                `Walk me through your design process from problem to solution.`,
                `How do you approach user research and incorporate findings into design?`,
                `Describe a time you had to advocate for a design decision to stakeholders.`,
                `How do you balance user needs with business constraints in your designs?`,
                `Tell me about a project where you had to design for accessibility.`,
                `How do you handle feedback and criticism of your design work?`,
                `Describe your approach to creating and maintaining design systems.`,
                `How would you improve the user experience of a complex workflow?`,
                `Tell me about a time you had to design for multiple platforms or devices.`,
                `How do you collaborate with developers to ensure design implementation?`,
                `Describe a project where you had to learn a new design tool or technique.`,
                `How do you measure the success of your design solutions?`,
                `Tell me about a time you disagreed with a client or stakeholder on design.`,
                `How would you approach redesigning an existing product with established users?`,
                `Describe your experience with user testing and iterating based on results.`,
                `How do you stay current with design trends while maintaining usability?`,
                `Tell me about a challenging information architecture problem you solved.`,
                `How would you design for users with different levels of technical expertise?`,
                `Describe a time you had to work within tight timeline constraints.`,
                `How do you prioritize which design problems to solve first?`
            ]
        };

        // Enhanced field matching - check for multiple keywords
        const fieldLower = field.toLowerCase();
        let selectedTemplates = [];
        
        // Check for specific matches first
        const fieldMappings = {
            'intern': ['intern', 'internship', 'trainee', 'entry level', 'entry-level', 'student', 'graduate'],
            'java': ['java', 'jvm', 'spring', 'hibernate'],
            'software': ['software', 'developer', 'programmer', 'engineer', 'coding', 'programming', 'backend', 'frontend', 'fullstack', 'web development'],
            'data': ['data', 'analyst', 'scientist', 'analytics', 'machine learning', 'ml', 'ai', 'statistics', 'sql'],
            'marketing': ['marketing', 'digital marketing', 'seo', 'sem', 'social media', 'campaign', 'brand'],
            'product': ['product', 'pm', 'product manager', 'product owner'],
            'design': ['design', 'ui', 'ux', 'designer', 'user experience', 'user interface', 'graphic']
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
                `Tell me about a time you had to explain complex ${field} concepts to non-experts.`,
                `How would you approach a project in ${field} with unclear requirements?`,
                `Describe your experience with tools and technologies used in ${field}.`,
                `How do you measure success in your ${field} work?`,
                `Tell me about a time you disagreed with a colleague on a ${field} approach.`,
                `How do you continue developing your skills in ${field}?`,
                `Describe a time you had to adapt to significant changes in ${field}.`,
                `How would you handle competing priorities from different stakeholders?`,
                `Tell me about a successful collaboration you had on a ${field} project.`,
                `How do you ensure quality in your ${field} deliverables?`,
                `Describe your approach to managing risk in ${field} projects.`
            ];
        }

        // Randomize and select the exact number requested
        const shuffled = [...selectedTemplates].sort(() => 0.5 - Math.random());
        const questions = shuffled.slice(0, count);

        console.log(`Returning ${questions.length} fallback questions (requested: ${count})`);

        res.json({ 
            questions, 
            ai: false,
            source: 'fallback',
            requested: count,
            generated: questions.length
        });
        
    } catch (e) {
        console.error('Questions endpoint error:', e);
        res.status(500).json({ error: 'server error', details: e.message });
    }
});

// Multer setup for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

// Enhanced video analysis endpoint with current Cohere Chat API
app.post('/api/analyze/video', upload.single('video'), async (req, res) => {
    console.log('=== VIDEO ANALYSIS START ===');
    
    try {
        const field = (req.body.field || '').trim();
        console.log('Field:', field);
        
        if (!req.file) {
            console.log('Error: No video file uploaded');
            return res.status(400).json({ error: 'video file is required' });
        }

        console.log('File uploaded:', {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        const videoPath = req.file.path;
        const id = uuidv4();
        const audioPath = path.join(UPLOAD_DIR, `${id}.wav`);

        console.log('Starting audio extraction...');
        
        // Extract audio using ffmpeg
        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .noVideo()
                .audioCodec('pcm_s16le')
                .audioChannels(1)
                .audioFrequency(16000)
                .format('wav')
                .on('start', (commandLine) => {
                    console.log('FFmpeg started');
                })
                .on('error', (err) => {
                    console.log('FFmpeg error:', err.message);
                    reject(err);
                })
                .on('end', () => {
                    console.log('Audio extraction completed');
                    resolve();
                })
                .save(audioPath);
        });

        console.log('Starting Whisper transcription...');

        // Call Whisper Python script
        const py = spawn('python', [path.join(__dirname, 'transcribe_whisper.py'), audioPath, '--output', `${audioPath}.json`], { stdio: ['ignore','pipe','pipe'] });
        
        let stderr = '';
        let stdout = '';
        py.stdout.on('data', (d) => { 
            stdout += d.toString();
        });
        py.stderr.on('data', (d) => { 
            stderr += d.toString();
        });
        
        const exitCode = await new Promise((resolve) => py.on('close', resolve));
        
        console.log('Whisper exit code:', exitCode);
        
        if (exitCode !== 0) {
            console.error('Whisper script failed:', stderr);
            try { fs.unlinkSync(audioPath); fs.unlinkSync(videoPath); } catch(e){}
            return res.status(500).json({ error: 'transcription failed', details: stderr.slice(0,1000) });
        }

        const transcriptJsonPath = `${audioPath}.json`;
        
        if (!fs.existsSync(transcriptJsonPath)) {
            console.log('Error: Transcript file does not exist');
            try { fs.unlinkSync(audioPath); fs.unlinkSync(videoPath); } catch(e){}
            return res.status(500).json({ error: 'transcript missing' });
        }

        console.log('Reading transcript...');
        const transcript = JSON.parse(fs.readFileSync(transcriptJsonPath, 'utf8'));
        const fullText = transcript.segments ? transcript.segments.map(s=>s.text).join(' ') : (transcript.text || '');
        
        console.log('Transcript:', { 
            textLength: fullText.length, 
            wordCount: fullText.split(/\s+/).filter(Boolean).length,
            segmentCount: transcript.segments ? transcript.segments.length : 0,
            firstWords: fullText.substring(0, 100)
        });

        let analysis = null;

        // Try AI-powered analysis first using new Chat API with current model
        if (process.env.COHERE_API_KEY && fullText.trim().length > 10) {
            try {
                console.log('Starting Cohere Chat AI analysis...');
                
                const analysisMessage = `You are an interview coach analyzing a candidate's response for a ${field || 'general'} position.

TRANSCRIPT:
"${fullText}"

SEGMENTS WITH TIMESTAMPS:
${transcript.segments ? transcript.segments.map(seg => 
    `${seg.start}s-${seg.end}s: "${seg.text}"`
).join('\n') : 'No segments available'}

Please analyze this interview response and provide feedback in JSON format. Focus on:
- Speech clarity and pace
- Filler words (um, uh, like)
- Answer structure and completeness
- Confidence and professionalism
- Field-specific content quality
- Use of examples and specifics

Return your analysis in this exact JSON format:
{
  "rating": [number from 1-10],
  "mistakes": [
    {"timestamp": "MM:SS", "text": "specific issue description"},
    {"timestamp": "MM:SS", "text": "another issue"}
  ],
  "tips": [
    "specific improvement suggestion 1",
    "specific improvement suggestion 2",
    "specific improvement suggestion 3"
  ],
  "summary": "brief summary of overall performance"
}`;

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
        } else {
            console.log('Skipping Cohere analysis - no API key or insufficient text');
        }

        // Fallback analysis if Cohere fails or no speech detected
        if (!analysis) {
            console.log('Using fallback analysis');
            
            const words = fullText.split(/\s+/).filter(Boolean).length;
            const fillerMatches = (fullText.match(/\b(um|uh|like|you know|so|actually|basically|right|i mean)\b/gi) || []).length;
            const sentences = Math.max(1, (fullText.match(/[.!?]/g)||[]).length);
            const avgWordsPerSentence = Math.max(1, Math.round(words / sentences));
            
            let rating = 5; // Default neutral rating
            const mistakes = [];
            const tips = [];
            
            // Handle different scenarios
            if (fullText.trim().length === 0) {
                // No speech detected
                rating = 2;
                mistakes.push({ 
                    timestamp: '00:00', 
                    text: 'No speech detected - make sure to speak clearly into the microphone' 
                });
                tips.push('Ensure your microphone is working and speak clearly');
                tips.push('Record in a quiet environment to improve audio quality');
                tips.push('Practice your responses out loud before recording');
            } else if (words < 20) {
                // Very brief response
                rating = 4;
                mistakes.push({ 
                    timestamp: '00:00', 
                    text: `Response too brief (${words} words) - provide more detailed examples` 
                });
                tips.push('Use the STAR method: Situation, Task, Action, Result');
                tips.push('Aim for 1-2 minutes per answer with specific examples');
                tips.push('Elaborate on your experience and achievements');
            } else {
                // Analyze speech content
                rating = Math.max(1, Math.min(10, 8 - (fillerMatches * 0.4) - Math.max(0, (avgWordsPerSentence-25)/5)));
                
                if (fillerMatches > 5) {
                    mistakes.push({ 
                        timestamp: '00:00', 
                        text: `Excessive filler words detected (${fillerMatches} instances) - practice pausing instead` 
                    });
                }
                
                if (avgWordsPerSentence > 30) {
                    mistakes.push({ 
                        timestamp: '00:00', 
                        text: `Very long sentences (avg ${avgWordsPerSentence} words) - break into shorter, clearer points` 
                    });
                }
                
                // General tips
                if (fillerMatches > 3) tips.push('Practice pausing briefly instead of using filler words like "um" and "uh"');
                if (avgWordsPerSentence > 25) tips.push('Structure your answers with clear, concise sentences');
                tips.push('Maintain eye contact with the camera and speak with confidence');
                tips.push(`For ${field || 'this'} interviews, include specific examples from your experience`);
            }
            
            analysis = { 
                rating: Math.round(rating), 
                mistakes, 
                tips,
                summary: `Analysis based on ${words} words spoken. ${fullText.length === 0 ? 'No speech detected.' : 'Basic speech pattern analysis performed.'}`
            };
        }

        console.log('Analysis complete:', { 
            rating: analysis.rating, 
            mistakeCount: analysis.mistakes.length, 
            tipCount: analysis.tips.length 
        });

        // Cleanup files
        try { 
            fs.unlinkSync(audioPath); 
            fs.unlinkSync(transcriptJsonPath);
            fs.unlinkSync(videoPath);
        } catch (e) { 
            console.log('Cleanup error:', e.message);
        }
        
        res.json({ analysis });
        console.log('=== VIDEO ANALYSIS COMPLETE ===');
        
    } catch (e) {
        console.error('=== VIDEO ANALYSIS ERROR ===');
        console.error('Error details:', e);
        res.status(500).json({ error: 'server error', details: e.message });
    }
});

// Simple in-memory user storage (replace with database in production)
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
            password, // In production, hash this!
            joinDate: new Date().toISOString(),
            sessions: []
        };
        
        users.set(email, user);
        
        // Return user without password
        const { password: _, ...userResponse } = user;
        res.json({ user: userResponse });
        
    } catch (error) {
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
        
        // Return user without password
        const { password: _, ...userResponse } = user;
        res.json({ user: userResponse });
        
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user sessions
app.get('/api/users/:userId/sessions', (req, res) => {
    // Find user and return sessions
    const user = Array.from(users.values()).find(u => u.id === parseInt(req.params.userId));
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ sessions: user.sessions || [] });
});

// Save user session
app.post('/api/users/:userId/sessions', (req, res) => {
    const user = Array.from(users.values()).find(u => u.id === parseInt(req.params.userId));
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.sessions) {
        user.sessions = [];
    }
    
    const session = {
        id: Date.now(),
        ...req.body,
        date: new Date().toISOString()
    };
    
    user.sessions.push(session);
    res.json({ session });
});

app.listen(PORT, () => {
    console.log('Server listening on port', PORT);
});
