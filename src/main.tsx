import React from 'react';
import { createRoot } from 'react-dom/client';
import StudyApp from './learning/LearningApp';
import './style.css';
import {AppServicesProvider} from './services/context';
import {createLocalServices} from './services/composition';
const root=createRoot(document.getElementById('root')!);
void createLocalServices().then(services=>root.render(<React.StrictMode><AppServicesProvider services={services}><StudyApp/></AppServicesProvider></React.StrictMode>)).catch(()=>root.render(<main role="alert">Der Lernplatz konnte nicht geöffnet werden. Bitte lade die Seite erneut. Deine gespeicherten Daten bleiben erhalten.</main>));
