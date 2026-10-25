import type { RuntimeMessage, RuntimeResponse } from '../types';

export const sendRuntimeMessage = <T = unknown>(msg: RuntimeMessage): Promise<T> => {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(msg, (res: RuntimeResponse<T>) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message || 'Extension context invalidated. Refresh the page.'));
        }
        if (!res) {
          return reject(new Error('No response received from extension background.'));
        }
        if (!res.ok) {
          return reject(new Error(res.error || 'Request failed'));
        }
        resolve(res as T);
      });
    } catch (err) {
      reject(new Error(err instanceof Error ? err.message : 'Extension was updated. Refresh this page.'));
    }
  });
};
