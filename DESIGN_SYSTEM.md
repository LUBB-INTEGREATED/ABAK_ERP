# ABAK ERP - Design System

Design guidelines and theme based on ABAK Engineering Consultancy brand identity.

## 🎨 Brand Colors

### Primary Colors

**ABAK Blue** (Primary)

- Hex: `#236382`
- RGB: `35, 99, 130`
- HSL: `196°, 58%, 32%`
- Usage: Primary buttons, headers, main navigation, links, brand elements
- Represents: Trust, professionalism, engineering expertise

**ABAK Gold** (Secondary)

- Hex: `#A78B42`
- RGB: `167, 139, 66`
- HSL: `43°, 43%, 46%`
- Usage: Accents, highlights, success states, premium features
- Represents: Quality, premium service, excellence

### Supporting Colors

**Dark Text**

- Hex: `#1B1B1B`
- RGB: `27, 27, 27`
- Usage: Primary text, headings

**Light Gold**

- Hex: `#C4B997`
- RGB: `196, 185, 151`
- Usage: Subtle accents, hover states, backgrounds

**Off White**

- Hex: `#F9F7F5`
- RGB: `249, 247, 245`
- Usage: Page backgrounds, cards

### Status Colors

**Success** - Derived from Gold

- Hex: `#A78B42` (Use brand gold for success)
- Usage: Completed tasks, approved quotes, won deals

**Warning** - Warm Amber

- Hex: `#D97706`
- Usage: Pending approvals, due soon notifications

**Error** - Professional Red

- Hex: `#DC2626`
- Usage: Errors, rejections, overdue items

**Info** - Lighter Blue

- Hex: `#3B82F6`
- Usage: Information, tooltips, help text

## 🖼️ Logo Usage

### Primary Logo

- Circular symbol with blue and gold swirl
- "abak" wordmark in blue (#236382)
- "Engineering Consultancy" tagline in gold (#A78B42)
- Arabic translation below

### Logo Variations Needed

- Full logo (with tagline) - for login, reports
- Symbol only - for favicon, small spaces
- Horizontal - for header navigation
- Monochrome - for watermarks, prints

### Logo Placement

- **Header**: Horizontal logo with symbol + "abak" wordmark
- **Login Page**: Full logo centered
- **PDF Reports**: Full logo in header
- **Favicon**: Symbol only

## 📝 Typography

### Font Stack

**Primary Font**: Inter (Clean, modern, excellent for UI)

```css
font-family:
  'Inter',
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  sans-serif;
```

**Arabic Font**: Cairo or Tajawal (Modern Arabic font that pairs with Inter)

```css
font-family: 'Cairo', 'Inter', sans-serif;
```

**Monospace**: For code, IDs, numbers

```css
font-family: 'JetBrains Mono', 'Courier New', monospace;
```

### Type Scale

```css
/* Headings */
h1: 2.5rem (40px)   - font-weight: 700 - Page titles
h2: 2rem (32px)     - font-weight: 600 - Section titles
h3: 1.5rem (24px)   - font-weight: 600 - Card titles
h4: 1.25rem (20px)  - font-weight: 500 - Subsections
h5: 1.125rem (18px) - font-weight: 500 - Small titles

/* Body */
base: 1rem (16px)   - font-weight: 400 - Body text
small: 0.875rem (14px) - font-weight: 400 - Helper text
xs: 0.75rem (12px)  - font-weight: 400 - Captions
```

## 🎯 UI Components Style

### Buttons

**Primary Button** (ABAK Blue)

```css
background: #236382
color: white
hover: #1a4d66 (darker blue)
padding: 12px 24px
border-radius: 8px
font-weight: 600
```

**Secondary Button** (ABAK Gold)

```css
background: #A78B42
color: white
hover: #8b7236 (darker gold)
```

**Outline Button**

```css
border: 2px solid #236382
color: #236382
background: transparent
hover: background: #236382, color: white
```

### Cards

```css
background: white
border: 1px solid #E5E7EB
border-radius: 12px
padding: 24px
box-shadow: 0 1px 3px rgba(0,0,0,0.1)
```

### Inputs

```css
border: 1px solid #D1D5DB
border-radius: 8px
padding: 10px 14px
focus: border-color: #236382, ring: 2px #236382 with 20% opacity
```

### Status Badges

**New/Active**

```css
background: #236382 with 10% opacity
color: #236382
```

**Success/Won**

```css
background: #A78B42 with 10% opacity
color: #A78B42
```

**Warning/Pending**

```css
background: #FEF3C7
color: #D97706
```

**Error/Lost**

```css
background: #FEE2E2
color: #DC2626
```

## 📐 Spacing System

Using 8px base unit:

```
xs: 4px    (0.5 units)
sm: 8px    (1 unit)
md: 16px   (2 units)
lg: 24px   (3 units)
xl: 32px   (4 units)
2xl: 48px  (6 units)
3xl: 64px  (8 units)
```

## 🌓 Dark Mode (Future)

Not in Phase 1, but prepared:

```css
/* Dark Mode Colors */
Background: #0F172A (dark blue-gray)
Surface: #1E293B
Text: #F1F5F9
Primary: #3B82F6 (lighter blue for dark mode)
Secondary: #C4B997 (lighter gold)
```

## 📱 Responsive Breakpoints

```css
sm: 640px   - Mobile landscape
md: 768px   - Tablet
lg: 1024px  - Desktop
xl: 1280px  - Large desktop
2xl: 1536px - Extra large
```

## ♿ Accessibility

### Color Contrast

- Text on ABAK Blue background: Use white text (AAA)
- Text on ABAK Gold background: Use white or dark text (AA minimum)
- All interactive elements: Minimum 4.5:1 contrast ratio

### Focus States

- All interactive elements have visible focus ring
- Focus ring: 2px solid ABAK Blue with 2px offset

### Font Sizes

- Minimum body text: 16px
- Minimum interactive target: 44px × 44px (touch)

## 🌍 Internationalization (i18n)

### Language Support

- **Primary**: Arabic (RTL)
- **Secondary**: English (LTR)

### RTL Considerations

- All layouts must support RTL
- Icons and images mirror appropriately
- Numbers and IDs remain LTR in RTL context

## 🎨 Tailwind CSS Configuration

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        // Brand colors
        'abak-blue': {
          DEFAULT: '#236382',
          50: '#E8F2F6',
          100: '#D1E5ED',
          200: '#A3CBD9',
          300: '#75B1C6',
          400: '#4997B3',
          500: '#236382', // Main
          600: '#1C4F68',
          700: '#153B4E',
          800: '#0E2734',
          900: '#07141A',
        },
        'abak-gold': {
          DEFAULT: '#A78B42',
          50: '#F5F1E8',
          100: '#EBE3D1',
          200: '#D7C7A3',
          300: '#C3AB75',
          400: '#AF8F47',
          500: '#A78B42', // Main
          600: '#866F35',
          700: '#645328',
          800: '#43371A',
          900: '#211C0D',
        },
        // UI colors
        'dark-text': '#1B1B1B',
        'off-white': '#F9F7F5',
      },
      fontFamily: {
        sans: ['Inter', 'Cairo', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
};
```

## 📋 Component Examples

### Dashboard Card

```tsx
<div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
  <h3 className="text-lg font-semibold text-dark-text mb-2">Card Title</h3>
  <p className="text-gray-600">Card content</p>
</div>
```

### Primary Button

```tsx
<button className="bg-abak-blue hover:bg-abak-blue-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
  Click Me
</button>
```

### Status Badge

```tsx
<span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-abak-gold/10 text-abak-gold">
  Active
</span>
```

## 🖼️ Icons

**Icon Library**: Lucide React (clean, consistent, professional)

- Stroke width: 2px
- Size: 20px for inline, 24px for standalone
- Color: Inherit from parent or use brand colors

## 📐 Layout Principles

### Navigation

- Top navigation bar: ABAK Blue background
- Sidebar: White background with ABAK Blue active states
- Logo placement: Top left
- User menu: Top right

### Content Area

- Max width: 1280px for comfortable reading
- Padding: 24px on desktop, 16px on mobile
- Background: Off-white (#F9F7F5)

### Data Tables

- Alternating row backgrounds for readability
- Sticky header
- ABAK Blue for sortable column headers
- Hover state on rows

## 🎯 Implementation Checklist

- [ ] Copy logo files to `apps/web/public/`
- [ ] Update Tailwind config with brand colors
- [ ] Create reusable component library with brand styling
- [ ] Set up Arabic font (Cairo/Tajawal)
- [ ] Configure i18n for RTL support
- [ ] Create color CSS variables
- [ ] Design button component variants
- [ ] Create badge component with status colors
- [ ] Build card component with brand styling
- [ ] Test accessibility (color contrast, focus states)
- [ ] Create design tokens file for consistent spacing

---

**Version**: 1.0
**Last Updated**: 2026-04-20
**Status**: Ready for Implementation
