# ROUTE RACE — 길찾기 알고리즘 경주

[실행](https://hyungminyoon1.github.io/route-race/) · [WEB LAB](https://hyungminyoon1.github.io/web-lab/)

같은 가중치 지도에서 BFS·Dijkstra·A*의 방문 순서와 이동 횟수·경로 비용을 비교하는 길찾기 작업대입니다.

## 직접 해보기

- 20×12 지도에 벽·평지·험지·출발·도착 직접 그리기
- 마우스/터치 드래그와 방향키·Space 편집
- 세 알고리즘 나란히 재생, 한 단계·슬라이더·결과 보기
- 가중치 비용 차이, 도달 불가능 상태, 기본/랜덤/빈 지도

개인 소개나 계정 없이 사용할 수 있습니다. 새로고침하면 실험 상태가 초기화됩니다.

참고 개념: [원문과 추가 학습](https://visualgo.net/en/sssp). 구현은 이 저장소의 계산 모델과 UI로 작성했습니다.

## 실행 및 검증

Node.js 22 이상. 외부 패키지는 없습니다.

```sh
npm run dev -- 0
npm test
npm run check
```

main에 푸시하면 검증 후 dist만 GitHub Pages에 배포합니다. 계산 모델과 UI는 분리되어 있습니다. 현재 페이지를 닫으면 실험 상태가 사라지며 서버 업로드·계정·방문자 추적 기능은 없습니다. 호스팅 로그와 앱의 데이터 처리는 별개입니다.

[구조](architecture.md) · [결정 기록](docs/decisions.md) · [검증 기록](docs/verification.md)

AI 에이전트와 함께 제작했습니다. 참고 개념과 원작 링크는 앱 및 설명에 표시하며, 다른 사이트의 코드나 디자인을 복제하지 않습니다. 별도 라이선스는 아직 부여하지 않았습니다.
