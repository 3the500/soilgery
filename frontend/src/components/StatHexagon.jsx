// 🔷 [피드백 반영] 육각형(레이더 차트) 스탯 지표
// - 6개 스텟을 한눈에 비교할 수 있는 육각형 그래프.
// - 스텟에는 "음수"도 존재할 수 있으므로, 값이 0 이하인 경우에도 화면에서
//   완전히 사라지지 않도록 항상 작은(MIN_RADIUS) 반경의 꼭짓점을 그린다.
// - 값이 커질수록(최대 DISPLAY_MAX 기준) 꼭짓점이 바깥쪽으로 확장된다.
import styles from './StatHexagon.module.css'

// 🔧 [버그 수정] 기존에는 SIZE(캔버스)가 라벨 텍스트 폭까지 고려하지 않고
// 딱 육각형 반경(MAX_RADIUS)+라벨 오프셋만큼만 잡혀 있어서, 오른쪽/왼쪽 축의
// 라벨 텍스트가 SVG viewBox 경계를 살짝 벗어나 잘려 보였다. 캔버스 크기를
// 키우고 라벨 오프셋을 줄여 텍스트가 항상 안쪽에 들어오도록 여유 공간 확보.
const SIZE = 200
const CENTER = SIZE / 2
const MIN_RADIUS = 10   // 스텟이 0 이하일 때도 보이는 "작은 육각형" 반경
const MAX_RADIUS = 62
// 🔧 [피드백 반영] 실제 적성검사에서 나올 수 있는 스텟 값은 질문별 가중치(-4~+6)를
// 합산해도 대략 -4 ~ +11 범위인데, 기존 DISPLAY_MAX(20)는 이보다 훨씬 커서 대부분의
// 값이 육각형 반경의 절반 정도밖에 못 채우고 있었다. 그 결과 스텟 간 1~2점 차이가
// 육각형 그래프에서는 거의 눈에 띄지 않는 문제가 있었음. 실제 값 범위에 맞춰
// DISPLAY_MAX을 낮춰서, 같은 점수 차이가 훨씬 더 뚜렷한 반경 차이로 보이도록(=더
// "극단적으로" 보이도록) 조정.
const DISPLAY_MAX = 12  // 이 값 이상이면 그래프상 최대치로 표시 (실제 스텟 상한과는 별개의 시각화 기준)

const AXIS_COUNT = 6

function pointOnAxis(index, radius) {
  // 12시 방향(-90도)부터 시계방향으로 60도씩 6개 축
  const angle = (-90 + index * (360 / AXIS_COUNT)) * (Math.PI / 180)
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  }
}

function valueToRadius(value) {
  const clamped = Math.max(0, Math.min(Number(value) || 0, DISPLAY_MAX))
  return MIN_RADIUS + (clamped / DISPLAY_MAX) * (MAX_RADIUS - MIN_RADIUS)
}

function polygonPoints(radii) {
  return radii.map((r, i) => pointOnAxis(i, r)).map((p) => `${p.x},${p.y}`).join(' ')
}

/**
 * items: [{ label: '체력', value: 8 }, ...] 형태의 6개 스텟 배열
 */
export default function StatHexagon({ items = [], size = SIZE }) {
  const radii = items.map((item) => valueToRadius(item.value))
  const gridLevels = [0.25, 0.5, 0.75, 1]

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={size} height={size}>
        {/* 배경 그리드 (25/50/75/100%) */}
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={polygonPoints(new Array(AXIS_COUNT).fill(MIN_RADIUS + level * (MAX_RADIUS - MIN_RADIUS)))}
            className={styles.gridPolygon}
          />
        ))}

        {/* 중심에서 각 꼭짓점으로 뻗는 축 선 */}
        {items.map((_, i) => {
          const outer = pointOnAxis(i, MAX_RADIUS)
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={outer.x}
              y2={outer.y}
              className={styles.axisLine}
            />
          )
        })}

        {/* 실제 스텟 값 다각형 (0 이하여도 MIN_RADIUS로 항상 작게 표시됨) */}
        <polygon points={polygonPoints(radii)} className={styles.dataPolygon} />
        {items.map((item, i) => {
          const p = pointOnAxis(i, radii[i])
          return <circle key={i} cx={p.x} cy={p.y} r={2.6} className={styles.dataDot} />
        })}

        {/* 축 라벨 */}
        {items.map((item, i) => {
          const labelPoint = pointOnAxis(i, MAX_RADIUS + 12)
          return (
            <text
              key={i}
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={styles.axisLabel}
            >
              {item.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
