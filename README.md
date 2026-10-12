# Folio

Folio is a word processor for the ordinary work of writing: letters, notes, briefs, and handouts. You format on a page, and you can take the file with you as a PDF or a Word document.

Documents stay in this browser. Nothing is uploaded.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:4317](http://localhost:4317).

## What you can do

- Write with headings, quotes, lists, checklists, tables, pictures, links, and page breaks
- Set font, size, color, highlight, alignment, indent, and line spacing
- Choose Letter or A4, and narrow, normal, or wide margins
- Find and replace
- Open `.docx`, `.html`, and Folio `.json` files
- Export PDF, Word (`.docx`), HTML, or a Folio file
- Print from the browser

The page uses Tinos, Arimo, and Cousine, which match Times New Roman, Arial, and Courier New. PDF files embed those fonts, so the text stays selectable. Word files ask for the matching system fonts.

## Storage

Folio saves automatically in `localStorage` on this computer. Export a copy if you want the file somewhere else, or before you clear the browser’s site data. Large pictures can fill that storage.

## Font license

The bundled fonts are Tinos, Arimo, and Cousine, used under the SIL Open Font License. See `public/fonts/OFL.txt`.
