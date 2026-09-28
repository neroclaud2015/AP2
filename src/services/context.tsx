import {LOCAL_USER_ID} from './identity';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import type {AuthProvider,ProgressRepository,SyncProvider,UserContext} from '../types';
import type {SyncController} from '../sync/FirestoreSyncProvider';
export interface AppServices {syncControl?:SyncController;repository:ProgressRepository;auth:AuthProvider;sync:SyncProvider;user:UserContext}
const Context=createContext<AppServices|null>(null);
export function AppServicesProvider({services,children}:{services:AppServices;children:ReactNode}){const [user,setUser]=useState(services.user);useEffect(()=>services.syncControl?.auth.onAuthChanged(account=>setUser(account?{id:account.uid,mode:'remote'}:services.user.mode==='local'?services.user:{id:LOCAL_USER_ID,mode:'local'})),[services]);return <Context.Provider value={{...services,user}}><div key={user.id} style={{display:'contents'}}>{children}</div></Context.Provider>;}
export function useAppServices(){const services=useContext(Context);if(!services)throw Error('AppServicesProvider is required');return services;}
