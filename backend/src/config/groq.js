import Groq from "groq-sdk";

let groqClient = null;

export const getGroqModel = () => {
  // Lazy initialization - only create the client when first needed
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    
    console.log('🔑 Groq API Key Status:', apiKey ? '✅ Loaded' : '❌ Missing');
    
    if (!apiKey) {
      console.error('❌ GROQ_API_KEY is not set in environment variables!');
      throw new Error('GROQ_API_KEY environment variable is required');
    }
    
    groqClient = new Groq({ apiKey });
    console.log('✅ Groq client initialized successfully');
  }
  
  return groqClient;
};