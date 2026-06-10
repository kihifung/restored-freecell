# Restoration notes

Source executable:

`C:\Users\USER\文件\kihifung\game\FreeCell\土木工程.exe`

Observed format:

- 32-bit Windows PE executable
- 5 sections: `.text`, `.data`, `.idata`, `.rsrc`, `.reloc`
- Native Win32 imports from `KERNEL32`, `USER32`, `GDI32`, `SHELL32`, `WINMM`, `COMCTL32`, and `ADVAPI32`
- Resource language: `1028`
- Large `.rsrc` section containing the visible game assets

Recovered resources:

- `WAVE` resources: `124` through `129`
- `BITMAP` resources:
  - `CARD1` through `CARD52`
  - `CARDBACK`
  - `FELT`
  - numeric bitmaps `106` and `108`
- PNG copies were generated from the recovered BMP files because Chromium-based browsers do not reliably render every legacy indexed BMP variant used by the original executable.
- `MENU`, `DIALOG`, `STRING`, `ACCELERATOR`, `ICON`, and `VERSION` resources are present in the executable

Restoration target:

- Microsoft Spider Solitaire 2.0 style rules from the Windows Plus!/ME era
- 104-card Spider layout with 10 tableau columns and 5 stock deals
- 1-suit, 2-suit, and 4-suit modes

Important limitation:

The original source text is not stored in the executable. The restored project is therefore a clean source reconstruction that reuses the recovered assets and recreates the Spider Solitaire behavior in maintainable source files.
