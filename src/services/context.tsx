import {createContext,useContext,type ReactNode} from 'react';
import type {AuthProvider,ProgressRepository,SyncProvider,UserContext} from '../types';
export interface AppServices {repository:ProgressRepository;auth:AuthProvider;sync:SyncProvider;user:UserContext}
const Context=createContext<AppServices|null>(null);
export function AppServicesProvider({services,children}:{services:AppServices;children:ReactNode}){return <Context.Provider value={services}><div key={services.user.id} style={{display:'contents'}}>{children}</div></Context.Provider>;}
export function useAppServices(){const services=useContext(Context);if(!services)throw Error('AppServicesProvider is required');return services;}
