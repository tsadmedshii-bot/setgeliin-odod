// Сэтгэлийн Одод — тестийн оноо тооцоолох дүрэм.
import type { TestQuestion, TestScoring } from '../../shared/src/types';

export interface ScoreResult {
  score: number;
  maxScore: number;
  resultTitle: string;
  resultDescription: string;
}

function pickBand(scoring: TestScoring, score: number): { title: string; description: string } {
  const bands = scoring.bands ?? [];
  if (bands.length === 0) {
    return { title: '', description: '' };
  }
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  const hit = sorted.find((b) => score >= b.min && score <= b.max);
  if (hit) return { title: hit.title, description: hit.description };
  if (score < sorted[0].min) return { title: sorted[0].title, description: sorted[0].description };
  const last = sorted[sorted.length - 1];
  return { title: last.title, description: last.description };
}

export function scoreTest(
  scoring: TestScoring,
  questions: TestQuestion[],
  answers: number[],
): ScoreResult {
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    throw new Error(`Хариултын тоо асуултын тоотой таарахгүй байна (асуулт: ${questions.length})`);
  }
  for (let i = 0; i < answers.length; i++) {
    const idx = answers[i];
    const options = questions[i]?.options ?? [];
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      throw new Error(`${i + 1}-р асуултын хариулт буруу байна`);
    }
  }

  let score = 0;
  let maxScore = 0;
  const scaleLines: string[] = [];

  if (scoring.mode === 'scales') {
    const scales = scoring.scales ?? [];
    for (const scale of scales) {
      let counted = 0;
      for (const qNo of scale.yesItems) {
        // "Тийм" = тухайн асуултын эхний сонголт (индекс 0). Асуултын дугаар 1-ээс эхэлнэ.
        if (answers[qNo - 1] === 0) counted += 1;
      }
      for (const qNo of scale.noItems) {
        // "Үгүй" = хоёр дахь сонголт (индекс 1).
        if (answers[qNo - 1] === 1) counted += 1;
      }
      const scaleScore = scale.coefficient * counted;
      score += scaleScore;
      maxScore += scale.coefficient * (scale.yesItems.length + scale.noItems.length);
      scaleLines.push(`${scale.name}: ${scaleScore} оноо`);
    }
  } else {
    for (let i = 0; i < questions.length; i++) {
      const options = questions[i].options;
      score += options[answers[i]].score;
      maxScore += Math.max(...options.map((o) => o.score));
    }
  }

  const bands = scoring.bands ?? [];
  if (bands.length === 0) {
    return {
      score,
      maxScore,
      resultTitle: 'Үр дүн',
      resultDescription: `Нийт оноо: ${score} / ${maxScore}.`,
    };
  }

  const band = pickBand(scoring, score);
  let description = band.description;
  if (scaleLines.length > 0) {
    description = `${description}\n${scaleLines.join('\n')}`;
  }
  return { score, maxScore, resultTitle: band.title, resultDescription: description };
}
