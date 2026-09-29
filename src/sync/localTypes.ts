import type {SyncEnvelope,PushMutation,EntityType} from './protocol';
export const PERSONAL_STORES=['records','reviews','answerReviews','attempts','learningSessions','testSessions','settings','questionNotes'] as const;
export const SYNC_STORES=['syncMeta','outbox','tombstones','syncConflicts','deviceState'] as const;
export const ID_FIELDS:Record<EntityType,string>={records:'questionId',reviews:'question_id',answerReviews:'question_id',attempts:'attempt_id',learningSessions:'question_id',testSessions:'test_id',settings:'id',questionNotes:'question_id'};
export interface OutboxItem extends PushMutation {userId:string;updated_at:string;localRevision:number}
export interface SyncMetadata {userId:string;entity:EntityType;id:string;revision:number;localRevision:number;updated_at:string;device_id:string;sync_state:'pending'|'synced'|'conflict'}
export interface StoredConflict {userId:string;entity:EntityType;id:string;local:OutboxItem;remote:SyncEnvelope}
