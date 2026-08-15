# FC ONLINE 라이벌 아카이브

`새로운성연합`과 `피버슛`의 공식 경기 맞대결을 자동으로 모아 보여주는 개인 기록 사이트입니다.

## 가장 쉬운 실행 방법 (GitHub Codespaces)

1. 저장소의 **Code → Codespaces → Create codespace on main**을 누릅니다.
2. Codespace의 **Secrets**에 `NEXON_API_KEY`를 등록합니다.
3. 준비가 끝나면 사이트가 자동으로 열립니다.

> Codespaces Secret을 쓰지 않는 경우, 프로젝트 최상단에서 `.env.example`을 `.env`로 복사한 뒤 키를 넣어도 됩니다. `.env`는 GitHub에 올라가지 않습니다.

## 내 컴퓨터에서 실행

Node.js 20 이상에서 아래만 실행하면 프론트엔드와 API 서버가 함께 켜집니다.

```bash
cp .env.example .env
# .env의 NEXON_API_KEY 값을 실제 키로 변경
npm install
npm run dev
```

사이트 주소는 `http://localhost:5173`입니다.

## 포함된 기능

- 닉네임으로 OUID 자동 조회
- `새로운성연합`의 최근 공식 경기 조회
- 매치 상세 기록에서 `피버슛`과의 맞대결만 필터링
- 승/무/패, 승률, 경기 목록, 슈팅 수 표시
- `새로운성연합` 선수들의 맞대결 득점 TOP 표시
- API 키 누락·무효·권한·호출 한도 오류를 한국어로 안내
- API 키를 브라우저에 노출하지 않는 Node.js 서버 구조

## API 키 오류가 날 때

- 키 앞뒤의 공백이나 따옴표를 지웁니다.
- 넥슨 Open API에서 만든 애플리케이션에 **FC ONLINE**이 등록되어 있는지 확인합니다.
- `.env`를 수정했다면 실행 중인 서버를 한 번 껐다 켭니다.
- 실제 키를 `VITE_`로 시작하는 변수나 React 코드에 넣지 마세요. 브라우저에 노출될 수 있습니다.

데이터는 넥슨 Open API 갱신 시점에 따라 실제 게임보다 늦게 표시될 수 있습니다.

Data based on NEXON Open API
