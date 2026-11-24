export type Role = 'admin' | 'teacher' | 'student';
export interface User { id: number; name: string; email: string; role: Role; active?: number }
export type QType = 'single' | 'multiple' | 'truefalse' | 'short';
export interface Test {
  id: number; title: string; description: string; subject: string; duration_minutes: number;
  pass_percent: number; max_attempts: number; shuffle: boolean; published: boolean;
  opens_at: string | null; closes_at: string | null; author?: string;
  question_count?: number; total_points?: number; attempts_used?: number; open_now?: boolean;
  questions?: Question[];
}
export interface Question { id?: number; type: QType; text: string; options: string[]; correct: (number | string)[]; points: number }
export interface AttemptQuestion { id: number; type: QType; text: string; options: string[]; points: number }
export interface Attempt {
  id: number; test: { id: number; title: string; duration_minutes: number };
  deadline: string; server_time: string; answers: Record<string, unknown>; questions: AttemptQuestion[];
}
export interface ReviewItem extends AttemptQuestion { correct: (number | string)[]; answer: unknown; earned: number }
export interface Result {
  id: number; test_id: number; test_title: string; user_name?: string; submitted_at: string;
  score: number; max_score: number; percent: number; passed: boolean; flags: number;
  pass_percent?: number; review?: ReviewItem[];
}
export interface Analytics {
  attempts: number; average: number; median: number; passRate: number; flagged: number;
  distribution: { from: number; to: number; count: number }[];
  questions: { id: number; text: string; percentCorrect: number; attempts: number }[];
}
