#!/usr/bin/env node
/**
 * Pet Wash™ - Translation Completeness Verification Script
 * Checks all translation keys have all 6 language variants
 * Languages: English, Hebrew, Arabic, Russian, French, Spanish
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_LANGUAGES = ['en', 'he', 'ar', 'ru', 'fr', 'es'];
const I18N_FILE_PATH = path.join(__dirname, '../client/src/lib/i18n.ts');

// Parse translations from i18n.ts file
function parseTranslations() {
  const content = fs.readFileSync(I18N_FILE_PATH, 'utf-8');
  
  // Extract translations object
  const translationsMatch = content.match(/export const translations: TranslationStrings = \{([\s\S]+?)\n\};/);
  if (!translationsMatch) {
    console.error('❌ Could not find translations object in i18n.ts');
    process.exit(1);
  }

  const translationsContent = translationsMatch[1];
  
  // Parse each translation key
  const keyPattern = /'([^']+)':\s*\{([^}]+)\}/g;
  const translations = {};
  let match;

  while ((match = keyPattern.exec(translationsContent)) !== null) {
    const key = match[1];
    const langs = match[2];
    
    translations[key] = {};
    REQUIRED_LANGUAGES.forEach(lang => {
      const langPattern = new RegExp(`${lang}:\\s*'([^']*)'`);
      const langMatch = langs.match(langPattern);
      translations[key][lang] = langMatch ? langMatch[1] : undefined;
    });
  }

  return translations;
}

// Verify translations
function verifyTranslations() {
  console.log('🔍 Pet Wash™ Translation Verification\n');
  console.log('📋 Checking i18n.ts for completeness...\n');

  const translations = parseTranslations();
  const totalKeys = Object.keys(translations).length;
  
  console.log(`✅ Found ${totalKeys} translation keys\n`);

  // Check each key for missing languages
  const incomplete = [];
  const empty = [];

  Object.entries(translations).forEach(([key, langs]) => {
    const missing = [];
    const emptyLangs = [];

    REQUIRED_LANGUAGES.forEach(lang => {
      if (!langs[lang]) {
        missing.push(lang);
      } else if (langs[lang].trim() === '') {
        emptyLangs.push(lang);
      }
    });

    if (missing.length > 0) {
      incomplete.push({ key, missing });
    }
    if (emptyLangs.length > 0) {
      empty.push({ key, langs: emptyLangs });
    }
  });

  // Report results
  console.log('═══════════════════════════════════════════\n');
  
  if (incomplete.length === 0 && empty.length === 0) {
    console.log('✅ ALL TRANSLATIONS COMPLETE!\n');
    console.log(`✅ ${totalKeys} keys verified`);
    console.log(`✅ All 6 languages (${REQUIRED_LANGUAGES.join(', ')}) present\n`);
    console.log('═══════════════════════════════════════════\n');
    return true;
  }

  // Report missing translations
  if (incomplete.length > 0) {
    console.log(`❌ INCOMPLETE: ${incomplete.length} keys missing languages\n`);
    incomplete.forEach(({ key, missing }) => {
      console.log(`  - '${key}': Missing ${missing.join(', ')}`);
    });
    console.log('');
  }

  // Report empty translations
  if (empty.length > 0) {
    console.log(`⚠️  EMPTY: ${empty.length} keys have empty strings\n`);
    empty.forEach(({ key, langs }) => {
      console.log(`  - '${key}': Empty ${langs.join(', ')}`);
    });
    console.log('');
  }

  console.log('═══════════════════════════════════════════\n');
  
  return false;
}

// Language distribution statistics
function languageStats() {
  const translations = parseTranslations();
  const totalKeys = Object.keys(translations).length;

  console.log('📊 Language Coverage Statistics:\n');
  
  REQUIRED_LANGUAGES.forEach(lang => {
    let complete = 0;
    let empty = 0;
    let missing = 0;

    Object.values(translations).forEach(langs => {
      if (!langs[lang]) {
        missing++;
      } else if (langs[lang].trim() === '') {
        empty++;
      } else {
        complete++;
      }
    });

    const percentage = ((complete / totalKeys) * 100).toFixed(1);
    const status = complete === totalKeys ? '✅' : '⚠️ ';
    
    console.log(`${status} ${lang.toUpperCase()}: ${complete}/${totalKeys} (${percentage}%) complete`);
    if (empty > 0) console.log(`   └─ ${empty} empty strings`);
    if (missing > 0) console.log(`   └─ ${missing} missing`);
  });

  console.log('');
}

// Main execution
function main() {
  const isComplete = verifyTranslations();
  languageStats();

  if (!isComplete) {
    console.error('💡 Fix missing translations in client/src/lib/i18n.ts\n');
    process.exit(1);
  }

  console.log('🎉 Translation verification passed!\n');
  process.exit(0);
}

main();
