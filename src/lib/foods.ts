// 단백질 표: 고기·생선 등 100g당 단백질·칼로리 (6차 MVP v1 검수 요청)
// 어림값입니다. 미국 농무부(USDA) 식품성분 자료와 국내 연구 자료(한우 부위별 단백질, 돼지고기 부위별 성분)를
// 바탕으로 했고, 같은 부위도 지방량·조리법에 따라 달라질 수 있습니다. 포장 제품은 영양표가 우선입니다.

export type FoodGroup = '닭' | '소' | '돼지' | '생선·해산물' | '계란·콩·유제품'
export const FOOD_GROUPS: FoodGroup[] = ['닭', '소', '돼지', '생선·해산물', '계란·콩·유제품']

/** 100g당 단백질(g)·칼로리(kcal) */
export interface Per100 {
  protein: number
  kcal: number
}

export interface Food {
  id: string
  name: string
  group: FoodGroup
  /** 익힌 무게 기준 */
  cooked: Per100
  /** 생 무게 기준. 없으면 생·익힌 구분이 없는 음식 */
  raw?: Per100
  /** 무게를 처음 채울 때 쓰는 흔한 1회 양 */
  serving?: { label: string; g: number }
}

export const FOODS: Food[] = [
  { id: 'chicken_breast', name: '닭가슴살', group: '닭', raw: { protein: 22.5, kcal: 120 }, cooked: { protein: 31, kcal: 165 }, serving: { label: '한 덩이', g: 100 } },
  { id: 'chicken_thigh', name: '닭다리살 (껍질 없음)', group: '닭', raw: { protein: 19.7, kcal: 121 }, cooked: { protein: 25.9, kcal: 209 } },
  { id: 'beef_round', name: '소고기 우둔·홍두깨', group: '소', raw: { protein: 22, kcal: 125 }, cooked: { protein: 30, kcal: 170 } },
  { id: 'beef_tenderloin', name: '소고기 안심', group: '소', raw: { protein: 21, kcal: 160 }, cooked: { protein: 28, kcal: 210 } },
  { id: 'beef_sirloin', name: '소고기 등심', group: '소', raw: { protein: 18, kcal: 230 }, cooked: { protein: 24, kcal: 290 } },
  { id: 'pork_tenderloin', name: '돼지 안심', group: '돼지', raw: { protein: 21, kcal: 115 }, cooked: { protein: 26, kcal: 145 } },
  { id: 'pork_loin', name: '돼지 등심', group: '돼지', raw: { protein: 22.2, kcal: 155 }, cooked: { protein: 27.3, kcal: 242 } },
  { id: 'pork_neck', name: '돼지 목살', group: '돼지', raw: { protein: 17, kcal: 230 }, cooked: { protein: 23, kcal: 290 } },
  { id: 'pork_belly', name: '삼겹살', group: '돼지', raw: { protein: 15.8, kcal: 348 }, cooked: { protein: 21.9, kcal: 493 } },
  { id: 'salmon', name: '연어', group: '생선·해산물', raw: { protein: 20.4, kcal: 208 }, cooked: { protein: 22.1, kcal: 206 } },
  { id: 'mackerel', name: '고등어', group: '생선·해산물', raw: { protein: 18.6, kcal: 205 }, cooked: { protein: 23.9, kcal: 262 } },
  { id: 'shrimp', name: '새우', group: '생선·해산물', raw: { protein: 20.1, kcal: 85 }, cooked: { protein: 24, kcal: 99 } },
  { id: 'tuna_can', name: '참치캔 (기름 뺀 것)', group: '생선·해산물', cooked: { protein: 29, kcal: 198 }, serving: { label: '작은 캔', g: 70 } },
  { id: 'egg', name: '계란', group: '계란·콩·유제품', cooked: { protein: 12.6, kcal: 150 }, serving: { label: '1개', g: 50 } },
  { id: 'egg_white', name: '계란 흰자', group: '계란·콩·유제품', cooked: { protein: 10.9, kcal: 52 }, serving: { label: '1개분', g: 33 } },
  { id: 'tofu', name: '두부', group: '계란·콩·유제품', cooked: { protein: 9.5, kcal: 90 }, serving: { label: '반 모', g: 150 } },
  { id: 'greek_yogurt', name: '그릭요거트 (무가당)', group: '계란·콩·유제품', cooked: { protein: 9, kcal: 95 }, serving: { label: '한 컵', g: 100 } },
  { id: 'milk', name: '우유', group: '계란·콩·유제품', cooked: { protein: 3.3, kcal: 65 }, serving: { label: '한 컵', g: 200 } },
]

export type WeightBasis = 'cooked' | 'raw'

export function per100(food: Food, basis: WeightBasis): Per100 {
  return basis === 'raw' && food.raw ? food.raw : food.cooked
}

/** 먹은 무게(g)로 단백질·칼로리 계산 */
export function foodAmount(food: Food, basis: WeightBasis, grams: number): Per100 {
  const v = per100(food, basis)
  return { protein: (v.protein * grams) / 100, kcal: (v.kcal * grams) / 100 }
}
