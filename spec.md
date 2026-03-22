# Football Memory Match

## Current State
New project. No existing application files.

## Requested Changes (Diff)

### Add
- Full Football Memory Match game converted from plain HTML/JS to React + TypeScript
- Motoko backend to persist best scores per difficulty and mode (replacing localStorage)
- Game board with 3D card flip animations
- Difficulty modes: Easy (4x3), Medium (5x4), Hard (6x6)
- Game modes: Default football emojis, Custom emoji input
- Brief reveal mechanic on game start (cards flash face-up briefly)
- Timer, moves counter, best score display
- Win overlay with stats and play again button
- Accessible markup (aria-live, aria-label, keyboard focus)
- Smooth match-pop animation on matched pairs

### Modify
- N/A (new project)

### Remove
- N/A (new project)

## Implementation Plan
1. Motoko backend: store best scores keyed by (mode, difficulty) as a stable HashMap, expose query/update functions
2. React frontend: game logic as custom hook (useMemoryGame), board rendering, toolbar, overlays
3. Card component with CSS 3D flip animation using Tailwind + inline styles
4. Best score synced to backend on win; loaded on mount
