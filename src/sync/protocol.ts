/** Versioned personal records. Authentication/ownership comes from Firebase uid, never a pairing secret. */
export const SYNC_ENTITIES = ['records','reviews','answerReviews','attempts','learningSessions','testSessions','settings','questionNotes'] as const;
export type EntityType = typeof SYNC_ENTITIES[number];
export type SyncValue = Record<string,unknown> | null;
export interface SyncEnvelope {entity:EntityType;id:string;revision:number;cursor:number;updatedAt:string;deviceId:string;deleted:boolean;value:SyncValue}
export interface PushMutation {mutationId:string;entity:EntityType;id:string;baseRevision:number;deleted:boolean;value:SyncValue}
export interface PushResult {mutationId:string;status:'applied'|'duplicate'|'conflict';record:SyncEnvelope;conflictId?:string;reason?:'revision_mismatch'|'immutable_history'}
export interface PullResponse {changes:SyncEnvelope[];cursor:number;hasMore:boolean}
export interface PushResponse {results:PushResult[]}
export interface FirebaseAccount {uid:string;email:string|null;displayName:string|null}
export interface DeviceRegistration {user_id:string;device_id:string;device_name:string;created_at:string;last_seen:string;revoked_at:string|null}
