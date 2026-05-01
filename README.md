# TEI Pages

A static site generator that transforms TEI XML documents into styled, readable web pages using Astro, CETEIcean, and ODD processing models.

## What is TEI?

The [Text Encoding Initiative (TEI)](https://tei-c.org/) is an international standard for encoding texts in XML. TEI is used by digital humanities scholars, archives, and libraries worldwide to mark up texts with rich structural and semantic metadata.

```xml
<sp>
  <speaker>HAMLET</speaker>
  <l>To be, or not to be, that is the question.</l>
</sp>
```

TEI documents are machine-readable but not human-readable. TEI Pages bridges that gap.

## How It Works

TEI Pages takes two inputs and produces a styled web page:

| Input | Description |
|-------|-------------|
| TEI XML | Your encoded document |
| ODD | Processing model defining how each element should render |

### The Pipeline

```
TEI XML + ODD Processing Model
         │
         ▼
┌─────────────────────────────┐
│  ProcessOddPM              │
│  • Parse ODD                │
│  • Generate CSS             │
│  • Extract behaviors        │
└─────────────────────────────┘
         │
         ▼
    Styled HTML5
         │
         ▼
    Rendered Web Page
```

## Project Structure

```
tei-pages/
├── src/
│   ├── pages/
│   │   ├── [page].astro      # Dynamic route for TEI documents
│   │   ├── processOddPm.ts   # ODD processing engine
│   │   ├── basicPM.odd       # Sample processing model
│   │   └── behaviorsCSSMap.ts# Behavior-to-CSS mapping
│   ├── components/
│   │   └── Alternate.astro   # Interactive alternate content controls
│   ├── tei/                  # Sample TEI XML files
│   │   ├── testTEI.xml
│   │   ├── testAlternate.xml
│   │   └── ...
│   └── layouts/
│       └── Layout.astro      # Base page layout
├── astro.config.mjs
└── package.json
```

## Key Files

### processOddPm.ts

The core processing engine. It:

1. **Parses the ODD** — Reads element specifications and their models
2. **Generates CSS** — Converts behaviors to CSS rules
3. **Applies CSS** — Attaches classes to TEI elements based on predicates
4. **Transforms to HTML5** — Uses CETEIcean to convert TEI to custom elements
5. **Extracts client behaviors** — Passes interactive behavior config to the client

### basicPM.odd

A sample ODD defining rendering rules:

```xml
<elementSpec ident="p" mode="change">
  <model behaviour="paragraph" cssClass="exampleClass" predicate="true()">
    <outputRendition>font-style: italics;</outputRendition>
  </model>
</elementSpec>

<elementSpec ident="choice" mode="change">
  <model predicate="sic and corr" behaviour="alternate">
    <param name="default" value="corr[1]"/>
    <param name="alternate" value="sic[1]"/>
  </model>
</elementSpec>
```

### behaviorsCSSMap.ts

Maps TEI behaviors to CSS:

```typescript
export const BEHAVIOR_CSS_MAP = {
  paragraph: `display: block; margin-top: 1em; ...`,
  inline: `display: inline;`,
  alternate: `display: inline;`,
  // ... more behaviors
};
```

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Astro](https://astro.build) | Static site framework |
| [CETEIcean](https://github.com/TEIC/CETEIcean) | TEI → HTML5 transformation |
| [FontoXPath](https://github.com/FontoFontoX/FontoXPath) | XPath predicate evaluation |
| [JSDOM](https://github.com/jsdom/jsdom) | Server-side DOM parsing |
| Tailwind CSS | Styling |

## Running the Project

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Visit `http://localhost:4321/testTEI` to see a sample page.

## Building

```bash
# Build for production
pnpm build
```

The build generates static HTML for each TEI file in `src/tei/`.

## Extending

### Adding New Behaviors

1. Add CSS to `behaviorsCSSMap.ts`:

```typescript
myBehavior: `
  display: block;
  background: #f0f0f0;
`,
```

2. Use in your ODD:

```xml
<model behaviour="myBehavior"/>
```

### Adding New Elements

Add to your ODD file:

```xml
<elementSpec ident="myElement" mode="change">
  <model behaviour="block" cssClass="my-custom-class"/>
</elementSpec>
```
