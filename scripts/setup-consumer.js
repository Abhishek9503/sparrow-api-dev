#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up GitHub Packages registry configuration...');

// Use token from environment or fallback (not recommended for prod)
const token =
  process.env.GITHUB_TOKEN

// .npmrc configuration content
const npmrcContent = `# GitHub Packages registry for @sparrowapp-dev scope
@sparrowapp-dev:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${token}

# Default npm registry for all other packages
registry=https://registry.npmjs.org/
`;

try {
  const npmrcPath = path.join(process.cwd(), '.npmrc');
  fs.writeFileSync(npmrcPath, npmrcContent, { encoding: 'utf8' });

  console.log('✅ .npmrc created successfully at project root.');
  console.log('👉 You can now install the package:');
  console.log('   pnpm add @sparrowapp-dev/stripe-billing --save-optional');
} catch (error) {
  console.error(`❌ Error writing .npmrc: ${error.message}`);
  process.exit(1);
}
