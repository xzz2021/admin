module.exports = {
  'apps/server/**/*.{js,ts}': [
    'pnpm --filter server exec eslint --fix',
    'pnpm --filter server exec prettier --write'
  ],
  'apps/admin/**/*.{js,ts,tsx,vue,html}': [
    'pnpm --filter admin exec eslint --fix',
    'pnpm --filter admin exec prettier --write'
  ],
  'apps/admin/**/*.{vue,scss,less,css,html}': 'pnpm --filter admin exec stylelint --fix',
  '*.{json,md,yml,yaml}': 'pnpm --filter admin exec prettier --write'
}
