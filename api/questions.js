export default async function handler(req, res) {
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

        console.log(`Attempting to generate ${questionCount} questions for: ${fieldTrimmed}`);

        const cohereApiKey = process.env.COHERE_API_KEY;
        
        if (cohereApiKey) {
            console.log('🤖 Attempting Cohere AI generation...');
            
            try {
                // Updated Cohere API call with correct endpoint and model
                const cohereResponse = await fetch('https://api.cohere.com/v1/chat', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${cohereApiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Generate exactly ${questionCount} realistic interview questions for a ${fieldTrimmed} position. Make them professional, specific, and relevant. Format as a numbered list.`,
                        model: 'command-r-plus',
                        temperature: 0.7,
                        max_tokens: 600,
                        stream: false
                    })
                });

                console.log('Cohere response status:', cohereResponse.status);

                if (cohereResponse.ok) {
                    const cohereData = await cohereResponse.json();
                    console.log('Cohere response received:', !!cohereData.text);
                    
                    const generatedText = cohereData.text?.trim();
                    
                    if (generatedText) {
                        // Parse questions from the response
                        const questions = generatedText
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => {
                                // Remove empty lines and numbering
                                return line.length > 15 && 
                                       (line.includes('?') || line.includes('how') || line.includes('what') || line.includes('describe'));
                            })
                            .map(line => {
                                // Clean up numbering and formatting
                                return line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim();
                            })
                            .slice(0, questionCount);

                        console.log(`✅ Generated ${questions.length} questions via Cohere AI`);

                        if (questions.length >= Math.min(questionCount, 2)) {
                            return res.status(200).json({
                                questions: questions.slice(0, questionCount),
                                ai: true,
                                source: 'cohere-ai',
                                requested: questionCount,
                                generated: questions.length,
                                field: fieldTrimmed
                            });
                        } else {
                            console.log('❌ Insufficient questions from Cohere, using fallback');
                        }
                    } else {
                        console.log('❌ No text in Cohere response');
                    }
                } else {
                    const errorText = await cohereResponse.text();
                    console.error('❌ Cohere API failed:', cohereResponse.status, errorText);
                }
                
            } catch (cohereError) {
                console.error('❌ Cohere API error:', cohereError.message);
            }
        } else {
            console.log('❌ No Cohere API key found');
        }

        // Enhanced fallback templates (this is what's currently running)
        console.log('🔄 Using enhanced template fallback');
        
        const questionTemplates = {
            'software': [
                `Describe a complex system design challenge you've solved and your approach.`,
                `How do you approach debugging production issues in distributed systems?`,
                `Tell me about a time you had to optimize application performance. What was your process?`,
                `Explain how you would design a RESTful API for a high-traffic application.`,
                `Describe your experience with microservices architecture and its trade-offs.`,
                `How do you ensure code quality and maintainability in a team environment?`,
                `Tell me about a technical decision you made that you later regretted and what you learned.`,
                `How would you handle a situation where stakeholders want features that conflict with best practices?`,
                `Describe your process for staying current with new technologies and deciding which to adopt.`,
                `Walk me through how you would troubleshoot a slow database query in production.`
            ],
            'java': [
                `Explain the differences between ArrayList and LinkedList and when you'd use each.`,
                `How does garbage collection work in Java and how would you tune it for performance?`,
                `Describe the Spring Boot auto-configuration mechanism and how to customize it.`,
                `How would you handle concurrent access to shared resources in a Java application?`,
                `Explain the concept of dependency injection and its benefits in Java applications.`,
                `Describe how you would implement a RESTful web service using Spring Boot.`,
                `How do you handle exceptions in Java and what are the best practices?`,
                `Explain the difference between checked and unchecked exceptions with examples.`,
                `How would you optimize memory usage in a Java application dealing with large datasets?`,
                `Describe your approach to unit testing in Java and your preferred testing frameworks.`
            ],
            'intern': [
                `What attracts you most to this internship opportunity and our company?`,
                `Describe a challenging academic project and how you approached solving it.`,
                `How do you prioritize multiple assignments or projects with competing deadlines?`,
                `Tell me about a time you had to learn a new programming language or technology quickly.`,
                `How would you handle feedback or criticism about your work from a supervisor?`,
                `Describe a group project where you had to work with team members who had different working styles.`,
                `What programming languages and development tools are you most comfortable with?`,
                `Tell me about a problem you solved using a creative or unconventional approach.`,
                `How do you stay motivated when working on tasks that are challenging or unfamiliar?`,
                `Describe a mistake you made in a project and how you handled it.`
            ]
        };

        // Improved field matching
        const fieldLower = fieldTrimmed.toLowerCase();
        let selectedTemplates = [];
        
        if (fieldLower.includes('intern') || fieldLower.includes('entry') || fieldLower.includes('student')) {
            selectedTemplates = questionTemplates.intern;
        } else if (fieldLower.includes('java') || fieldLower.includes('spring') || fieldLower.includes('jvm')) {
            selectedTemplates = questionTemplates.java;
        } else if (fieldLower.includes('software') || fieldLower.includes('developer') || fieldLower.includes('engineer') || fieldLower.includes('programming')) {
            selectedTemplates = questionTemplates.software;
        } else {
            // Generic professional questions
            selectedTemplates = [
                `Tell me about your most challenging project in ${fieldTrimmed} and how you approached it.`,
                `How do you stay updated with the latest trends and developments in ${fieldTrimmed}?`,
                `Describe a situation where you had to learn something new quickly for a ${fieldTrimmed} role.`,
                `How do you handle pressure and tight deadlines in ${fieldTrimmed} work?`,
                `Tell me about a mistake you made in ${fieldTrimmed} and what you learned from it.`,
                `Describe your problem-solving process when facing complex ${fieldTrimmed} challenges.`,
                `How do you collaborate effectively with others in ${fieldTrimmed} projects?`,
                `What motivates you most about working in ${fieldTrimmed}?`,
                `How do you prioritize tasks when managing multiple ${fieldTrimmed} responsibilities?`,
                `Describe a time you had to explain complex ${fieldTrimmed} concepts to non-technical stakeholders.`
            ];
        }

        // Randomize and return
        const shuffled = [...selectedTemplates].sort(() => 0.5 - Math.random());
        const questions = shuffled.slice(0, questionCount);

        return res.status(200).json({
            questions,
            ai: false,
            source: 'enhanced-templates',
            requested: questionCount,
            generated: questions.length,
            field: fieldTrimmed,
            cohereAvailable: !!cohereApiKey
        });
        
    } catch (error) {
        console.error('Questions generation error:', error);
        return res.status(500).json({
            error: 'Failed to generate questions',
            details: error.message
        });
    }
}
