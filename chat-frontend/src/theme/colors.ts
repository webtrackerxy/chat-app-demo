import designTokensJson from './design-tokens.json'

// Light mode colors (existing)
export const lightColors = {
  base: {
    white: designTokensJson.colors.BASE_WHITE.value,
    black: designTokensJson.colors.BASE_BLACK.value,
  },
  primary: {
    25: designTokensJson.colors.PRIMARY_25.value,
    50: designTokensJson.colors.PRIMARY_50.value,
    100: designTokensJson.colors.PRIMARY_100.value,
    200: designTokensJson.colors.PRIMARY_200.value,
    300: designTokensJson.colors.PRIMARY_300.value,
    400: designTokensJson.colors.PRIMARY_400.value,
    500: designTokensJson.colors.PRIMARY_500.value,
    600: designTokensJson.colors.PRIMARY_600.value,
    700: designTokensJson.colors.PRIMARY_700.value,
    800: designTokensJson.colors.PRIMARY_800.value,
    900: designTokensJson.colors.PRIMARY_900.value,
  },
  gray: {
    25: designTokensJson.colors.GRAY_25.value,
    50: designTokensJson.colors.GRAY_50.value,
    100: designTokensJson.colors.GRAY_100.value,
    200: designTokensJson.colors.GRAY_200.value,
    300: designTokensJson.colors.GRAY_300.value,
    400: designTokensJson.colors.GRAY_400.value,
    500: designTokensJson.colors.GRAY_500.value,
    600: designTokensJson.colors.GRAY_600.value,
    700: designTokensJson.colors.GRAY_700.value,
    800: designTokensJson.colors.GRAY_800.value,
    900: designTokensJson.colors.GRAY_900.value,
  },
  error: {
    25: designTokensJson.colors.ERROR_25.value,
    50: designTokensJson.colors.ERROR_50.value,
    100: designTokensJson.colors.ERROR_100.value,
    200: designTokensJson.colors.ERROR_200.value,
    300: designTokensJson.colors.ERROR_300.value,
    400: designTokensJson.colors.ERROR_400.value,
    500: designTokensJson.colors.ERROR_500.value,
    600: designTokensJson.colors.ERROR_600.value,
    700: designTokensJson.colors.ERROR_700.value,
    800: designTokensJson.colors.ERROR_800.value,
    900: designTokensJson.colors.ERROR_900.value,
  },
  warning: {
    25: designTokensJson.colors.WARNING_25.value,
    50: designTokensJson.colors.WARNING_50.value,
    100: designTokensJson.colors.WARNING_100.value,
    200: designTokensJson.colors.WARNING_200.value,
    300: designTokensJson.colors.WARNING_300.value,
    400: designTokensJson.colors.WARNING_400.value,
    500: designTokensJson.colors.WARNING_500.value,
    600: designTokensJson.colors.WARNING_600.value,
    700: designTokensJson.colors.WARNING_700.value,
    800: designTokensJson.colors.WARNING_800.value,
    900: designTokensJson.colors.WARNING_900.value,
  },
  success: {
    25: designTokensJson.colors.SUCCESS_25.value,
    50: designTokensJson.colors.SUCCESS_50.value,
    100: designTokensJson.colors.SUCCESS_100.value,
    200: designTokensJson.colors.SUCCESS_200.value,
    300: designTokensJson.colors.SUCCESS_300.value,
    400: designTokensJson.colors.SUCCESS_400.value,
    500: designTokensJson.colors.SUCCESS_500.value,
    600: designTokensJson.colors.SUCCESS_600.value,
    700: designTokensJson.colors.SUCCESS_700.value,
    800: designTokensJson.colors.SUCCESS_800.value,
    900: designTokensJson.colors.SUCCESS_900.value,
  },
  accent: {
    yellow: designTokensJson.colors.ACCENT_YELLOW.value,
    pink: designTokensJson.colors.ACCENT_PINK.value,
    paper: designTokensJson.colors.ACCENT_PAPER.value,
    ink: designTokensJson.colors.ACCENT_INK.value,
  },
} as const

// Dark mode colors (inverted grays + adjusted backgrounds)
export const darkColors = {
  base: {
    white: designTokensJson.colors.BASE_BLACK.value, // Inverted for dark mode
    black: designTokensJson.colors.BASE_WHITE.value, // Inverted for dark mode
  },
  primary: {
    // Keep primary colors mostly the same, slightly adjusted for dark backgrounds
    25: '#001C20', // Very dark teal for dark mode
    50: '#002428',
    100: '#003640',
    200: '#0A4B55',
    300: '#147F8E',
    400: '#4EB6C4',
    500: designTokensJson.colors.PRIMARY_500.value, // Keep main brand color
    600: '#79D2DA',
    700: '#96E7EA',
    800: '#BBF4F2',
    900: '#EAFDFA',
  },
  gray: {
    // Inverted gray scale for dark mode
    25: designTokensJson.colors.GRAY_900.value, // Darkest becomes lightest background
    50: designTokensJson.colors.GRAY_800.value,
    100: designTokensJson.colors.GRAY_700.value,
    200: designTokensJson.colors.GRAY_600.value,
    300: designTokensJson.colors.GRAY_500.value,
    400: designTokensJson.colors.GRAY_400.value,
    500: designTokensJson.colors.GRAY_400.value, // Middle stays similar
    600: designTokensJson.colors.GRAY_300.value,
    700: designTokensJson.colors.GRAY_200.value,
    800: designTokensJson.colors.GRAY_100.value,
    900: designTokensJson.colors.GRAY_50.value, // Lightest becomes darkest text
  },
  error: {
    // Error colors remain similar but adjusted for dark backgrounds
    25: '#2D0A0A', // Dark red background
    50: '#3D0E0E',
    100: '#4D1414',
    200: '#7A1C1C',
    300: '#A52626',
    400: '#D93030',
    500: designTokensJson.colors.ERROR_500.value,
    600: '#F97066',
    700: '#FDA29B',
    800: '#FECDCA',
    900: '#FEF3F2',
  },
  warning: {
    // Warning colors adjusted for dark backgrounds
    25: '#2D1A00', // Dark orange background
    50: '#3D2200',
    100: '#4D2B00',
    200: '#7A4400',
    300: '#A55D00',
    400: '#D97600',
    500: designTokensJson.colors.WARNING_500.value,
    600: '#FDB022',
    700: '#FEC84B',
    800: '#FEDF89',
    900: '#FFFAEB',
  },
  success: {
    // Success colors adjusted for dark backgrounds
    25: '#0A2D1A', // Dark green background
    50: '#0E3D22',
    100: '#144D2B',
    200: '#1C7A44',
    300: '#26A55D',
    400: '#30D976',
    500: designTokensJson.colors.SUCCESS_500.value,
    600: '#32D583',
    700: '#6CE9A6',
    800: '#A6F4C5',
    900: '#ECFDF3',
  },
  accent: {
    // Accent colors adjusted for better visibility on dark backgrounds
    yellow: '#E6D96B', // Slightly darker yellow
    pink: '#E5C4E7', // Slightly darker pink
    paper: '#2D2621', // Dark paper color
    ink: '#C9B3DC', // Lighter ink for dark mode
  },
} as const

// Semantic color mappings that work for both themes
export const createSemanticColors = (baseColors: typeof lightColors) => ({
  // Background colors
  background: {
    primary: baseColors.base.white,
    secondary: baseColors.gray[25],
    tertiary: baseColors.gray[50],
    elevated: baseColors.base.white,
  },

  // Surface colors
  surface: {
    primary: baseColors.base.white,
    secondary: baseColors.gray[50],
    tertiary: baseColors.gray[100],
    elevated: baseColors.base.white,
  },

  // Text colors
  text: {
    primary: baseColors.gray[900],
    secondary: baseColors.gray[700],
    tertiary: baseColors.gray[500],
    disabled: baseColors.gray[400],
    inverse: baseColors.base.white,
  },

  // Border colors
  border: {
    primary: baseColors.gray[300],
    secondary: baseColors.gray[200],
    tertiary: baseColors.gray[100],
    focus: baseColors.primary[500],
    error: baseColors.error[500],
  },

  // Interactive colors
  interactive: {
    primary: baseColors.primary[500],
    primaryHover: baseColors.primary[600],
    primaryPressed: baseColors.primary[700],
    secondary: baseColors.gray[100],
    secondaryHover: baseColors.gray[200],
    secondaryPressed: baseColors.gray[300],
  },

  // Status colors
  status: {
    error: baseColors.error[500],
    warning: baseColors.warning[500],
    success: baseColors.success[500],
    info: baseColors.primary[500],
  },
})

export type ColorScheme = typeof lightColors
export type SemanticColors = ReturnType<typeof createSemanticColors>
