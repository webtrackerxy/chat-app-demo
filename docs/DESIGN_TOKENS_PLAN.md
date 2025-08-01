# Design Token Implementation Plan

## 📋 Overview
Integrate the comprehensive design token system into the existing React Native chat app components, replacing hardcoded styles with a systematic, maintainable theme approach.

## 🎯 Goals
- Replace hardcoded colors, typography, and spacing with design tokens
- Create a centralized theme system for consistent styling
- Maintain existing component functionality while improving maintainability
- Ensure accessibility and responsive design

## 📊 Current State Analysis

### Current Styling System
- **StyleSheet.create()**: Primary styling approach (no NativeWind usage)
- **No theme system**: Currently no centralized theme or styling system
- **Hardcoded values**: Colors, typography, and spacing are hardcoded throughout components

### Current Color Patterns
- **Primary Blue**: `#007AFF` (buttons, links, actions)
- **Secondary Gray**: `#f0f0f0`, `#ddd`, `#eee` (backgrounds, borders)
- **Message Colors**: Blue (`#007AFF`) for own messages, Green (`#4CAF50`) for others
- **Status Colors**: Red (`#ff3b30`) for errors, Green for success states
- **Text Colors**: White (`#fff`), various grays (`#666`, `#333`, `#999`)

### Current Typography Patterns
- **Font Sizes**: 18px, 16px, 14px, 12px, 10px
- **Font Weights**: 400 (regular), 600 (semi-bold), 700 (bold)
- **No systematic line height or letter spacing**

### Current Spacing Patterns
- **Padding/Margins**: 4px, 8px, 12px, 16px, 20px, 24px
- **Border Radius**: 8px, 12px, 14px, 16px, 20px, 25px

## 🏗️ Implementation Strategy

### Phase 1: Theme Infrastructure (Priority: High)

#### 1.1 Create Theme System
```
src/theme/
  index.ts              # Theme exports and useTheme hook
  tokens.ts             # Processed design tokens
  spacing.ts            # Spacing scale
  shadows.ts            # Shadow definitions
  utils.ts              # Theme utility functions
```

#### 1.2 Move Design Tokens
- Move `design-tokens-test-2025-07-16.json` to `src/theme/`
- Add `@theme` path mapping to tsconfig.json and jest.config.js
- Create TypeScript types for design tokens

#### 1.3 Add Missing Token Categories
- **Spacing Scale**: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px
- **Border Radius Scale**: 4px, 8px, 12px, 16px, 20px, 25px, 50%
- **Shadow/Elevation Tokens**: Based on Material Design elevation
- **Icon Sizes**: 16px, 20px, 24px, 32px, 40px

#### 1.4 Create Theme Hook
```typescript
export const useTheme = () => {
  return {
    colors: processedColors,
    typography: processedTypography,
    spacing: spacingScale,
    borderRadius: borderRadiusScale,
    shadows: shadowTokens
  }
}
```

### Phase 2: Core Component Migration (Priority: High)

#### 2.1 Button Component
**Current → Token Mapping:**
- Primary background: `#007AFF` → `PRIMARY_500`
- Secondary background: `#f0f0f0` → `GRAY_100`
- Danger background: `#ff3b30` → `ERROR_500`
- Success background: `#4CAF50` → `SUCCESS_500`
- Text: `BODY_M_BOLD` for primary, `BODY_S_BOLD` for small buttons
- Padding: Standardized using spacing tokens
- Border radius: `borderRadius.md` (8px)

**States to implement:**
- Default, hover, pressed, disabled
- Loading state with appropriate colors

#### 2.2 Input Component
**Current → Token Mapping:**
- Border default: `#ddd` → `GRAY_300`
- Border focus: `#007AFF` → `PRIMARY_500`
- Border error: `#ff3b30` → `ERROR_500`
- Background: `#fff` → `BASE_WHITE`
- Text: `BODY_M_REGULAR`
- Label: `BODY_S_BOLD`
- Placeholder: `GRAY_400`

#### 2.3 Header Component
**Current → Token Mapping:**
- Title: `HEADING_4_MOBILE` (20px) / `HEADING_4_DESKTOP` (30px)
- Subtitle: `BODY_S_REGULAR` 
- Text color: `GRAY_900`
- Background: `BASE_WHITE`
- Border: `GRAY_200`
- Action buttons: `PRIMARY_500`

### Phase 3: Message Components (Priority: Medium)

#### 3.1 MessageItem Component
**Current → Token Mapping:**
- Own message bubble: `#007AFF` → `PRIMARY_500`
- Other message bubble: `#4CAF50` → `SUCCESS_500` or `GRAY_100`
- Text on colored: `BASE_WHITE`
- Text on light: `GRAY_900`
- Message text: `BODY_M_REGULAR`
- Sender name: `BODY_XS_BOLD` with `PRIMARY_700` / `SUCCESS_700`
- Timestamp: `BODY_XS_REGULAR` with `GRAY_500`
- Border radius: `borderRadius.lg` (12px)

#### 3.2 MessageInput Component
**Current → Token Mapping:**
- Input styling: Follow Input component patterns
- Send button: `PRIMARY_500` background, `BASE_WHITE` icon
- Attachment buttons: `GRAY_500` with hover states
- Voice button: `ERROR_500` when recording

### Phase 4: Advanced Components (Priority: Medium)

#### 4.1 Modal/ActionModal
**Current → Token Mapping:**
- Background: `BASE_WHITE`
- Overlay: `BASE_BLACK` with 0.5 opacity
- Title: `HEADING_5_MOBILE` / `HEADING_5_DESKTOP`
- Body text: `BODY_M_REGULAR`
- Buttons: Follow Button component patterns
- Border radius: `borderRadius.xl` (16px)

#### 4.2 ConversationItem
**Current → Token Mapping:**
- Background default: `BASE_WHITE`
- Background hover: `GRAY_50`
- Name: `BODY_M_BOLD` with `GRAY_900`
- Last message: `BODY_S_REGULAR` with `GRAY_600`
- Timestamp: `BODY_XS_REGULAR` with `GRAY_500`
- Unread indicator: `PRIMARY_500`

### Phase 5: Status & Feedback Components (Priority: Low)

#### 5.1 EmptyState Component
**Current → Token Mapping:**
- Title: `HEADING_6_MOBILE` / `HEADING_6_DESKTOP`
- Description: `BODY_M_REGULAR`
- Text color: `GRAY_500`
- Icon color: `GRAY_400`

#### 5.2 File/Media Components
**Current → Token Mapping:**
- FileMessage background: `GRAY_100`
- File type indicators: Use accent colors (`ACCENT_YELLOW`, `ACCENT_PINK`)
- Progress bars: `PRIMARY_500` with `PRIMARY_100` background
- Control buttons: `GRAY_600` with `PRIMARY_500` active states

## 🛠️ Technical Implementation

### Token Processing
```typescript
// Convert JSON tokens to usable TypeScript constants
export const colors = {
  primary: {
    25: '#EAFDFA',
    50: '#DAFBF7',
    // ... rest of scale
    500: '#4EB6C4', // Main brand color
    // ... rest of scale
    900: '#003640'
  },
  gray: {
    25: '#FCFCFD',
    // ... full scale
    900: '#101828'
  },
  // ... other color categories
} as const

export const typography = {
  display: {
    1: { mobile: { fontSize: 48, lineHeight: 60, ... }, desktop: { ... } },
    // ... rest of display styles
  },
  heading: {
    1: { mobile: { fontSize: 36, lineHeight: 44, ... }, desktop: { ... } },
    // ... rest of heading styles
  },
  body: {
    l: { regular: { fontSize: 18, lineHeight: 26, ... }, bold: { ... } },
    m: { regular: { fontSize: 16, lineHeight: 24, ... }, bold: { ... } },
    s: { regular: { fontSize: 14, lineHeight: 20, ... }, bold: { ... } },
    xs: { regular: { fontSize: 12, lineHeight: 18, ... }, bold: { ... } }
  }
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40
} as const

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 25,
  full: '50%'
} as const
```

### Component Migration Pattern
```typescript
// Before
const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600'
  }
})

// After
import { useTheme } from '@theme'

const MyComponent = () => {
  const { colors, spacing, borderRadius, typography } = useTheme()
  
  const styles = StyleSheet.create({
    button: {
      backgroundColor: colors.primary[500],
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      ...typography.body.m.bold
    }
  })
}
```

## 📱 Platform & Accessibility Considerations

### Responsive Design
- Use mobile typography tokens for React Native
- Ensure minimum touch target size of 44px
- Scale appropriately for different screen densities

### Accessibility
- Maintain AAA contrast ratios where specified in tokens
- Use semantic color meanings (error, warning, success)
- Ensure sufficient color contrast for text readability

### Performance
- Memoize theme objects to prevent unnecessary re-renders
- Consider using StyleSheet.create() with processed tokens
- Minimize runtime token processing

## 🔄 Migration Process

### Step-by-Step Implementation
1. **Set up theme infrastructure** (Phase 1)
2. **Migrate Button component** (test thoroughly)
3. **Migrate Input component** (test thoroughly)
4. **Migrate Header component** (test thoroughly)
5. **Continue with remaining components** one at a time
6. **Run full test suite** after each component migration
7. **Update any dependent components** as needed

### Testing Strategy
- **Visual regression testing**: Compare before/after screenshots
- **Component testing**: Ensure all props and states work correctly
- **Integration testing**: Test component interactions
- **Accessibility testing**: Verify contrast ratios and touch targets

### Quality Assurance
- **Code review**: Ensure consistent token usage
- **Design review**: Verify visual consistency with design system
- **Performance testing**: Monitor app performance impact
- **Cross-platform testing**: Test on iOS, Android, and web

## ✅ Success Criteria

### Technical Goals
- [ ] All hardcoded colors replaced with design tokens
- [ ] Typography consistently uses token system
- [ ] Spacing follows standardized scale
- [ ] Border radius uses consistent scale
- [ ] Theme system is easily extensible

### Quality Goals
- [ ] Components remain functionally identical
- [ ] Performance is not negatively impacted
- [ ] Accessibility standards are maintained or improved
- [ ] Code maintainability is improved
- [ ] Design system is developer-friendly

### Documentation Goals
- [ ] Theme usage is documented
- [ ] Component migration guide is created
- [ ] Design token reference is available
- [ ] Examples of common patterns are provided

## 📚 Deliverables

1. **Theme Infrastructure**
   - `src/theme/` directory with all theme files
   - `useTheme` hook for component consumption
   - TypeScript types for design tokens

2. **Migrated Components**
   - All existing components using design tokens
   - Consistent styling patterns across components
   - Proper responsive behavior

3. **Documentation**
   - Theme usage guide
   - Component styling patterns
   - Design token reference
   - Migration checklist

4. **Testing**
   - Updated component tests
   - Visual regression test suite
   - Accessibility verification

## 🚀 Getting Started

To begin implementation:

1. Create the theme infrastructure (Phase 1)
2. Start with the Button component as a proof of concept
3. Establish the migration pattern and tooling
4. Continue systematically through all components
5. Document patterns and decisions as you go

This plan ensures a systematic, maintainable approach to implementing design tokens while preserving the existing functionality and improving the overall design consistency of the chat application.