import { GoogleGenAI } from "@google/genai";

let ai = null;

export const getGeminiModel = () => {
  // Lazy initialization - only create the client when first needed
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    console.log('🔑 Gemini API Key Status:', apiKey ? '✅ Loaded' : '❌ Missing');
    
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY is not set in environment variables!');
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    ai = new GoogleGenAI({ apiKey });
    console.log('✅ Gemini AI client initialized successfully');
  }
  
  return ai;
};