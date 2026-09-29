import type {ModuleDescriptor,ModuleProgress,ModuleRun} from '../learning/moduleProgress';
import type {QuestionNote} from '../learning/questionNotes';
import type {Attempt,LearningSession} from '../learning/model';
import type {QuestionReview} from '../segmented/types';
import type {AnswerReview} from '../segmented/answers';
import type {TestSession,SessionAction} from '../exams/model';
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
export interface AuthProvider { currentUser(): Promise<UserContext>; restoreSession():Promise<UserContext>; login(credentials:Readonly<Record<string,unknown>>):Promise<UserContext>; logout():Promise<void> }
export interface SyncConflict {entity:string;id:string;local:unknown;remote:unknown}
export type SyncResult = {status:'noop';reason:string}|{status:'completed';pulled:number;pushed:number}|{status:'conflicts';conflicts:SyncConflict[]}|{status:'error';message:string;retryable:boolean};
export interface SyncProvider {pull(user:UserContext):Promise<SyncResult>;push(user:UserContext):Promise<SyncResult>;sync(user:UserContext):Promise<SyncResult>;resolveConflict(user:UserContext,conflict:SyncConflict,resolution:'local'|'remote'):Promise<SyncResult>}
export interface LocalField { value: string; locked: boolean; origin: 'user' | 'machine' }
export interface ProgressRecord { schema_version: 1; userId: string; questionId: string; fields: Record<string, LocalField>; updatedAt: string }
export interface PersonalDataSnapshot {schema_version:1;userId:string;records:ProgressRecord[];reviews:QuestionReview[];answerReviews:AnswerReview[];attempts:Attempt[];learningSessions:LearningSession[];testSessions:TestSession[];questionNotes?:QuestionNote[];moduleProgress?:ModuleProgress[];moduleRuns?:ModuleRun[];settings?:Array<{userId:string;id:string;value:unknown}>}
export interface ProgressRepository {
 getModuleProgress(userId:string):Promise<ModuleProgress[]>;
 getModuleRuns(userId:string):Promise<ModuleRun[]>;
 ensureModuleProgress(userId:string,descriptor:ModuleDescriptor):Promise<ModuleProgress>;
 savePracticeSession(session:LearningSession,progressId:string,runId:string):Promise<void>;
 savePracticeAttempt(attempt:Attempt,session:LearningSession,progressId:string,runId:string):Promise<Attempt>;
 resetModuleProgress(userId:string,progressId:string,revision:number,runId:string):Promise<ModuleProgress>;
 deletePracticeAttempt(userId:string,progressId:string,attemptId:string,runId:string):Promise<void>;

 getQuestionNotes(userId:string):Promise<QuestionNote[]>;
 getQuestionNote(userId:string,questionId:string):Promise<QuestionNote|undefined>;
 saveQuestionNote(userId:string,questionId:string,text:string,expectedRevision:number,expectedText:string):Promise<QuestionNote>;
 getRecords(userId:string):Promise<ProgressRecord[]>;
 getReviews(userId:string):Promise<QuestionReview[]>;
 saveReview(review:QuestionReview):Promise<void>;
 importReviews(reviews:QuestionReview[],answers?:AnswerReview[],userId?:string):Promise<void>;
 getAnswerReviews(userId:string):Promise<AnswerReview[]>;
 saveAnswerReview(review:AnswerReview):Promise<void>;
 getAttempts(userId:string):Promise<Attempt[]>;
 getLearningSessions(userId:string):Promise<LearningSession[]>;
 saveLearningSession(session:LearningSession):Promise<void>;
 saveAttempt(attempt:Attempt,session?:LearningSession):Promise<void>;
 annotateAttempt(userId:string,id:string,values:Pick<Attempt,'note'|'error_reason'|'unsure'|'confidence'>):Promise<void>;
 getTestSessions(userId:string):Promise<TestSession[]>;
 getAnalysisTestSessions(userId:string):Promise<TestSession[]>;
 getTestSession(userId:string,id:string):Promise<TestSession|undefined>;
 createTestSession(session:TestSession,replace?:{id:string;revision:number}):Promise<TestSession>;
 updateTestSession(userId:string,id:string,revision:number,action:SessionAction):Promise<TestSession>;
 discardTestSession(userId:string,id:string,revision:number):Promise<TestSession>;
 deleteTestSession(userId:string,id:string,revision:number):Promise<void>;
 exportSnapshot(userId:string):Promise<PersonalDataSnapshot>;
 getSettings(userId:string):Promise<Array<{userId:string;id:string;value:unknown}>>;
 saveSetting(userId:string,id:string,value:unknown):Promise<void>;
 importSnapshot(snapshot:PersonalDataSnapshot,userId:string,sync:boolean):Promise<void>;
  get(userId: string, questionId: string): Promise<ProgressRecord | undefined>;
  saveCorrection(userId: string, questionId: string, field: string, value: string): Promise<void>;
  saveMachineValue(userId: string, questionId: string, field: string, value: string): Promise<void>;
}
