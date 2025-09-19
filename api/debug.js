export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    res.status(200).json({
        message: 'API is working!',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'production',
        cohere: !!process.env.COHERE_API_KEY,
        method: req.method
    });
}
