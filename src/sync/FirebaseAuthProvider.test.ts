import {describe,it,expect,vi} from 'vitest';
vi.mock('firebase/app',()=>({getApps:()=>[],initializeApp:(options:unknown)=>({options})}));
vi.mock('firebase/auth',()=>({getAuth:()=>({currentUser:null,authStateReady:async()=>undefined}),setPersistence:async()=>{throw Error('auth unavailable');},browserLocalPersistence:{},GoogleAuthProvider:class{},signInWithPopup:vi.fn(),signOut:vi.fn(),onAuthStateChanged:()=>()=>undefined}));
import {FirebaseAuthProvider} from './FirebaseAuthProvider';
describe('authentication startup failure does not block offline learning',()=>{
 it('restores local context while login reports configuration/runtime problem',async()=>{const provider=new FirebaseAuthProvider({apiKey:'public',projectId:'test',authDomain:'test.firebaseapp.com',appId:'public'});expect(await provider.restoreSession()).toEqual({id:'local',mode:'local'});await expect(provider.login({})).rejects.toThrow();});
});
