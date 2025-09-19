export default async function handler(req, res) {
    // Enable CORS
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
        const { field = '', count = 5 } = req.body || {};
        const fieldTrimmed = field.trim();
        const questionCount = Math.max(1, Math.min(20, Number(count)));
        
        if (!fieldTrimmed) {
            return res.status(400).json({ error: 'field is required' });
        }

        console.log(`Generating ${questionCount} questions for field: ${fieldTrimmed}`);

        // Check if Cohere API key is available
        const cohereApiKey = process.env.COHERE_API_KEY;
        
        if (cohereApiKey) {
            console.log('Using Cohere AI to generate questions');
            
            try {
                // Call Cohere API
                const cohereResponse = await fetch('https://api.cohere.ai/v1/generate', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${cohereApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'command-xlarge-nightly',
                        prompt: `Generate ${questionCount} realistic interview questions for a ${fieldTrimmed} position. 

Format each question on a new line with no numbering or bullets. Make the questions:
- Behavioral and technical mix
- Relevant to ${fieldTrimmed} role
- Professional interview style
- Clear and specific

Questions:`,
                        max_tokens: 500,
                        temperature: 0.7,
                        k: 0,
                        stop_sequences: [],
                        return_likelihoods: 'NONE'
                    })
                });

                if (cohereResponse.ok) {
                    const cohereData = await cohereResponse.json();
                    const generatedText = cohereData.generations[0]?.text?.trim();
                    
                    if (generatedText) {
                        // Parse questions from response
                        const questions = generatedText
                            .split('\n')
                            .map(q => q.trim())
                            .filter(q => q.length > 10 && !q.match(/^[0-9]/)) // Remove numbers and short lines
                            .slice(0, questionCount);
                        
                        console.log(`Generated ${questions.length} questions via Cohere AI`);
                        
                        if (questions.length >= Math.min(questionCount, 3)) {
                            return res.status(200).json({
                                questions: questions.slice(0, questionCount),
                                ai: true,
                                source: 'cohere-ai',
                                requested: questionCount,
                                generated: questions.length,
                                field: fieldTrimmed
                            });
                        }
                    }
                }
                
                console.log('Cohere API failed, falling back to templates');
                
            } catch (cohereError) {
                console.error('Cohere API error:', cohereError);
            }
        } else {
            console.log('No Cohere API key found, using templates');
        }

        // Fallback to template questions
        const questionTemplates = {
            'software': [
                `Tell me about your experience with system design and architecture.`,
                `How do you approach debugging a complex production issue in ${fieldTrimmed}?`,
                `Describe a challenging technical problem you solved recently.`,
                `How would you optimize a slow-performing application or database?`,
                `Explain your process for code reviews and maintaining code quality.`,
                `How do you stay current with new technologies in ${fieldTrimmed}?`,
                `Describe a time you had to learn a new framework or technology quickly.`,
                `How would you design a system to handle millions of users?`,
                `Tell me about a time you disagreed with a technical decision.`,
                `How do you handle technical debt in legacy systems?`
            ],
            'java': [
                `Explain the difference between Java's heap and stack memory.`,
                `How do you handle memory management and garbage collection in Java?`,
                `Describe your experience with Spring framework and dependency injection.`,
                `How would you optimize Java application performance?`,
                `Tell me about a complex multithreading problem you solved in Java.`,
                `How do you handle exception handling and error management?`,
                `Describe your approach to unit testing in Java applications.`,
                `How would you design a RESTful API using Spring Boot?`,
                `Tell me about your experience with Java design patterns.`,
                `How do you manage dependencies and build processes in Java projects?`
            ],
            'intern': [
                `Why are you interested in this ${fieldTrimmed} internship opportunity?`,
                `Tell me about a challenging project you worked on during your studies.`,
                `How do you prioritize tasks when working on multiple assignments?`,
                `Describe a time you had to learn a new technology or skill quickly.`,
                `How would you handle receiving constructive criticism on your work?`,
                `Tell me about a team project where you had to collaborate effectively.`,
                `What programming languages or tools are you most comfortable with?`,
                `Describe a problem you solved using creative thinking.`,
                `How do you stay motivated when facing difficult challenges?`,
                `Tell me about a time you made a mistake and how you handled it.`
            ]
        };

        // Field matching logic
        const fieldLower = fieldTrimmed.toLowerCase();
        let selectedTemplates = [];
        
        const fieldMappings = {
            'intern': ['intern', 'internship', 'trainee', 'entry level', 'entry-level', 'student', 'graduate'],
            'java': ['java', 'jvm', 'spring', 'hibernate', 'maven', 'gradle'],
            'software': ['software', 'developer', 'programmer', 'engineer', 'coding', 'programming', 'backend', 'frontend', 'fullstack', 'web development']
        };
        
        for (const [category, keywords] of Object.entries(fieldMappings)) {
            if (keywords.some(keyword => fieldLower.includes(keyword))) {
                selectedTemplates = questionTemplates[category];
                console.log(`Matched field category: ${category}`);
                break;
            }
        }
        
        // Generic fallback if no match
        if (selectedTemplates.length === 0) {
            selectedTemplates = [
                `Tell me about your most challenging project in ${fieldTrimmed}.`,
                `How do you stay updated with trends and developments in ${fieldTrimmed}?`,
                `Describe a time you had to learn something new quickly for ${fieldTrimmed}.`,
                `How do you handle pressure and tight deadlines in ${fieldTrimmed}?`,
                `Tell me about a mistake you made in ${fieldTrimmed} and how you handled it.`,
                `Describe your problem-solving approach for complex ${fieldTrimmed} issues.`,
                `How do you collaborate effectively with others in ${fieldTrimmed} projects?`,
                `What motivates you most about working in ${fieldTrimmed}?`,
                `How do you prioritize tasks when managing multiple ${fieldTrimmed} projects?`,
                `Tell me about a time you had to explain complex ${fieldTrimmed} concepts to non-experts.`
            ];
        }

        // Randomize and return
        const shuffled = [...selectedTemplates].sort(() => 0.5 - Math.random());
        const questions = shuffled.slice(0, questionCount);

        console.log(`Returning ${questions.length} template questions`);
        
        return res.status(200).json({
            questions,
            ai: false,
            source: 'api-function-templates',
            requested: questionCount,
            generated: questions.length,
            field: fieldTrimmed
        });
        
    } catch (error) {
        console.error('Questions error:', error);
        return res.status(500).json({
            error: 'Failed to generate questions',
            details: error.message
        });
    }
}
