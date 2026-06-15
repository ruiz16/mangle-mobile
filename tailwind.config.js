/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // =======================================================================
      // Identidad Visual MANGLE — Manual de Identidad Visual Corporativa
      // Paleta tierra: terracota (silueta izq.) + café (silueta der.) + dorado
      // (aura). El café es el extremo oscuro de la misma gama que la terracota,
      // tal como indica el manual ("degradado de la misma gama").
      // Tokens SEMÁNTICOS: cambiar la marca = tocar SOLO este archivo.
      // =======================================================================
      colors: {
        // Terracota / Naranja tierra — color de marca y acción (#B05B35)
        primary: {
          50: '#FAF1EA',
          100: '#F4DFD2',
          200: '#E7BFA6',
          300: '#D89E78',
          400: '#C67D50',
          500: '#B05B35',
          600: '#97492A',
          700: '#7C3C24',
          800: '#5F311F',
          900: '#4E2A1C',
          DEFAULT: '#B05B35',
        },
        // Café oscuro — textos, encabezados y estados oscuros (#4E3629)
        ink: {
          DEFAULT: '#4E3629',
          700: '#3E2B20',
          800: '#30211A',
          900: '#241813',
          950: '#1A120D',
        },
        // Dorado — acentos, aura, CTAs secundarios (#C5A043)
        accent: {
          50: '#FBF6E7',
          100: '#F4E8C1',
          200: '#E9D596',
          300: '#DCC06B',
          400: '#D0AE54',
          500: '#C5A043',
          600: '#A8842F',
          DEFAULT: '#C5A043',
          dark: '#A8842F',
        },
        // Fondos cálidos suaves (chips, gradientes de página)
        surface: {
          DEFAULT: '#F4E9E0',
          light: '#FAF4EF',
        },
        // Lienzo de la app (crema neutro cálido — combina con la gama tierra)
        canvas: '#FBF9F4',
        // Estado de error / peligro — SEMÁNTICO, NO es color de marca (#DC2626)
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#DC2626',
          600: '#B91C1C',
          700: '#991B1B',
          800: '#7F1D1D',
          DEFAULT: '#DC2626',
        },
      },
      fontFamily: {
        // Secundaria (cuerpo/UI): Montserrat — manual §3
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        // Principal (marca/títulos): Amaranth — manual §3
        display: ['Amaranth', 'Montserrat', 'cursive'],
      },
    },
  },
  plugins: [],
};
