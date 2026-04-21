# Setting Up ABAK Brand Design

Quick guide to implement ABAK Engineering Consultancy branding in the project.

## 📋 Steps to Apply Brand Design

### 1. Copy Logo Files

**After Next.js is set up** (Issue #002):

```bash
# Copy the logo to the public directory
mkdir -p apps/web/public/images
cp ../../logo.jpg apps/web/public/images/logo.jpg

# You'll need different logo variations:
# - logo.jpg (full logo with text)
# - logo-symbol.png (circular symbol only - for favicon)
# - logo-horizontal.png (horizontal version for header)
# - logo-white.png (white version for dark backgrounds)
```

### 2. Apply Tailwind Configuration

**When setting up Tailwind** (During Issue #002):

Replace the default `tailwind.config.ts` with the configuration from:

```
tailwind.config.example.ts
```

This includes:

- ✅ ABAK Blue (#236382) as primary color
- ✅ ABAK Gold (#A78B42) as secondary color
- ✅ Proper color shades (50-900)
- ✅ Brand-specific shadows and radius
- ✅ Arabic font support (Cairo)

### 3. Apply Global Styles

**When setting up globals.css** (During Issue #002):

Replace `src/app/globals.css` with content from:

```
globals.example.css
```

This includes:

- ✅ CSS variables for ABAK colors
- ✅ shadcn/ui integration with brand colors
- ✅ Utility classes (btn-primary, btn-secondary, card-abak, badges)
- ✅ RTL support for Arabic
- ✅ Font imports (Inter, Cairo, JetBrains Mono)

### 4. Install Fonts

The `globals.example.css` already imports fonts from Google Fonts:

- **Inter** - Primary UI font
- **Cairo** - Arabic font
- **JetBrains Mono** - Monospace for code/IDs

No additional installation needed!

### 5. Update shadcn/ui Components

**When installing shadcn/ui** (Issue #008):

During `npx shadcn-ui@latest init`, choose:

- Style: **Default**
- Base color: **Slate** (we'll override with ABAK colors)
- CSS variables: **Yes**

The colors are already configured in `globals.example.css`!

### 6. Create Favicon

**Create favicon from logo symbol**:

```bash
# You'll need to create these variations:
apps/web/public/favicon.ico          # 32x32 icon
apps/web/public/icon.png             # 192x192 icon
apps/web/public/apple-icon.png       # 180x180 Apple touch icon
```

Use the circular symbol from the logo (blue and gold swirl).

## 🎨 Using Brand Colors in Components

### In Tailwind Classes

```tsx
// Primary button (ABAK Blue)
<button className="bg-abak-blue hover:bg-abak-blue-600 text-white px-6 py-3 rounded-lg">
  Click Me
</button>

// Secondary button (ABAK Gold)
<button className="bg-abak-gold hover:bg-abak-gold-600 text-white px-6 py-3 rounded-lg">
  Submit
</button>

// Outline button
<button className="border-2 border-abak-blue text-abak-blue hover:bg-abak-blue hover:text-white px-6 py-3 rounded-lg">
  Cancel
</button>

// Card with brand styling
<div className="card-abak">
  <h3 className="text-abak-blue font-semibold">Card Title</h3>
  <p className="text-gray-600">Card content</p>
</div>

// Status badges
<span className="badge-active">Active</span>
<span className="badge-success">Success</span>
<span className="badge-warning">Pending</span>
<span className="badge-error">Error</span>
```

### In shadcn/ui Components

```tsx
import { Button } from "@/components/ui/button"

// Primary variant uses ABAK Blue automatically
<Button variant="default">Primary Action</Button>

// Secondary variant uses ABAK Gold
<Button variant="secondary">Secondary Action</Button>

// Outline variant uses ABAK Blue border
<Button variant="outline">Outline</Button>
```

## 🖼️ Logo Usage Examples

### In Next.js Components

```tsx
import Image from 'next/image'

// Header logo (horizontal)
<Image
  src="/images/logo-horizontal.png"
  alt="ABAK Engineering Consultancy"
  width={180}
  height={50}
  priority
/>

// Login page (full logo)
<Image
  src="/images/logo.jpg"
  alt="ABAK Engineering Consultancy"
  width={300}
  height={120}
  className="mx-auto"
/>

// Favicon (symbol only)
<link rel="icon" href="/favicon.ico" />
```

### In HTML Meta Tags

```html
<meta name="theme-color" content="#236382" />
<link rel="apple-touch-icon" href="/apple-icon.png" />
```

## 📱 PWA Configuration

**When setting up PWA** (Issue #009):

Update `public/manifest.json`:

```json
{
  "name": "ABAK ERP System",
  "short_name": "ABAK ERP",
  "description": "Engineering Consultancy Management System",
  "theme_color": "#236382",
  "background_color": "#F9F7F5",
  "display": "standalone",
  "icons": [
    {
      "src": "/icon.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## 🌍 Arabic/RTL Support

### Enable RTL in Next.js

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = 'ar'; // or 'en' based on user preference

  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <body className={lang === 'ar' ? 'font-arabic' : 'font-sans'}>
        {children}
      </body>
    </html>
  );
}
```

## ✅ Checklist

Use this checklist when implementing the design:

### Sprint 0 - Issue #002 (Next.js Setup)

- [ ] Copy logo files to `apps/web/public/images/`
- [ ] Replace `tailwind.config.ts` with brand configuration
- [ ] Replace `globals.css` with brand styles
- [ ] Verify fonts load correctly (Inter, Cairo)
- [ ] Test primary/secondary button colors

### Sprint 0 - Issue #008 (shadcn/ui Setup)

- [ ] Install shadcn/ui with CSS variables
- [ ] Verify Button components use brand colors
- [ ] Test all component variants (outline, ghost, etc.)
- [ ] Create sample page showing all components

### Sprint 0 - Issue #009 (PWA Setup)

- [ ] Create favicon from logo symbol
- [ ] Create app icons (192x192, 512x512)
- [ ] Update manifest.json with brand colors
- [ ] Set theme-color to ABAK Blue (#236382)

### Module Implementation

- [ ] Use brand colors consistently in all UIs
- [ ] Use status badge classes for lead/quote status
- [ ] Apply card-abak class for all cards
- [ ] Ensure RTL support for Arabic text
- [ ] Test color contrast for accessibility

## 📚 Reference Files

- **DESIGN_SYSTEM.md** - Complete design guidelines
- **tailwind.config.example.ts** - Tailwind configuration
- **globals.example.css** - Global styles and utilities
- **logo.jpg** - Original logo file (in parent directory)

## 🎨 Color Reference Quick Guide

| Color     | Hex       | Usage                              |
| --------- | --------- | ---------------------------------- |
| ABAK Blue | `#236382` | Primary buttons, navigation, links |
| ABAK Gold | `#A78B42` | Secondary actions, success states  |
| Dark Text | `#1B1B1B` | Body text, headings                |
| Off White | `#F9F7F5` | Page background                    |
| Warning   | `#D97706` | Warnings, pending states           |
| Error     | `#DC2626` | Errors, rejections                 |

## 🚀 Ready to Implement!

All design assets and configurations are ready. Just follow the checklist as you work through Sprint 0 issues!

For detailed design specifications, see **DESIGN_SYSTEM.md**.
