export type ReviewStatus = 'confirmed' | 'needs_review' | 'low_confidence' | 'user_corrected';
export interface SourceReference { document_id: string; sha256: string; pdf: string; page: number; image: string; bbox?: number[] }
export interface Question {
  schema_version: 1; question_id: string; exam: string; module: string; question_number: string;
  question_text: string; points: number | null; primary_topic: string | null; secondary_topics: string[];
  official_solution: string | null; accepted_answer_notes: string | null; ai_explanation: string | null;
  source_reference: SourceReference; review_status: ReviewStatus; locked_fields: string[];
  solution_candidates: {source_reference: SourceReference; confidence: number | null; basis: string; status: ReviewStatus}[];
}
export interface Document {
  id: string; module: string; file: string; public_pdf: string; pages_total: number; pages_processed: number;
  processing_complete: boolean; status: string;
  duration: {minutes: number; source_page: number; review_status: ReviewStatus} | null;
  pages: {number: number; image: string; raw_text: string; method: string}[];
}
export interface Exam {
  schema_version: 1; exam: string; title: string; notice: string; documents: Document[]; questions: Question[];
  review_queue: {id: string; kind: string; reason: string; source_reference: SourceReference; status: ReviewStatus}[];
}
export interface UserContext { id: string; mode: 'local' | 'remote' }
export interface AuthProvider { currentUser(): Promise<UserContext> }
export interface SyncProvider { sync(user: UserContext): Promise<void> }
export interface LocalField { value: string; locked: boolean; origin: 'user' | 'machine' }
export interface ProgressRecord { schema_version: 1; userId: string; questionId: string; fields: Record<string, LocalField>; updatedAt: string }
export interface ProgressRepository {
  get(userId: string, questionId: string): Promise<ProgressRecord | undefined>;
  saveCorrection(userId: string, questionId: string, field: string, value: string): Promise<void>;
  saveMachineValue(userId: string, questionId: string, field: string, value: string): Promise<void>;
}
