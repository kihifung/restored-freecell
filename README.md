# 土木工程 Spider Solitaire - restored source

This folder is a source-level reconstruction of:

`C:\Users\USER\文件\kihifung\game\FreeCell\土木工程.exe`

The original executable is a 32-bit Windows PE file from the Windows Plus!/ME era. It does not contain the original C/C++ source text, so this project restores the playable game by extracting the embedded resources and rebuilding the Spider Solitaire logic in readable HTML, CSS, and JavaScript.

## What was recovered

- Original card bitmap resources: `assets/cards/CARD1.bmp` through `assets/cards/CARD52.bmp`
- Browser-safe PNG copies: `assets/cards-png/CARD1.png` through `assets/cards-png/CARD52.png`
- Original card back and felt bitmap resources
- Original WAV resources: `assets/sounds/*.wav`
- A playable Spider Solitaire implementation using the recovered assets

## Rules implemented

- The game uses 104 cards: two decks for 4-suit mode, four duplicated sets per suit for 2-suit mode, or eight duplicated sets for 1-suit mode.
- 54 cards are dealt into 10 tableau columns: the first 4 columns receive 6 cards and the last 6 receive 5 cards.
- Only the top card of each initial column is face up.
- The remaining 50 cards form 5 stock deals, each dealing one face-up card to every column.
- Tableau cards can be stacked downward by rank regardless of suit.
- Only face-up same-suit descending sequences can move together.
- Empty columns can accept any movable card or same-suit sequence.
- A complete same-suit K-to-A run is removed automatically.
- Stock cannot be dealt while any tableau column is empty.
- Scoring follows the classic Windows Spider Solitaire style: 500 initial points, -1 for each move, -1 for each undo, and +100 for each completed same-suit run.

## Card resource order

- `CARD1` - `CARD13`: clubs A-K
- `CARD14` - `CARD26`: diamonds A-K
- `CARD27` - `CARD39`: hearts A-K
- `CARD40` - `CARD52`: spades A-K

## Run

Open `index.html` in a browser.

## Notes

The reconstructed code preserves the original visual assets, but it is not a byte-for-byte decompilation of the original native Win32 program. A perfect restoration would require debug symbols or the original source files, which are not present in the executable.
