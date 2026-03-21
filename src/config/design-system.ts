/**
 * DESIGN SYSTEM CENTRALIZADO
 * =====================================================
 * Este arquivo define TODAS as constantes de estilo
 * para garantir consistência em toda a aplicação.
 * 
 * IMPORTANTE: Use este arquivo como referência para
 * todos os novos módulos em desenvolvimento.
 */

// ==================== SPACING SYSTEM ====================
// Escala baseada em rem (1rem = 4px no nosso sistema)
export const SPACING = {
  // Containers principals
  containerPadding: 'p-6',         // 24px
  containerGap: 'gap-6',           // 24px
  
  // Sections/Cards
  sectionMargin: 'mb-6',           // 24px
  sectionGap: 'gap-4',             // 16px
  cardPadding: 'p-6',              // 24px
  
  // Form elements
  formRowMargin: 'mb-4',           // 16px
  formRowGap: 'gap-4',             // 16px
  inputPadding: 'px-4 py-2',       // 16px horizontal, 8px vertical
  
  // Menu/Navigation
  menuItemPadding: 'py-2 px-4',    // 8px vertical, 16px horizontal
  menuItemSpacing: 'space-y-1',    // 4px between items
  
  // Buttons
  buttonPadding: 'px-6 py-2',      // 24px horizontal, 8px vertical
  buttonMargin: 'mb-4',            // 16px
};

// ==================== COLOR SYSTEM ====================
export const COLORS = {
  // Primary blues
  darkBlue: '#123b63',             // Primary dark blue
  mediumBlue: '#4A6FA5',           // Medium blue
  lightBlue: '#0284c7',            // Light blue accent
  cardBlue: '#4A6FA5E6',           // Login card (RGBA)
  
  // Accent
  yellow: '#FBBF24',               // Accent yellow/gold
  orange: '#F97316',               // Accent orange
  
  // Neutral
  white: '#FFFFFF',
  gray100: '#F9FAFB',
  gray200: '#F3F4F6',
  gray300: '#E5E7EB',
  gray600: '#4B5563',
  gray700: '#374151',
  
  // Status
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

// ==================== SHADOWS ====================
export const SHADOWS = {
  // Card shadows - NUNCA USE shadow-lg ou shadow-2xl (muito grandes)
  cardShadow: 'shadow-sm',         // Sutil, para cards
  cardHoverShadow: 'hover:shadow-md', // Leve aumento no hover
  
  // Modal/Dialog shadows
  modalShadow: 'shadow-xl',        // Mais pronunciado
  
  // Floating elements (botões, badges)
  buttonShadow: 'shadow-sm',       // Sutil
};

// ==================== ROUNDED/BORDER RADIUS ====================
export const RADIUS = {
  card: 'rounded-2xl',             // 16px - Cards principais
  input: 'rounded-lg',             // 8px - Inputs
  button: 'rounded-lg',            // 8px - Buttons
  small: 'rounded-md',             // 6px - Pequenos elementos
  full: 'rounded-full',            // 999px - Pills, avatars
};

// ==================== BORDERS ====================
export const BORDERS = {
  card: 'border-2 border-gray-300',
  input: 'border border-gray-300',
  divider: 'border-t border-gray-200',
};

// ==================== TYPOGRAPHY ====================
export const TYPOGRAPHY = {
  // Headings
  h1: 'text-4xl font-bold',
  h2: 'text-3xl font-bold',
  h3: 'text-2xl font-bold',
  h4: 'text-xl font-bold',
  h5: 'text-lg font-bold',
  
  // Body
  body: 'text-base',
  bodySmall: 'text-sm',
  bodyTiny: 'text-xs',
  
  // Special
  label: 'text-sm font-semibold',
  caption: 'text-xs text-gray-600',
};

// ==================== TRANSITION ====================
export const TRANSITIONS = {
  default: 'transition',
  fast: 'transition-all duration-150',
  medium: 'transition-all duration-300',
  slow: 'transition-all duration-500',
};

// ==================== BREAKPOINTS ====================
export const BREAKPOINTS = {
  mobile: 'max-w-md',              // 448px
  tablet: 'max-w-2xl',             // 672px
  desktop: 'max-w-6xl',            // 1152px
  wide: 'max-w-7xl',               // 1280px
};

// ==================== COMPOSITES (Combinações padrão) ====================
export const COMPONENTS = {
  // Cards padrão
  card: `${RADIUS.card} ${SHADOWS.cardShadow} ${SPACING.cardPadding} ${TRANSITIONS.default}`,
  cardHover: `hover:shadow-md cursor-pointer`,
  
  // Inputs padrão
  input: `${RADIUS.input} ${BORDERS.input} ${SPACING.inputPadding} text-base ${TRANSITIONS.fast}`,
  inputFocus: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  
  // Botões padrão
  button: `${RADIUS.button} ${SPACING.buttonPadding} font-semibold ${TRANSITIONS.fast}`,
  buttonPrimary: `bg-blue-600 text-white hover:bg-blue-700`,
  buttonSecondary: `bg-gray-200 text-gray-800 hover:bg-gray-300`,
  
  // Menu items
  menuItem: `${SPACING.menuItemPadding} ${TRANSITIONS.fast} hover:bg-gray-100 rounded-lg`,
};

// ==================== CONTAINER PATTERNS ====================
export const PATTERNS = {
  // Layout padrão para páginas
  pageContainer: `w-full ${SPACING.containerPadding}`,
  
  // Grid padrão para cards
  cardGrid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${SPACING.sectionGap} ${SPACING.sectionMargin}`,
  
  // Flex padrão para seções
  flexSection: `flex flex-col ${SPACING.sectionGap}`,
  
  // Form padrão
  formRow: `flex flex-col gap-2 ${SPACING.formRowMargin}`,
};

export default {
  SPACING,
  COLORS,
  SHADOWS,
  RADIUS,
  BORDERS,
  TYPOGRAPHY,
  TRANSITIONS,
  BREAKPOINTS,
  COMPONENTS,
  PATTERNS,
};
