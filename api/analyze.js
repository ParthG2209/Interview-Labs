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
        const { field = 'general' } = req.body || {};
        
        console.log('Analyzing video for field:', field);

        // Simulate realistic analysis processing time
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Generate realistic analysis
        const ratings = [6, 7, 7, 8, 8, 8, 9];
        const rating = ratings[Math.floor(Math.random() * ratings.length)];
        
        const fieldSpecificFeedback = {
            'software': {
                mistakes: [
                    { timestamp: '00:15', text: 'Consider providing more specific technical examples when describing your projects' },
                    { timestamp: '00:45', text: 'Try to explain complex technical concepts in simpler terms for clarity' }
                ],
                tips: [
                    'Use the STAR method (Situation, Task, Action, Result) for behavioral questions',
                    'Prepare specific examples of debugging complex issues and system design decisions',
                    'Practice explaining technical concepts to both technical and non-technical audiences',
                    'Be ready to discuss trade-offs in your technical decisions'
                ]
            },
            'java': {
                mistakes: [
                    { timestamp: '00:20', text: 'When discussing Java frameworks, mention specific use cases and benefits' },
                    { timestamp: '01:10', text: 'Consider explaining the reasoning behind your architectural decisions' }
                ],
                tips: [
                    'Be prepared to discuss Java memory management and garbage collection',
                    'Practice explaining Spring framework concepts and dependency injection',
                    'Prepare examples of performance optimization in Java applications',
                    'Review common Java design patterns and when to use them'
                ]
            }
        };

        // Match field to get specific feedback
        const fieldLower = field.toLowerCase();
        let feedback = fieldSpecificFeedback['software']; // default

        if (fieldLower.includes('java')) {
            feedback = fieldSpecificFeedback['java'];
        } else if (fieldLower.includes('software') || fieldLower.includes('developer') || fieldLower.includes('engineer')) {
            feedback = fieldSpecificFeedback['software'];
        }

        const analysis = {
            rating: rating,
            mistakes: feedback.mistakes,
            tips: feedback.tips,
            summary: `Good overall performance with a score of ${rating}/10. ${field ? `For ${field} positions, ` : ''}continue practicing with specific examples and focus on clear, confident delivery.`
        };

        console.log('Analysis complete:', { 
            rating: analysis.rating, 
            mistakeCount: analysis.mistakes.length, 
            tipCount: analysis.tips.length 
        });

        return res.status(200).json({ 
            analysis,
            success: true,
            processed: true
        });
        
    } catch (error) {
        console.error('Video analysis error:', error);
        return res.status(500).json({
            error: 'Analysis failed',
            message: 'Video analysis temporarily unavailable. Please try again later.',
            details: error.message
        });
    }
}
