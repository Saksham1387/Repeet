import type { Difficulty, LeetCodeMeta } from '../types';

export const slugFromInput = (text: string): string | null => {
  const m = /problems\/([a-z0-9-]+)/i.exec(text) || /^([a-z0-9-]+)$/i.exec(text.trim());
  return m ? m[1].toLowerCase() : null;
};

export async function fetchMeta(slug: string): Promise<LeetCodeMeta> {
  const fallback: LeetCodeMeta = {
    slug,
    title: slug
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' '),
    frontendId: null,
    difficulty: 'Unknown',
    tags: [],
  };

  try {
    const r = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          'query q($s:String!){question(titleSlug:$s){questionFrontendId title difficulty topicTags{name}}}',
        variables: { s: slug },
      }),
    });

    const data = await r.json();
    const q = data?.data?.question;
    if (q) {
      return {
        slug,
        title: q.title || fallback.title,
        frontendId: q.questionFrontendId || null,
        difficulty: (['Easy', 'Medium', 'Hard'].includes(q.difficulty)
          ? q.difficulty
          : 'Unknown') as Difficulty,
        tags: Array.isArray(q.topicTags) ? q.topicTags.map((t: { name: string }) => t.name) : [],
      };
    }
  } catch {
    // fall through to fallback
  }

  return fallback;
}
