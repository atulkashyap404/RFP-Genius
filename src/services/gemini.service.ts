import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';

export type OutputFormat = 'json' | 'markdown' | 'text';

export interface ProposalResult {
  answer: string;
  followUpQuestions: string[];
}

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  // FIX: Removed apiKey parameter and now use process.env.API_KEY.
  async generateProposal(
    context: string,
    question: string,
    format: OutputFormat
  ): Promise<ProposalResult> {
    // FIX: API Key is now sourced from environment variables.
    if (!process.env.API_KEY) {
      throw new Error(
        'Google Gemini API Key is missing. Please ensure the API_KEY environment variable is set.'
      );
    }

    const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-2.5-flash';

    try {
      if (format === 'json') {
        const fullPrompt = `
          **Context:**
          ${context}

          ---

          **Question:**
          ${question}

          ---

          Based *only* on the provided context, perform the following two tasks:
          1.  Provide a professional and detailed answer to the question.
          2.  Generate exactly three relevant follow-up questions that could be asked next based on the context.
        `;
        const response = await genAI.models.generateContent({
          model,
          contents: fullPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                answer: {
                  type: Type.STRING,
                  description:
                    "The detailed, professional answer to the user's question, based strictly on the provided context.",
                },
                followUpQuestions: {
                  type: Type.ARRAY,
                  description:
                    'An array of exactly three relevant follow-up questions.',
                  items: {
                    type: Type.STRING,
                  },
                },
              },
              required: ['answer', 'followUpQuestions'],
            },
          },
        });

        const jsonString = response.text.trim();
        const parsedResult: ProposalResult = JSON.parse(jsonString);

        if (
          !parsedResult.answer ||
          !Array.isArray(parsedResult.followUpQuestions)
        ) {
          throw new Error('AI response did not match the expected format.');
        }

        return parsedResult;
      } else {
        const formatInstruction =
          format === 'markdown'
            ? 'Provide a professional and detailed answer in Markdown format. Include a main answer and, if relevant, a list of potential follow-up questions.'
            : 'Provide a professional and detailed answer in plain text format.';

        const fullPrompt = `
          **Context:**
          ${context}

          ---

          **Question:**
          ${question}

          ---

          Based *only* on the provided context, ${formatInstruction}
        `;
        const response = await genAI.models.generateContent({
          model,
          contents: fullPrompt,
        });

        return {
          answer: response.text.trim(),
          followUpQuestions: [],
        };
      }
    } catch (error) {
      console.error('Error generating proposal from Gemini API:', error);
      if (
        error instanceof Error &&
        error.message.includes('API key not valid')
      ) {
        // FIX: Updated error message for invalid API key.
        throw new Error(
          'The provided Google Gemini API Key is invalid or has expired. Please check your environment configuration.'
        );
      }
      throw new Error(
        'Failed to generate proposal. The AI model may be temporarily unavailable or the request could not be processed.'
      );
    }
  }
}
