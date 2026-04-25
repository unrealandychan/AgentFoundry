import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'fs';
import path from 'path';

// Files to update (relative to project root)
const FILES = [
  'src/components/wizard/step-choose-template.tsx',
  'src/components/wizard/step-add-skills.tsx',
  'src/components/wizard/step-add-integrations.tsx',
  'src/components/wizard/step-agent-target.tsx',
  'src/components/wizard/step-customize.tsx',
  'src/components/wizard/step-preview.tsx',
  'src/components/wizard/step-test-agent.tsx',
  'src/components/wizard/step-download.tsx',
  'src/components/skill-builder-flow.tsx',
  'src/components/skill-download-flow.tsx',
  'src/components/ui/tooltip.tsx',
];

// Ordered replacements: more specific first
const REPLACEMENTS = [
  // Backgrounds (specific first)
  [/\bbg-white\/80\b/g, 'bg-white/80 dark:bg-gray-900/80'],
  [/\b(bg-white)\b(?! dark:)/g, '$1 dark:bg-gray-900'],
  [/\b(bg-gray-100)\b(?! dark:)/g, '$1 dark:bg-gray-800'],
  [/\b(bg-gray-50)\b(?! dark:)/g, '$1 dark:bg-gray-800'],
  [/\b(bg-slate-50)\b(?! dark:)/g, '$1 dark:bg-gray-900'],
  [/from-slate-50 to-indigo-50(?! dark:)/g, 'from-slate-50 to-indigo-50 dark:from-gray-950 dark:to-gray-900'],
  [/\b(bg-indigo-100)\b(?! dark:)/g, '$1 dark:bg-indigo-900'],
  [/\b(bg-emerald-100)\b(?! dark:)/g, '$1 dark:bg-emerald-900'],
  [/\b(bg-violet-100)\b(?! dark:)/g, '$1 dark:bg-violet-900'],
  [/\b(bg-slate-100)\b(?! dark:)/g, '$1 dark:bg-gray-700'],

  // Text colors
  [/\b(text-slate-900)\b(?! dark:)/g, '$1 dark:text-white'],
  [/\b(text-slate-700)\b(?! dark:)/g, '$1 dark:text-slate-300'],
  [/\b(text-slate-500)\b(?! dark:)/g, '$1 dark:text-slate-400'],
  [/\b(text-slate-400)\b(?! dark:)/g, '$1 dark:text-slate-500'],
  [/\b(text-gray-400)\b(?! dark:)/g, '$1 dark:text-gray-500'],
  [/\b(text-indigo-600)\b(?! dark:)/g, '$1 dark:text-indigo-400'],
  [/\b(text-indigo-700)\b(?! dark:)/g, '$1 dark:text-indigo-300'],
  [/\b(text-emerald-700)\b(?! dark:)/g, '$1 dark:text-emerald-300'],
  [/\b(text-violet-700)\b(?! dark:)/g, '$1 dark:text-violet-300'],

  // Borders
  [/\b(border-gray-200)\b(?! dark:)/g, '$1 dark:border-gray-700'],
  [/\b(border-indigo-100)\b(?! dark:)/g, '$1 dark:border-gray-800'],
  [/\b(border-indigo-200)\b(?! dark:)/g, '$1 dark:border-indigo-800'],
  [/\b(border-gray-100)\b(?! dark:)/g, '$1 dark:border-gray-700'],
  [/\b(border-slate-200)\b(?! dark:)/g, '$1 dark:border-gray-700'],
  [/\b(border-slate-100)\b(?! dark:)/g, '$1 dark:border-gray-700'],

  // Step connector line (h-px)
  [/\b(bg-gray-200)\b(?! dark:)/g, '$1 dark:bg-gray-700'],
];

// Special: form inputs in step-customize
const FORM_INPUT_REPLACEMENT = [
  [/border-gray-200 bg-white(?! dark:)/g, 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white'],
];

const projectRoot = process.cwd();

for (const file of FILES) {
  const filePath = path.join(projectRoot, file);
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (e) {
    console.log(`SKIP (not found): ${file}`);
    continue;
  }

  const original = content;

  for (const [pattern, replacement] of REPLACEMENTS) {
    content = content.replace(pattern, replacement);
  }

  // Apply form input replacement only to step-customize
  if (file.includes('step-customize')) {
    for (const [pattern, replacement] of FORM_INPUT_REPLACEMENT) {
      content = content.replace(pattern, replacement);
    }
  }

  if (content !== original) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`UPDATED: ${file}`);
  } else {
    console.log(`NO CHANGE: ${file}`);
  }
}

console.log('Done!');
