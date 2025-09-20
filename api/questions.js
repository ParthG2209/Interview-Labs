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

        console.log(`🤖 Generating ${questionCount} questions for: ${fieldTrimmed}`);

        const cohereApiKey = process.env.COHERE_API_KEY;
        
        if (cohereApiKey) {
            console.log('🔑 Using Cohere Chat API with command-r-08-2024 model...');
            
            try {
                // FIXED: Using the new Chat API endpoint
                const cohereResponse = await fetch('https://api.cohere.com/v1/chat', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${cohereApiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'command-r-08-2024',
                        message: `Generate exactly ${questionCount} professional interview questions for a ${fieldTrimmed} position.

Requirements:
- Make each question challenging and specific to ${fieldTrimmed}
- Include both technical and behavioral questions
- Format each question on a separate line
- Do not include numbering or bullet points
- Each question should end with a question mark

Please generate the questions now:`,
                        temperature: 0.8,
                        max_tokens: 600,
                        stream: false,
                        chat_history: []
                    })
                });

                console.log(`📡 Cohere Chat API response status: ${cohereResponse.status}`);

                if (cohereResponse.ok) {
                    const cohereData = await cohereResponse.json();
                    console.log('✅ Cohere Chat API response received successfully');
                    
                    // FIXED: Chat API returns data in 'text' field, not 'generations'
                    const generatedText = cohereData.text?.trim();
                    
                    if (generatedText) {
                        console.log(`📝 Generated text preview: ${generatedText.substring(0, 200)}...`);
                        
                        // Parse questions from Chat API response
                        const questions = generatedText
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => {
                                // Filter for valid questions
                                return line.length > 15 && 
                                       (line.includes('?') || 
                                        line.toLowerCase().includes('describe') ||
                                        line.toLowerCase().includes('explain') ||
                                        line.toLowerCase().includes('tell me') ||
                                        line.toLowerCase().includes('how would') ||
                                        line.toLowerCase().includes('what is') ||
                                        line.toLowerCase().includes('why')) &&
                                       !line.match(/^[0-9]+\./) && // Remove numbered items
                                       !line.toLowerCase().includes('requirements:') &&
                                       !line.toLowerCase().includes('please generate');
                            })
                            .map(line => {
                                // Clean up questions
                                let cleaned = line
                                    .replace(/^[-•*]\s*/, '')  // Remove bullet points
                                    .replace(/^\d+\.\s*/, '')  // Remove numbering
                                    .replace(/^Question\s*\d*:?\s*/i, '') // Remove "Question X:"
                                    .trim();
                                
                                // Ensure proper question format
                                if (!cleaned.endsWith('?') && 
                                    !cleaned.endsWith('.') && 
                                    (cleaned.toLowerCase().includes('describe') ||
                                     cleaned.toLowerCase().includes('explain') ||
                                     cleaned.toLowerCase().includes('tell me'))) {
                                    cleaned += '?';
                                }
                                
                                return cleaned;
                            })
                            .filter(q => q.length > 20) // Final quality check
                            .slice(0, questionCount);

                        console.log(`🎯 Successfully parsed ${questions.length} questions from Cohere Chat API`);

                        if (questions.length >= Math.min(questionCount, 3)) {
                            return res.status(200).json({
                                questions: questions,
                                ai: true,
                                source: 'cohere-chat-api',
                                requested: questionCount,
                                generated: questions.length,
                                field: fieldTrimmed,
                                model: 'command-r-08-2024',
                                apiVersion: 'chat-v1'
                            });
                        } else {
                            console.log(`⚠️ Only got ${questions.length} valid questions, using fallback`);
                        }
                    } else {
                        console.log('❌ No text content in Cohere Chat API response');
                    }
                } else {
                    // Log Chat API errors
                    const errorData = await cohereResponse.text();
                    console.error(`❌ Cohere Chat API failed:`, {
                        status: cohereResponse.status,
                        statusText: cohereResponse.statusText,
                        error: errorData
                    });
                }
                
            } catch (cohereError) {
                console.error('❌ Cohere Chat API request failed:', {
                    message: cohereError.message,
                    name: cohereError.name
                });
            }
        } else {
            console.log('❌ No Cohere API key configured');
        }

        // Premium fallback questions (same as before)
        console.log('🔄 Using premium template questions as fallback');
        
        const premiumQuestions = {
            'software': [
                `Walk me through designing a scalable microservices architecture for a high-traffic e-commerce platform.`,
                `Describe a time you identified and resolved a critical performance bottleneck in production. What was your methodology?`,
                `How would you implement a real-time notification system that can handle millions of concurrent users?`,
                `Tell me about your experience with database optimization. How do you approach query performance tuning?`,
                `Explain how you would design a comprehensive monitoring and alerting system for distributed services.`,
                `Describe a complex technical problem you solved that required collaboration across multiple teams.`,
                `How do you approach technical debt management in a fast-paced development environment?`,
                `Walk me through your process for conducting effective code reviews and maintaining code quality standards.`,
                `Describe how you would implement CI/CD pipelines for a team of 20+ developers working on multiple services.`,
                `Tell me about a time you had to make a critical architectural decision under tight deadlines.`
            ],
            'java': [
                `Explain the Java memory model and how it affects concurrent programming. Provide specific examples.`,
                `How would you design a thread-safe caching mechanism in Java without using existing frameworks?`,
                `Describe the differences between Spring Boot's auto-configuration and manual configuration. When would you use each?`,
                `How would you implement a custom annotation processor in Java and what are the use cases?`,
                `Explain how garbage collection works in Java 11+ and how you would tune it for a high-throughput application.`,
                `Walk me through implementing the Observer pattern in Java and discuss its pros and cons.`,
                `How would you handle transaction management in a Spring application with multiple data sources?`,
                `Describe your approach to testing Spring Boot applications, including integration and unit tests.`,
                `Explain the concept of reactive programming in Java and when you would choose it over traditional approaches.`,
                `How would you implement a connection pool from scratch in Java and ensure it's production-ready?`
            ],
            'intern': [
                `Tell me about a personal or academic project you're most proud of and the technical challenges you overcame.`,
                `How would you approach learning a completely new technology stack that our team uses?`,
                `Describe a time you had to debug a complex issue in your code. Walk me through your process.`,
                `How do you stay current with software development trends and best practices?`,
                `Tell me about a time you received constructive feedback on your code. How did you respond?`,
                `Describe your experience with version control systems like Git. How do you handle merge conflicts?`,
                `How would you explain a complex technical concept to someone without a technical background?`,
                `Tell me about a team project where you had to collaborate with others who had different skill levels.`,
                `How do you approach breaking down a large, complex problem into manageable tasks?`,
                `Describe your testing strategy for a new feature you're developing. How do you ensure quality?`
            ]
        };

        // Field matching logic (same as before)
        const fieldLower = fieldTrimmed.toLowerCase();
        let selectedQuestions = [];
        
        if (fieldLower.includes('intern') || fieldLower.includes('entry') || fieldLower.includes('student') || fieldLower.includes('graduate')) {
            selectedQuestions = premiumQuestions.intern;
        } else if (fieldLower.includes('java') || fieldLower.includes('spring') || fieldLower.includes('jvm') || fieldLower.includes('hibernate')) {
            selectedQuestions = premiumQuestions.java;
        } else if (fieldLower.includes('software') || fieldLower.includes('developer') || fieldLower.includes('engineer') || fieldLower.includes('programming') || fieldLower.includes('backend') || fieldLower.includes('frontend')) {
            selectedQuestions = premiumQuestions.software;
        } else {
            // Custom questions for any field
            selectedQuestions = [
                `Describe the most challenging project you've worked on in ${fieldTrimmed} and how you overcame obstacles.`,
                `How do you stay current with the latest developments and best practices in ${fieldTrimmed}?`,
                `Tell me about a time you had to learn a new skill or technology quickly to complete a ${fieldTrimmed} project.`,
                `How would you explain complex ${fieldTrimmed} concepts to stakeholders without technical backgrounds?`,
                `Describe your problem-solving methodology when facing difficult ${fieldTrimmed} challenges.`,
                `How do you ensure quality and accuracy in your ${fieldTrimmed} work? What processes do you follow?`,
                `Tell me about a time you had to collaborate with cross-functional teams on a ${fieldTrimmed} project.`,
                `How do you prioritize multiple ${fieldTrimmed} projects with competing deadlines and requirements?`,
                `Describe a mistake you made in ${fieldTrimmed} work and what you learned from the experience.`,
                `What emerging trends or technologies in ${fieldTrimmed} are you most excited about and why?`
            ];
        }

        // Return randomized questions
        const shuffled = [...selectedQuestions].sort(() => 0.5 - Math.random());
        const finalQuestions = shuffled.slice(0, questionCount);

        return res.status(200).json({
            questions: finalQuestions,
            ai: false,
            source: 'premium-templates',
            requested: questionCount,
            generated: finalQuestions.length,
            field: fieldTrimmed,
            cohereAvailable: !!cohereApiKey,
            model: 'fallback-premium',
            note: 'Using premium questions - Cohere Chat API attempted with command-r-08-2024'
        });
        
    } catch (error) {
        console.error('❌ Questions generation error:', error);
        return res.status(500).json({
            error: 'Failed to generate questions',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
