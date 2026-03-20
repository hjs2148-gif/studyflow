
import { GoogleGenAI } from "@google/genai";

// Fix: Initialize the Gemini SDK using process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const callGemini = async (prompt: string): Promise<string> => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key is missing.");
    return "API Key가 설정되지 않았습니다.";
  }

  try {
    const response = await ai.models.generateContent({
      // Use gemini-2.0-flash for basic/complex text tasks as recommended
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    // Use .text property directly as it is a getter (not a method)
    return response.text || "AI 응답을 가져올 수 없습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 서비스 연결에 실패했습니다.";
  }
};
