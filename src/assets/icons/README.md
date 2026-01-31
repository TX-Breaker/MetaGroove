# MetaGroove Icons

Questa cartella contiene le icone dell'estensione MetaGroove in diverse dimensioni.

## Icone Richieste

### Chrome Extension
- `icon-16.png` - 16x16px (toolbar)
- `icon-32.png` - 32x32px (Windows)
- `icon-48.png` - 48x48px (extension management)
- `icon-128.png` - 128x128px (Chrome Web Store)

### Firefox Add-on
- `icon-16.png` - 16x16px (toolbar)
- `icon-32.png` - 32x32px (add-ons manager)
- `icon-48.png` - 48x48px (add-ons manager)
- `icon-96.png` - 96x96px (add-ons manager)

## Design Guidelines

### Concept
L'icona rappresenta il concetto di "filtraggio musicale intelligente":
- 🎵 Nota musicale come elemento principale
- 🔍 Elemento di ricerca/filtro
- 🤖 Accenno di intelligenza artificiale
- 🎨 Palette colori moderna e accattivante

### Colori Principali
- **Primary**: #667eea (blu-viola)
- **Secondary**: #764ba2 (viola)
- **Accent**: #34c759 (verde)
- **Background**: #ffffff (bianco)

### Stile
- Design flat/minimal
- Bordi arrotondati
- Buon contrasto per visibilità
- Scalabile per tutte le dimensioni

## Generazione Icone

Per generare le icone dalle dimensioni base, puoi usare:

### ImageMagick
```bash
# Da icona base 512x512
convert icon-512.png -resize 128x128 icon-128.png
convert icon-512.png -resize 48x48 icon-48.png
convert icon-512.png -resize 32x32 icon-32.png
convert icon-512.png -resize 16x16 icon-16.png
```

### Online Tools
- [Favicon Generator](https://favicon.io/)
- [App Icon Generator](https://appicon.co/)
- [Icon Converter](https://convertio.co/png-ico/)

## SVG Source

Mantieni sempre una versione SVG dell'icona per:
- Scalabilità infinita
- Facilità di modifica
- Generazione automatica dimensioni
- Uso in documentazione

## Placeholder Icons

Attualmente sono presenti icone placeholder. Sostituisci con:
1. Design professionale dell'icona
2. Export nelle dimensioni richieste
3. Ottimizzazione per web (compressione PNG)
4. Test su diversi background

## Testing

Testa le icone su:
- Toolbar browser (sfondo chiaro/scuro)
- Extension popup
- Store listings
- Diversi sistemi operativi
- Diverse risoluzioni schermo