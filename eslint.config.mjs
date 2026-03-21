import coreWebVitals from 'eslint-config-next/core-web-vitals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    name: 'project-ignores',
    ignores: [
      '**/src/types/supabase-generated.ts',
      '**/*backup*.{ts,tsx}',
      '**/*_backup*.{ts,tsx}',
    ],
  },
  ...coreWebVitals,
  {
    name: 'project-overrides',
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
];
