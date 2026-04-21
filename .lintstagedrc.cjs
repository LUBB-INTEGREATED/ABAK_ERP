module.exports = {
  '*.{ts,tsx,js,jsx,json,md,yml,yaml,css}': ['prettier --write'],
  '*.{ts,tsx,js,jsx}': ['eslint --fix'],
  'prisma/schema.prisma': ['prisma format --schema'],
};
