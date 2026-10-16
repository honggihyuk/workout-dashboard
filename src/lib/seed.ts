// 처음부터 들어 있는 목록: 기본 운동, 영양제·보충제 9종, 3분할 루틴 예시
// - 기본 운동은 직접 정리한 목록입니다 (다른 앱 데이터를 가져오지 않음, 5차 결정)
// - id는 기록이 참조하므로 한 번 정하면 바꾸지 않습니다
import type { BodyPart, Equipment, Exercise, Routine, RoutineItem, Supplement } from './types'

type Row = [id: string, name: string, part: BodyPart, equip: Equipment]

const library: Row[] = [
  // 가슴
  ['bench_press', '벤치프레스', '가슴', '바벨'],
  ['incline_bench_press', '인클라인 벤치프레스', '가슴', '바벨'],
  ['decline_bench_press', '디클라인 벤치프레스', '가슴', '바벨'],
  ['db_bench_press', '덤벨 벤치프레스', '가슴', '덤벨'],
  ['incline_db_press', '인클라인 덤벨프레스', '가슴', '덤벨'],
  ['db_fly', '덤벨 플라이', '가슴', '덤벨'],
  ['incline_db_fly', '인클라인 덤벨 플라이', '가슴', '덤벨'],
  ['chest_press_machine', '체스트 프레스 머신', '가슴', '머신'],
  ['incline_chest_press_machine', '인클라인 체스트 프레스 머신', '가슴', '머신'],
  ['smith_bench_press', '스미스 머신 벤치프레스', '가슴', '머신'],
  ['smith_incline_press', '스미스 머신 인클라인 프레스', '가슴', '머신'],
  ['pec_deck', '펙덱 플라이', '가슴', '머신'],
  ['cable_crossover', '케이블 크로스오버', '가슴', '케이블'],
  ['low_cable_fly', '로우 케이블 플라이', '가슴', '케이블'],
  ['dips', '딥스', '가슴', '맨몸'],
  ['push_up', '푸시업', '가슴', '맨몸'],
  // 등
  ['deadlift', '데드리프트', '등', '바벨'],
  ['barbell_row', '바벨 로우', '등', '바벨'],
  ['pendlay_row', '펜들레이 로우', '등', '바벨'],
  ['t_bar_row', '티바 로우', '등', '바벨'],
  ['rack_pull', '랙 풀', '등', '바벨'],
  ['one_arm_db_row', '원암 덤벨 로우', '등', '덤벨'],
  ['db_pullover', '덤벨 풀오버', '등', '덤벨'],
  ['lat_pulldown', '랫풀다운', '등', '머신'],
  ['close_grip_lat_pulldown', '클로즈그립 랫풀다운', '등', '머신'],
  ['seated_row_machine', '시티드 로우 머신', '등', '머신'],
  ['high_row_machine', '하이 로우 머신', '등', '머신'],
  ['assisted_pull_up', '어시스티드 풀업', '등', '머신'],
  ['seated_cable_row', '시티드 케이블 로우', '등', '케이블'],
  ['one_arm_cable_row', '원암 케이블 로우', '등', '케이블'],
  ['straight_arm_pulldown', '스트레이트암 풀다운', '등', '케이블'],
  ['pull_up', '풀업', '등', '맨몸'],
  ['chin_up', '친업', '등', '맨몸'],
  ['inverted_row', '인버티드 로우', '등', '맨몸'],
  ['back_extension', '백 익스텐션', '등', '맨몸'],
  // 하체
  ['squat', '스쿼트', '하체', '바벨'],
  ['front_squat', '프론트 스쿼트', '하체', '바벨'],
  ['romanian_deadlift', '루마니안 데드리프트', '하체', '바벨'],
  ['stiff_leg_deadlift', '스티프 레그 데드리프트', '하체', '바벨'],
  ['good_morning', '굿모닝', '하체', '바벨'],
  ['hip_thrust', '힙 쓰러스트', '하체', '바벨'],
  ['barbell_lunge', '바벨 런지', '하체', '바벨'],
  ['db_lunge', '덤벨 런지', '하체', '덤벨'],
  ['bulgarian_split_squat', '불가리안 스플릿 스쿼트', '하체', '덤벨'],
  ['goblet_squat', '고블릿 스쿼트', '하체', '덤벨'],
  ['step_up', '스텝업', '하체', '덤벨'],
  ['leg_press', '레그프레스', '하체', '머신'],
  ['hack_squat', '핵 스쿼트', '하체', '머신'],
  ['smith_squat', '스미스 머신 스쿼트', '하체', '머신'],
  ['leg_extension', '레그 익스텐션', '하체', '머신'],
  ['lying_leg_curl', '라잉 레그 컬', '하체', '머신'],
  ['seated_leg_curl', '시티드 레그 컬', '하체', '머신'],
  ['hip_abduction', '힙 어브덕션', '하체', '머신'],
  ['hip_adduction', '힙 어덕션', '하체', '머신'],
  ['standing_calf_raise', '스탠딩 카프 레이즈', '하체', '머신'],
  ['seated_calf_raise', '시티드 카프 레이즈', '하체', '머신'],
  ['cable_kickback', '케이블 킥백', '하체', '케이블'],
  ['bodyweight_squat', '맨몸 스쿼트', '하체', '맨몸'],
  // 어깨
  ['overhead_press', '오버헤드 프레스', '어깨', '바벨'],
  ['behind_neck_press', '비하인드 넥 프레스', '어깨', '바벨'],
  ['upright_row', '업라이트 로우', '어깨', '바벨'],
  ['barbell_shrug', '바벨 슈러그', '어깨', '바벨'],
  ['db_shoulder_press', '덤벨 숄더 프레스', '어깨', '덤벨'],
  ['arnold_press', '아놀드 프레스', '어깨', '덤벨'],
  ['lateral_raise', '사이드 레터럴 레이즈', '어깨', '덤벨'],
  ['front_raise', '프론트 레이즈', '어깨', '덤벨'],
  ['bent_over_lateral_raise', '벤트오버 레터럴 레이즈', '어깨', '덤벨'],
  ['db_shrug', '덤벨 슈러그', '어깨', '덤벨'],
  ['shoulder_press_machine', '숄더 프레스 머신', '어깨', '머신'],
  ['machine_lateral_raise', '머신 레터럴 레이즈', '어깨', '머신'],
  ['reverse_pec_deck', '리버스 펙덱', '어깨', '머신'],
  ['cable_lateral_raise', '케이블 레터럴 레이즈', '어깨', '케이블'],
  ['cable_front_raise', '케이블 프론트 레이즈', '어깨', '케이블'],
  ['face_pull', '페이스 풀', '어깨', '케이블'],
  // 팔
  ['barbell_curl', '바벨 컬', '팔', '바벨'],
  ['ez_bar_curl', 'EZ바 컬', '팔', '바벨'],
  ['preacher_curl', '프리처 컬', '팔', '바벨'],
  ['reverse_curl', '리버스 컬', '팔', '바벨'],
  ['wrist_curl', '리스트 컬', '팔', '바벨'],
  ['lying_triceps_extension', '라잉 트라이셉스 익스텐션', '팔', '바벨'],
  ['close_grip_bench_press', '클로즈그립 벤치프레스', '팔', '바벨'],
  ['db_curl', '덤벨 컬', '팔', '덤벨'],
  ['hammer_curl', '해머 컬', '팔', '덤벨'],
  ['incline_db_curl', '인클라인 덤벨 컬', '팔', '덤벨'],
  ['concentration_curl', '컨센트레이션 컬', '팔', '덤벨'],
  ['db_kickback', '덤벨 킥백', '팔', '덤벨'],
  ['overhead_db_extension', '오버헤드 덤벨 익스텐션', '팔', '덤벨'],
  ['cable_curl', '케이블 컬', '팔', '케이블'],
  ['triceps_pushdown', '트라이셉스 푸시다운', '팔', '케이블'],
  ['rope_pushdown', '로프 푸시다운', '팔', '케이블'],
  ['overhead_cable_extension', '오버헤드 케이블 익스텐션', '팔', '케이블'],
  ['bench_dips', '벤치 딥스', '팔', '맨몸'],
  // 복근
  ['crunch', '크런치', '복근', '맨몸'],
  ['hanging_leg_raise', '행잉 레그레이즈', '복근', '맨몸'],
  ['leg_raise', '레그레이즈', '복근', '맨몸'],
  ['ab_rollout', '앱 롤아웃', '복근', '맨몸'],
  ['russian_twist', '러시안 트위스트', '복근', '맨몸'],
  ['decline_sit_up', '디클라인 싯업', '복근', '맨몸'],
  ['bicycle_crunch', '바이시클 크런치', '복근', '맨몸'],
  ['cable_crunch', '케이블 크런치', '복근', '케이블'],
  ['cable_woodchop', '케이블 우드찹', '복근', '케이블'],
  ['ab_crunch_machine', '앱 크런치 머신', '복근', '머신'],
]

/** 러닝은 세트 대신 거리·시간으로 기록 (runs 표) */
export const RUN_EXERCISE_ID = 'running'

export const seedExercises: Exercise[] = [
  ...library.map(([id, name, body_part, equipment]) => ({
    id,
    name,
    body_part,
    equipment,
    kind: 'weight' as const,
    is_custom: false,
    hidden: false,
  })),
  { id: RUN_EXERCISE_ID, name: '러닝', body_part: '유산소', equipment: '맨몸', kind: 'run', is_custom: false, hidden: false },
]

// 2차 2-1 영양제·보충제 9종
export const seedSupplements: Supplement[] = [
  { id: 'vitamin_c', name: '비타민C', short_name: null, schedule: 'daily', optional_on_run_only: false, sort_order: 1, hidden: false, serving_g: null, protein_g: null, kcal: null },
  { id: 'lutein', name: '루테인', short_name: null, schedule: 'daily', optional_on_run_only: false, sort_order: 2, hidden: false, serving_g: null, protein_g: null, kcal: null },
  { id: 'omega3', name: 'rTG 오메가3', short_name: '오메가3', schedule: 'daily', optional_on_run_only: false, sort_order: 3, hidden: false, serving_g: null, protein_g: null, kcal: null },
  { id: 'calcium_mix', name: '칼슘·마그네슘·비타민D·아연·망간', short_name: '칼슘 외 4종', schedule: 'daily', optional_on_run_only: false, sort_order: 4, hidden: false, serving_g: null, protein_g: null, kcal: null },
  { id: 'probiotics', name: '프로바이오틱스', short_name: null, schedule: 'daily', optional_on_run_only: false, sort_order: 5, hidden: false, serving_g: null, protein_g: null, kcal: null },
  { id: 'creatine', name: '크레아틴', short_name: null, schedule: 'workout', optional_on_run_only: false, sort_order: 6, hidden: false, serving_g: null, protein_g: null, kcal: null },
  { id: 'eaa', name: 'EAA', short_name: null, schedule: 'workout', optional_on_run_only: false, sort_order: 7, hidden: false, serving_g: null, protein_g: null, kcal: null },
  { id: 'glutamine', name: '글루타민', short_name: null, schedule: 'workout', optional_on_run_only: false, sort_order: 8, hidden: false, serving_g: null, protein_g: null, kcal: null },
  // 쉐이크 1회 40g (대표님). 단백질·칼로리는 WPI 일반값(단백질 약 90%, 1g당 약 3.7kcal)으로 넣어 두고 설정에서 고침
  { id: 'wpi_shake', name: 'WPI 쉐이크', short_name: null, schedule: 'workout', optional_on_run_only: true, sort_order: 9, hidden: false, serving_g: 40, protein_g: 36, kcal: 150 },
]

// 5차 확정: 3분할과 비슷한 루틴 (예시, 루틴 편집에서 바꿀 수 있음)
const routinePlan: [id: string, name: string, items: [string, number][]][] = [
  ['r_chest_tri', '가슴·삼두', [['bench_press', 4], ['incline_db_press', 3], ['cable_crossover', 3], ['triceps_pushdown', 3]]],
  ['r_back_bi', '등·이두', [['lat_pulldown', 4], ['barbell_row', 3], ['seated_cable_row', 3], ['barbell_curl', 3]]],
  ['r_leg_shoulder', '하체·어깨', [['squat', 4], ['leg_press', 3], ['overhead_press', 3], ['lateral_raise', 3]]],
]

export const RUN_ROUTINE_ID = 'r_run'

export const seedRoutines: Routine[] = [
  ...routinePlan.map(([id, name], i): Routine => ({ id, name, sort_order: i + 1, kind: 'weight', target_km: null, target_pace_sec: null })),
  // 러닝만 하는 날용 (6차 검수 요청): 거리와 평균 페이스로 기록
  { id: RUN_ROUTINE_ID, name: '러닝', sort_order: routinePlan.length + 1, kind: 'run', target_km: 5, target_pace_sec: null },
]

export const seedRoutineItems: RoutineItem[] = routinePlan.flatMap(([rid, , items]) =>
  items.map(([exercise_id, default_sets], i) => ({
    id: `${rid}_${i + 1}`,
    routine_id: rid,
    exercise_id,
    position: i + 1,
    default_sets,
  })),
)

/** 기본 목록이 바뀌면 올려서 다시 넣게 합니다 (이미 있는 것은 건드리지 않음) */
export const SEED_VERSION = 1
