import designTokensJson from './design-tokens.json'

// Process colors from design tokens
export const colors = {
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

// Process typography from design tokens (using mobile variants for React Native)
export const typography = {
  display: {
    1: {
      fontSize: designTokensJson.typography.DISPLAY_1_MOBILE.fontSize,
      lineHeight: designTokensJson.typography.DISPLAY_1_MOBILE.lineHeight,
      fontWeight: designTokensJson.typography.DISPLAY_1_MOBILE.fontWeight,
      letterSpacing: designTokensJson.typography.DISPLAY_1_MOBILE.letterSpacing,
    },
    2: {
      fontSize: designTokensJson.typography.DISPLAY_2_MOBILE.fontSize,
      lineHeight: designTokensJson.typography.DISPLAY_2_MOBILE.lineHeight,
      fontWeight: designTokensJson.typography.DISPLAY_2_MOBILE.fontWeight,
      letterSpacing: designTokensJson.typography.DISPLAY_2_MOBILE.letterSpacing,
    },
    3: {
      fontSize: designTokensJson.typography.DISPLAY_3_MOBILE.fontSize,
      lineHeight: designTokensJson.typography.DISPLAY_3_MOBILE.lineHeight,
      fontWeight: designTokensJson.typography.DISPLAY_3_MOBILE.fontWeight,
      letterSpacing: designTokensJson.typography.DISPLAY_3_MOBILE.letterSpacing,
    },
  },
  heading: {
    1: {
      fontSize: designTokensJson.typography.HEADING_1_MOBILE.fontSize,
      lineHeight: designTokensJson.typography.HEADING_1_MOBILE.lineHeight,
      fontWeight: designTokensJson.typography.HEADING_1_MOBILE.fontWeight,
      letterSpacing: designTokensJson.typography.HEADING_1_MOBILE.letterSpacing,
    },
    2: {
      fontSize: designTokensJson.typography.HEADING_2_MOBILE.fontSize,
      lineHeight: designTokensJson.typography.HEADING_2_MOBILE.lineHeight,
      fontWeight: designTokensJson.typography.HEADING_2_MOBILE.fontWeight,
      letterSpacing: designTokensJson.typography.HEADING_2_MOBILE.letterSpacing,
    },
    3: {
      fontSize: designTokensJson.typography.HEADING_3_MOBILE.fontSize,
      lineHeight: designTokensJson.typography.HEADING_3_MOBILE.lineHeight,
      fontWeight: designTokensJson.typography.HEADING_3_MOBILE.fontWeight,
      letterSpacing: designTokensJson.typography.HEADING_3_MOBILE.letterSpacing,
    },
    4: {
      fontSize: designTokensJson.typography.HEADING_4_MOBILE.fontSize,
      lineHeight: designTokensJson.typography.HEADING_4_MOBILE.lineHeight,
      fontWeight: designTokensJson.typography.HEADING_4_MOBILE.fontWeight,
      letterSpacing: designTokensJson.typography.HEADING_4_MOBILE.letterSpacing,
    },
    5: {
      fontSize: designTokensJson.typography.HEADING_5_MOBILE.fontSize,
      lineHeight: designTokensJson.typography.HEADING_5_MOBILE.lineHeight,
      fontWeight: designTokensJson.typography.HEADING_5_MOBILE.fontWeight,
      letterSpacing: designTokensJson.typography.HEADING_5_MOBILE.letterSpacing,
    },
    6: {
      fontSize: designTokensJson.typography.HEADING_6_MOBILE.fontSize,
      lineHeight: designTokensJson.typography.HEADING_6_MOBILE.lineHeight,
      fontWeight: designTokensJson.typography.HEADING_6_MOBILE.fontWeight,
      letterSpacing: designTokensJson.typography.HEADING_6_MOBILE.letterSpacing,
    },
  },
  body: {
    l: {
      regular: {
        fontSize: designTokensJson.typography.BODY_L_REGULAR.fontSize,
        lineHeight: designTokensJson.typography.BODY_L_REGULAR.lineHeight,
        fontWeight: designTokensJson.typography.BODY_L_REGULAR.fontWeight,
        letterSpacing: designTokensJson.typography.BODY_L_REGULAR.letterSpacing,
      },
      bold: {
        fontSize: designTokensJson.typography.BODY_L_BOLD.fontSize,
        lineHeight: designTokensJson.typography.BODY_L_BOLD.lineHeight,
        fontWeight: designTokensJson.typography.BODY_L_BOLD.fontWeight,
        letterSpacing: designTokensJson.typography.BODY_L_BOLD.letterSpacing,
      },
    },
    m: {
      regular: {
        fontSize: designTokensJson.typography.BODY_M_REGULAR.fontSize,
        lineHeight: designTokensJson.typography.BODY_M_REGULAR.lineHeight,
        fontWeight: designTokensJson.typography.BODY_M_REGULAR.fontWeight,
        letterSpacing: designTokensJson.typography.BODY_M_REGULAR.letterSpacing,
      },
      bold: {
        fontSize: designTokensJson.typography.BODY_M_BOLD.fontSize,
        lineHeight: designTokensJson.typography.BODY_M_BOLD.lineHeight,
        fontWeight: designTokensJson.typography.BODY_M_BOLD.fontWeight,
        letterSpacing: designTokensJson.typography.BODY_M_BOLD.letterSpacing,
      },
    },
    s: {
      regular: {
        fontSize: designTokensJson.typography.BODY_S_REGULAR.fontSize,
        lineHeight: designTokensJson.typography.BODY_S_REGULAR.lineHeight,
        fontWeight: designTokensJson.typography.BODY_S_REGULAR.fontWeight,
        letterSpacing: designTokensJson.typography.BODY_S_REGULAR.letterSpacing,
      },
      bold: {
        fontSize: designTokensJson.typography.BODY_S_BOLD.fontSize,
        lineHeight: designTokensJson.typography.BODY_S_BOLD.lineHeight,
        fontWeight: designTokensJson.typography.BODY_S_BOLD.fontWeight,
        letterSpacing: designTokensJson.typography.BODY_S_BOLD.letterSpacing,
      },
    },
    xs: {
      regular: {
        fontSize: designTokensJson.typography.BODY_XS_REGULAR.fontSize,
        lineHeight: designTokensJson.typography.BODY_XS_REGULAR.lineHeight,
        fontWeight: designTokensJson.typography.BODY_XS_REGULAR.fontWeight,
        letterSpacing: designTokensJson.typography.BODY_XS_REGULAR.letterSpacing,
      },
      bold: {
        fontSize: designTokensJson.typography.BODY_XS_BOLD.fontSize,
        lineHeight: designTokensJson.typography.BODY_XS_BOLD.lineHeight,
        fontWeight: designTokensJson.typography.BODY_XS_BOLD.fontWeight,
        letterSpacing: designTokensJson.typography.BODY_XS_BOLD.letterSpacing,
      },
    },
  },
} as const

// Additional tokens not in the JSON file
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 25,
  full: 9999,
} as const

export const shadows = {
  sm: {
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: colors.gray[900],
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 5,
  },
} as const

// TypeScript types
export type Colors = typeof colors
export type Typography = typeof typography
export type Spacing = typeof spacing
export type BorderRadius = typeof borderRadius
export type Shadows = typeof shadows

export type Theme = {
  colors: Colors
  typography: Typography
  spacing: Spacing
  borderRadius: BorderRadius
  shadows: Shadows
}
