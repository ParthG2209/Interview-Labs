export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const field = (req.body?.field || '').trim();
        const count = Math.max(1, Math.min(20, Number(req.body?.count) || 7));
        
        if (!field) {
            return res.status(400).json({ error: 'field is required' });
        }

        console.log(`Generating ${count} questions for field: ${field}`);

        // Enhanced fallback questions with your exact templates
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
                `How do you handle memory management and garbage collection in Java?`,
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

        // Field matching logic
        const fieldLower = field.toLowerCase();
        let selectedTemplates = [];
        
        const fieldMappings = {
            'intern': ['intern', 'internship', 'trainee', 'entry level', 'student', 'graduate'],
            'java': ['java', 'jvm', 'spring', 'hibernate'],
            'software': ['software', 'developer', 'programmer', 'engineer', 'coding', 'programming', 'backend', 'frontend', 'fullstack']
        };
        
        for (const [category, keywords] of Object.entries(fieldMappings)) {
            if (keywords.some(keyword => fieldLower.includes(keyword))) {
                selectedTemplates = fallbackTemplates[category];
                console.log(`Matched field category: ${category}`);
                break;
            }
        }
        
        // Generic fallback
        if (selectedTemplates.length === 0) {
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

        // Randomize and return
        const shuffled = [...selectedTemplates].sort(() => 0.5 - Math.random());
        const questions = shuffled.slice(0, count);

        console.log(`Returning ${questions.length} questions`);
        
        return res.status(200).json({
            questions,
            ai: false,
            source: 'api-function-fallback',
            requested: count,
            generated: questions.length
        });
        
    } catch (error) {
        console.error('Questions error:', error);
        return res.status(500).json({
            error: 'Failed to generate questions',
            details: error.message
        });
    }
}
