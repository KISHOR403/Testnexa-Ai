// Simple test to verify OpenAI API connection
require('dotenv').config();
const axios = require('axios');

const testOpenAI = async () => {
    console.log('Testing OpenAI API...');
    console.log('API Key:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 20)}...` : 'NOT SET');
    console.log('Model:', process.env.OPENAI_MODEL);

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'user',
                        content: 'Say "Hello, I am working!" in JSON format: {"message": "your response"}'
                    }
                ],
                max_tokens: 50,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('\n✅ SUCCESS!');
        console.log('Response:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log('\n❌ ERROR!');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data || error.message);
        console.log('\nFull error:', JSON.stringify(error.response?.data, null, 2));
    }
};

testOpenAI();
