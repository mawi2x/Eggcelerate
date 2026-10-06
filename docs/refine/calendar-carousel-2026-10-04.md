# Incubation calendar carousel

The desktop calendar now shares the mobile carousel body. It shows the month
grid first, followed by the weekly strip and cycle schedule. Desktop adds
previous/next arrows alongside pagination dots; mobile retains swipe/dot
navigation and its existing initial summary view.

Both panels occupy one grid cell and remain in layout so the card reserves the
taller panel's height. The month grid always has six rows. Hidden panels are
inert and aria-hidden. Desktop skips the mobile sheet entrance animation.

Verified desktop arrows, stable card height and mobile calendar switching in
Chromium at 1164px and 393px. Screen rendering tests, typecheck and lint passed.
