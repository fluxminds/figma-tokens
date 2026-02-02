# DTCG Token Manager

A Figma plugin for importing and exporting [W3C Design Tokens Community Group (DTCG)](https://design-tokens.github.io/community-group/format/) format tokens.

## Features

- **Import** DTCG JSON tokens into Figma Variables and Effect Styles
- **Export** Figma Variables and Effect Styles to DTCG JSON format
- **Conflict detection** with options to override or skip existing items
- Supports colors, typography, spacing, border, effects, and layout tokens
- Converts shadow tokens to Figma Effect Styles

## Installation

### From Figma Community
*(Coming soon)*

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/figma-token.git
   cd figma-token
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. In Figma, go to **Plugins > Development > Import plugin from manifest**
5. Select the `manifest.json` file from this project

## Usage

### Importing Tokens

1. Open the plugin in Figma
2. Paste your DTCG JSON into the text area, or click **Upload File** to select a JSON file
3. Click **Import Tokens**
4. If conflicts are detected (existing variables/styles with the same name), you'll be prompted to:
   - **Override** - Update this item
   - **Ignore** - Skip this item
   - **Override All** - Update all conflicting items
   - **Ignore All** - Skip all conflicting items

### Exporting Tokens

1. Click the **Export** button
2. Once complete, you can:
   - **Copy JSON** - Copy to clipboard
   - **Download** - Save as `tokens.json`

## Supported Token Types

| DTCG Type | Figma Type |
|-----------|------------|
| `color` | Color Variable |
| `dimension` | Float Variable |
| `fontFamily` | String Variable |
| `fontWeight` | Float Variable |
| `duration` | Float Variable |
| `number` | Float Variable |
| `shadow` | Effect Style (Drop Shadow) |

## Token Format Example

```json
{
  "color": {
    "$type": "color",
    "primary": {
      "500": { "$value": "#3B82F6" },
      "600": { "$value": "#2563EB" }
    }
  },
  "spacing": {
    "$type": "dimension",
    "sm": { "$value": "8px" },
    "md": { "$value": "16px" },
    "lg": { "$value": "24px" }
  },
  "shadow": {
    "$type": "shadow",
    "sm": {
      "$value": {
        "offsetX": "0px",
        "offsetY": "1px",
        "blur": "2px",
        "spread": "0px",
        "color": "#00000026"
      }
    }
  }
}
```

## Development

### Scripts

- `npm run build` - Build the plugin
- `npm run watch` - Watch for changes and rebuild

### Project Structure

```
├── src/
│   ├── code.ts          # Main plugin code
│   ├── ui.html          # Plugin UI
│   ├── types/           # TypeScript types
│   ├── parsers/         # Token value parsers
│   ├── creators/        # Figma variable/style creators
│   ├── exporters/       # JSON export functionality
│   └── utils/           # Utility functions
├── dist/                # Built files
├── manifest.json        # Figma plugin manifest
└── icon.svg            # Plugin icon
```

## License

MIT
