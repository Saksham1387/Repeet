import type { Question, StorageSchema } from '../types';

export const getQuestions = async (): Promise<Record<string, Question>> => {
  const data = (await chrome.storage.local.get('questions')) as StorageSchema;
  return data.questions || {};
};

export const putQuestions = async (qs: Record<string, Question>): Promise<void> => {
  await chrome.storage.local.set({ questions: qs });
};
