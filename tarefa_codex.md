Continue the CSS refactor analysis.

Look at style.css and identify ALL responsive rules inside media queries.

Example patterns:

@media (max-width: ...)
@media (orientation: landscape)
@media (max-height: ...)

Your task:

1. Identify which rules are purely responsive adjustments
2. Show which ones could move safely to:

css/mobile/mobile-layout.css

Do NOT move rules that change gameplay layout or positioning of core UI elements yet.

Examples of elements to keep in style.css for now:

.painel
.controles
.placas
.reel
.cards
.buttons
.jackpot
.animations

Output:
Show the CSS blocks that are candidates for mobile-layout.css.

Do not modify files yet.