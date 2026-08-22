# FC ONLINE Rival Archive — ULTIMATE v4.5

`새로운성연합`과 `피버슛`의 FC ONLINE 1대1 친선 기록을 Nexon Open API가 현재 제공하는 범위까지 복원하고, 발견한 맞대결을 Cloudflare D1에 영구 보관하는 개인 라이벌 아카이브입니다.

## 경기 범위

- 공식 메타데이터로 확인한 `클래식 1on1(40)`과 `공식 친선(60)`
- 감독모드(52), 공식경기, 리그, 볼타와 기타 모드는 제외
- 양쪽 OUID의 Match ID를 끝까지 페이지네이션하고 합집합·중복 제거 후, Match Detail에 두 OUID가 함께 있는 경기만 채택
- 계정별 10,000 Match ID 안전상한과 상세 조회 실패 격리 유지

## v4.5 화면

- `개요`: 전체 상대전적과 양쪽 BEST XI
- `경기`: 최신순 목록, 클릭 시 실제 점유율·슈팅·유효 슈팅·패스, 득점 시간, 실제 평점 최고 선수, 당시 배치 공개
- `선수기록`: 득점왕·도움왕을 선택해서 한 종류씩 TOP 8 표시
- `분석`: 득점·슈팅·패스 지표와 최대 점수차, 연승·무패·연패, 최빈 스코어, 선수 단일 경기 기록

BEST XI는 10경기 이상 출전한 선수만 대상으로 실제 평균 `spRating`을 표시하고, 대표 포메이션의 고정 좌표와 포지션 통합 규칙으로 중복 카드 없이 선발합니다. 선수 UI에는 공식 FC ONLINE 데이터센터에서 확인한 급여, 시즌 이미지, 페이스온, 강화단계를 함께 표시합니다.

가짜 평점, 추정 포지션, 임의 득점 시간, 가상 선수 가격은 만들지 않습니다. 선수 카드 구분키는 `spId + spGrade`입니다.

## 영구 아카이브

Cloudflare D1의 `rivalry_matches` 테이블에 검증된 Match Detail 원본 JSON을 `matchId` 기본키로 저장합니다. 새로고침 시 DB 기록을 먼저 불러오고 Nexon API에서 새 ID만 상세 조회합니다. 메모리 캐시는 가속용이며 D1이 영구 기록의 기준입니다.

## 실행

기존 `.env`와 `NEXON_API_KEY`를 그대로 둔 상태에서 다음만 실행합니다.

```bash
npm install
npm run dev
```

- Local: `http://localhost:5173`
- 같은 Wi-Fi/LAN: 개발 서버가 표시하는 Network 주소
- 프론트와 API 서버 모두 `0.0.0.0` 바인딩

`.env.example`의 이름을 바꾸거나 실제 키를 다시 입력할 필요가 없습니다. API 키는 서버/Cloudflare Secret에서만 읽으며 브라우저 번들, 로그, GitHub에 포함하지 않습니다.

## 검증과 배포

```bash
npm run typecheck
npm run build
npx wrangler d1 migrations apply fc-online-rival-archive-db --remote
npx wrangler deploy
```

현재 D1 스키마는 `migrations/0001_create_rivalry_matches.sql`과 동기화되어 있습니다. 배포 서비스: <https://fc-online-rival-archive.rhrjsals0103.workers.dev>

## 데이터 한계

“전체 기록”은 Nexon Open API가 현재 반환하는 범위의 전체입니다. API가 반환하지 않는 과거 경기·과거 OUID·과거 닉네임은 자동 복구할 수 없습니다. Nexon Open API 데이터 갱신 시점에 따라 최근 경기 반영이 지연될 수 있습니다.

Data based on NEXON Open API

