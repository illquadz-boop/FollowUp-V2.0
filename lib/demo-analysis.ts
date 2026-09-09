import {
  AppError,
  localDate,
  offsetDate,
  type Draft,
  type User,
} from './contracts';

export function extractDate(text: string, base = localDate()): string | null {
  const full = text.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  const short = text.match(/(\d{1,2})\s*(?:월|\/)\s*(\d{1,2})\s*일?/);
  let result: string | null = null;
  if (full)
    result = `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`;
  else if (short)
    result = `${base.slice(0, 4)}-${short[1].padStart(2, '0')}-${short[2].padStart(2, '0')}`;
  else if (/모레/.test(text)) return offsetDate(2, base);
  else if (/내일/.test(text)) return offsetDate(1, base);
  else if (/오늘|금일/.test(text)) return base;
  else {
    const week = text.match(/(월|화|수|목|금|토|일)요일/);
    if (week) {
      const target = '일월화수목금토'.indexOf(week[1]);
      const current = new Date(base + 'T12:00:00').getDay();
      let diff = (target - current + 7) % 7;
      if (/다음\s*주/.test(text))
        diff = 7 - ((current + 6) % 7) + ((target + 6) % 7);
      return offsetDate(diff, base);
    }
    if (/이번\s*주/.test(text)) {
      const day = new Date(base + 'T12:00:00').getDay();
      return offsetDate((5 - day + 7) % 7, base);
    }
  }
  if (result && localDate(new Date(result + 'T12:00:00')) === result)
    return result;
  return null;
}
// Deliberately a transparent local preview, never an LLM substitute.
export function analyzeLocally(
  notes: string,
  members: User[],
  base = localDate(),
): Draft {
  if (!notes.trim()) throw new AppError('분석할 회의록을 먼저 입력해주세요.');
  const draft: Draft = {
    id: crypto.randomUUID(),
    decisions: [],
    schedule: [],
    tasks: [],
    analyzedAt: new Date().toISOString(),
    source: 'LOCAL_DEMO',
  };
  const sentences = notes
    .split(/\n+|(?<=[다함음요])\.\s+|[;；]/)
    .map((s) => s.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    const dueDate = extractDate(sentence, base);
    const member = members.find(
      (m) =>
        sentence.includes(m.name) || sentence.includes(m.name.slice(1) + '님'),
    );
    const decision = /결정|제외|하지\s*않|않기로|보류|취소|집중|확정/.test(
      sentence,
    );
    const schedule =
      /배포|출시|발표|세미나|워크숍|오픈/.test(sentence) && !!dueDate;
    if (decision) draft.decisions.push(sentence.replace(/[.]$/, ''));
    if (schedule)
      draft.schedule.push({
        id: crypto.randomUUID(),
        title: sentence.replace(/[.]$/, ''),
        date: dueDate,
      });
    if (
      !decision &&
      (!schedule || member) &&
      /수정|작성|설계|구현|개발|검토|테스트|분석|확인|연동|준비|담당|완료|정리|진행|제작|배포/.test(
        sentence,
      )
    ) {
      let title = sentence;
      if (member)
        title = title
          .replace(new RegExp(`${member.name}(님)?([은는이가])?`, 'g'), '')
          .replace(
            new RegExp(`${member.name.slice(1)}님([은는이가])?`, 'g'),
            '',
          );
      title = title
        .replace(
          /(20\d{2}[-/.])?\d{1,2}(?:월|[-/])\s*\d{1,2}일?(까지|에)?/g,
          '',
        )
        .replace(
          /(다음\s*주\s*|이번\s*주\s*)?(월|화|수|목|금|토|일)요일(까지|에)?/g,
          '',
        )
        .replace(/(오늘|내일|모레|이번\s*주)(까지|에|\s*내)?/g, '')
        .replace(
          /(하기로|하기로\s*했다|하기로\s*함|한다|해요|할\s*예정이다)[.\s]*$/,
          '',
        )
        .replace(/\s+/g, ' ')
        .trim();
      const high = /오류|버그|긴급|우선|필수|장애|보안/.test(sentence);
      draft.tasks.push({
        id: crypto.randomUUID(),
        title: title || sentence,
        description: sentence,
        assigneeId: member?.id || null,
        dueDate,
        priority: high ? 'HIGH' : 'MEDIUM',
        reason: high
          ? '오류·긴급·필수 표현이 포함되어 우선 검토가 필요해요.'
          : '회의에서 후속 행동으로 언급된 항목이에요. 우선순위를 검토해주세요.',
      });
    }
  }
  return draft;
}
