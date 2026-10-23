import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ModeRoot from './modes/ModeRoot';
import {applyPalette} from './design/palette';
import './design/fonts.css';
import './ui/styles.css';
import './ui/alem.css';
import './ui/fullscreen.css';
import './app/connected.css';
import './app/refinement.css';
import './play/play.css';
import './design/paper.css';
import './ui/city-shell.css';
import './ui/finish.css';

applyPalette(document.documentElement);
createRoot(document.getElementById('root')!).render(<StrictMode><ModeRoot /></StrictMode>);
