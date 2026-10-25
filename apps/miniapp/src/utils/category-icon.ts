/**
 * 分类图标映射：菜单页左侧栏展示用
 * 分类数据无图标字段，按名称关键词匹配 emoji；未命中返回默认图标
 */
const ICON_RULES: Array<[RegExp, string]> = [
  [/奶茶|奶盖|波霸|鲜奶/, '🧋'],
  [/果茶|鲜果|水果|柠檬|柚|橙|莓/, '🍹'],
  [/咖啡|拿铁|美式|摩卡/, '☕'],
  [/小食|甜点|甜品|蛋糕|面包|炸|薯/, '🍰'],
  [/热销|推荐|人气|上新/, '⭐'],
];

export function categoryIcon(name: string): string {
  for (const [re, icon] of ICON_RULES) {
    if (re.test(name)) return icon;
  }
  return '🍽️';
}
