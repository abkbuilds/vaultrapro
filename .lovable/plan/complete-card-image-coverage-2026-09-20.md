# Complete card image coverage

## Goal
Every card tile and card page will show a stable visual, while exact card artwork remains limited to verified source images.

## Changes
- Expand the Japanese artwork backfill to retry every missing card across TCGdex, TCGplayer/TCGCSV, and the existing TCGGO feed.
- Improve matching for vintage Japanese sets where collector numbers are absent, using only unambiguous English-name and set matches; never attach uncertain artwork.
- Make holo and reverse-holo entries inherit the verified artwork of their base card when their separate record lacks an image.
- Protect the image-sync endpoint with the existing refresh secret and add a recurring image-coverage job for newly released cards.
- Replace the text-only empty state with a polished Pokémon-card-style “artwork unavailable” visual, so no card displays as a blank tile when no trustworthy scan exists.

## Verification
- Recount missing image fields by language and printing type.
- Confirm known English, Japanese, promo, holo, and reverse-holo cards display correctly on mobile.
- Run the project type check and inspect the live card grid and detail page.

## Data integrity
Exact artwork will never be generated, guessed, or copied from a different printing. Cards still absent from all verified sources will use the explicit unavailable visual until a real image is published.
