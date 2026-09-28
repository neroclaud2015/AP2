import {initializeApp,getApps,type FirebaseOptions,type FirebaseApp} from 'firebase/app';
import {getAuth,setPersistence,browserLocalPersistence,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged,type Auth,type User} from 'firebase/auth';
import {getFirestore,type Firestore} from 'firebase/firestore';
import type {AuthProvider,UserContext} from '../types';
import type {FirebaseAccount} from './protocol';
export function firebaseConfig(env:Record<string,unknown>=import.meta.env):FirebaseOptions|null {
 const fields={apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,appId:env.VITE_FIREBASE_APP_ID};
 if(Object.values(fields).some(v=>typeof v!=='string'||!v.trim()))return null;
 return {...fields, ...(typeof env.VITE_FIREBASE_MESSAGING_SENDER_ID==='string'?{messagingSenderId:env.VITE_FIREBASE_MESSAGING_SENDER_ID}:{}),...(typeof env.VITE_FIREBASE_STORAGE_BUCKET==='string'?{storageBucket:env.VITE_FIREBASE_STORAGE_BUCKET}:{})} as FirebaseOptions;
}
const accountOf=(u:User|null):FirebaseAccount|null=>u?{uid:u.uid,email:u.email,displayName:u.displayName}:null;
export class FirebaseAuthProvider implements AuthProvider {
 readonly configured:boolean;initializationError:string|null=null;private auth:Auth|null=null;private app:FirebaseApp|null=null;private ready:Promise<void>=Promise.resolve();
 constructor(config:FirebaseOptions|null=firebaseConfig()){
  this.configured=config!==null;if(!config)return;
  try {
  const existing=getApps().find(a=>a.name==='ap2-personal-sync');
  if(existing&&existing.options.projectId!==config.projectId)throw Error('Firebase project changed. Reload before signing in.');
  this.app=existing??initializeApp(config,'ap2-personal-sync');this.auth=getAuth(this.app);
  this.ready=setPersistence(this.auth,browserLocalPersistence).then(()=>this.auth!.authStateReady()).catch(()=>{this.initializationError='Google-Anmeldung konnte nicht initialisiert werden. Lokales Lernen bleibt verfügbar.';});
  // Initialization errors remain observable through restore/login; avoid an unhandled startup rejection.
  void this.ready.catch(()=>undefined);
  }catch{this.auth=null;this.app=null;this.initializationError='Google-Anmeldung konnte nicht initialisiert werden. Lokales Lernen bleibt verfügbar.';}
 }
 account():FirebaseAccount|null{return this.initializationError?null:accountOf(this.auth?.currentUser??null);}
 async currentUser():Promise<UserContext>{await this.ready;return this.context();}
 async restoreSession():Promise<UserContext>{return this.currentUser();}
 private context():UserContext {const uid=this.account()?.uid;return uid?{id:uid,mode:'remote'}:{id:'local',mode:'local'};}
 async login(_credentials:Readonly<Record<string,unknown>>={}):Promise<UserContext>{
  if(!this.auth)throw Error('Firebase ist noch nicht konfiguriert.');await this.ready;if(this.initializationError)throw Error(this.initializationError);
  const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(this.auth,provider);return this.context();
 }
 async logout():Promise<void>{if(this.auth){await this.ready;await signOut(this.auth);}}
 onAuthChanged(callback:(account:FirebaseAccount|null)=>void):()=>void{
  if(!this.auth){queueMicrotask(()=>callback(null));return()=>undefined;}
  let active=true;const unsubscribe=onAuthStateChanged(this.auth,()=>{void this.ready.then(()=>{if(active)callback(this.account());});});return()=>{active=false;unsubscribe();};
 }
 firestore():Firestore {if(!this.app)throw Error('Firebase ist noch nicht konfiguriert.');return getFirestore(this.app);}
}
