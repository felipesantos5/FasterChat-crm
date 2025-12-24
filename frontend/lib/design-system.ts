// Design System - Padronização de UI/UX

export const spacing = {
  page: "p-8", // Padding das páginas
  section: "space-y-6", // Espaçamento entre seções
  card: "p-6", // Padding dos cards
  cardGap: "gap-4", // Gap entre cards
  element: "space-y-4", // Espaçamento entre elementos
};

export const colors = {
  primary: "bg-green-600 hover:bg-green-700 text-white",
  secondary: "bg-gray-100 hover:bg-gray-200 text-gray-900",
  success: "bg-green-600 hover:bg-green-700 text-white",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  warning: "bg-yellow-600 hover:bg-yellow-700 text-white",
  info: "bg-blue-600 hover:bg-blue-700 text-white",

  // Status badges
  statusActive: "bg-green-50 text-green-700 border-green-200",
  statusInactive: "bg-gray-50 text-gray-700 border-gray-200",
  statusPending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  statusCancelled: "bg-red-50 text-red-700 border-red-200",
};

export const buttons = {
  // Tamanhos padronizados (sempre médio ou maior)
  default: "px-6 py-2.5 text-base font-medium rounded-lg transition-all duration-200",
  large: "px-8 py-3 text-lg font-medium rounded-lg transition-all duration-200",

  // Variantes
  primary:
    "px-6 py-2.5 text-base font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-all duration-200 shadow-sm hover:shadow-md h-10",
  secondary:
    "px-6 py-2.5 text-base font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 transition-all duration-200",
  success:
    "px-6 py-2.5 text-base font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-all duration-200 shadow-sm hover:shadow-md",
  danger: "px-6 py-2.5 text-base font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-all duration-200 shadow-sm hover:shadow-md",
  outline: "px-6 py-2.5 text-base font-medium rounded-lg border-2 border-green-600 text-green-600 hover:bg-green-50 transition-all duration-200",
  ghost: "px-6 py-2.5 text-base font-medium rounded-lg text-gray-700 hover:bg-gray-100 transition-all duration-200",
};

export const cards = {
  default: "bg-white rounded-xl shadow-sm border border-gray-100 p-6",
  hover: "bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200",
  stats: "bg-white rounded-xl shadow-sm border border-gray-100 p-6",
};

export const typography = {
  pageTitle: "text-3xl font-bold text-gray-900",
  pageSubtitle: "text-base text-gray-600 mt-1",
  sectionTitle: "text-xl font-semibold text-gray-900",
  cardTitle: "text-lg font-semibold text-gray-900",
  label: "text-sm font-medium text-gray-700",
  body: "text-base text-gray-700",
  caption: "text-sm text-gray-600",
};

export const layout = {
  container: "max-w-7xl mx-auto",
  pageWrapper: "min-h-screen bg-gray-50",
  contentArea: "p-8",
};

export const forms = {
  input: "w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all",
  label: "block text-sm font-medium text-gray-700 mb-2",
  error: "text-sm text-red-600 mt-1",
  select:
    "w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white",
  textarea:
    "w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none",
};

export const badges = {
  default: "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border",
  success: "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-200",
  warning: "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-50 text-yellow-700 border border-yellow-200",
  danger: "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700 border border-red-200",
  info: "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200",
  neutral: "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-50 text-gray-700 border border-gray-200",
};

export const icons = {
  default: "h-5 w-5",
  large: "h-6 w-6",
  small: "h-4 w-4",
};
