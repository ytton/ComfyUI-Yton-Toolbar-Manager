const latinOrder = new Intl.Collator('en', { sensitivity: 'base', numeric: true, ignorePunctuation: true })
const chineseOrder = new Intl.Collator('zh-Hans', { sensitivity: 'base', numeric: true })

function nameKey(name) {
  return name.normalize('NFKC').replace(/^[^\p{L}\p{N}]+/u, '')
}

export function comparePackageNames(left, right) {
  const a = nameKey(left)
  const b = nameKey(right)
  const aChinese = /^\p{Script=Han}/u.test(a)
  const bChinese = /^\p{Script=Han}/u.test(b)
  if (aChinese !== bChinese) return aChinese ? 1 : -1
  return (aChinese ? chineseOrder : latinOrder).compare(a, b)
}

export function matchesPackageName(name, query) {
  return name.normalize('NFKC').toLocaleLowerCase().includes(query.trim().normalize('NFKC').toLocaleLowerCase())
}
