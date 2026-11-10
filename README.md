# Slayer

HUD가 곧 전장인 탑뷰 캐주얼 액션 웹앱. 2D(탑뷰)와 3D(1인칭)를 오가며 싸운다.
무엇을 만드는지는 [docs/DESIGN.md](docs/DESIGN.md).

Three.js + Vite. 빌드 결과는 정적 파일이고 JS는 gzip 기준 약 170KB다.

## 실행

```bash
npm install
npm run dev        # 개발 서버 (같은 네트워크의 폰에서도 접속 가능)
npm run build      # dist/ 에 정적 빌드
npm run preview    # 빌드 결과를 그대로 서빙
```

## 조작

| | 터치 (기본) | 키보드·마우스 |
|---|---|---|
| 이동 | 화면 왼쪽 절반 드래그 | `W` `A` `S` `D` |
| 조준·사격 (2D) | 화면 오른쪽 절반 드래그 | 마우스 조준 + 클릭, 또는 방향키 |
| 회전·사격 (3D) | 오른쪽 절반을 누르면 사격, 좌우로 끌면 회전 | 마우스(클릭 후 고정) 또는 `←` `→`, `Space` 사격 |
| 2D ↔ 3D | 우측 상단 버튼 | `F` 또는 `Tab` |

폰은 가로로 든다.

## 구조

```
src/game/      규칙. three.js·DOM을 모른다 — 그래서 브라우저 없이 테스트된다
  config.js          모든 수치
  stage_fighting.js  대전 격투 HUD 배치
  logic.js           상태 + step()
src/view/      그리기와 입력. 상태를 읽기만 한다
src/qa.js      스크린샷용 고정 장면 (?qa=...)
tools/         검증 도구, Blender 모델 생성
public/art/    2D 아트 슬롯
public/models/ Blender가 만든 .glb (빌드 산출물, 커밋함)
```

## 검증

```bash
npm test                          # 규칙 단위 테스트 (브라우저 불필요)
npm run build && npm run smoke    # 실제 멀티터치 입력으로 조작 검증
npm run build && npm run shots    # 고정 장면 스크린샷 -> qa_shots/
npm run balance                   # 사람 흉내 봇으로 승률 측정
```

- **`shots`가 만든 PNG는 반드시 열어서 본다.** 파일이 생긴 것만으로는 통과가 아니다.
- `smoke`는 `?qa=sandbox`(적 없는 전장)에서 조작을 검증한다. 조작 테스트가 전투 운에 따라 통과·실패하면 안 되기 때문이다.
- `smoke`·`shots`는 Playwright와 Chromium이 필요하다.

`?qa=` 장면: `title` `2d` `3d` `ko` `won` (정지) / `sandbox` (실시간, 적 없음)

## 2D 아트 끼우기 (Higgsfield 등)

`public/art/manifest.json`의 슬롯에 파일명을 적으면 그 그림을 쓴다. `null`이면 코드가 그린 기본 그림.

```json
{ "fighting": { "floor": "fighting/floor.jpg", "backdrop": null, "portraitP1": null, "portraitP2": null } }
```

파일은 `public/art/` 아래에 둔다. 코드 수정은 필요 없다.

| 슬롯 | 쓰이는 곳 | 권장 규격 | 무엇을 그릴까 |
|---|---|---|---|
| `floor` | 전장 바닥 전체 | **16:10**, 2048×1280 이상 | 위에서 내려다본 대전 격투 HUD 화면. 위쪽에 체력바 2개와 가운데 타이머, 아래쪽에 필살기 게이지가 오는 배치여야 3D 구조물과 맞는다 |
| `portraitP1` | P1 초상화 상자 윗면·앞면 | 1:1, 512×512 | 주인공 얼굴 |
| `portraitP2` | P2 초상화 상자 | 1:1, 512×512 | 상대(적) 얼굴 |
| `backdrop` | 전장 밖 배경(3D에서 하늘) | 세로 그라데이션, 폭은 무관 | 분위기용 하늘/조명 |

`floor`는 **원근 없는 정면 탑뷰**여야 한다. 비스듬한 그림은 바닥에 깔았을 때 구조물 위치와 어긋난다.

## 3D 모델 다시 만들기 (Blender)

모델은 손으로 고치지 않고 스크립트로 생성한다.

```bash
pip install bpy                                  # Blender를 파이썬 모듈로 (UI 불필요)
python tools/blender/build_models.py             # -> public/models/*.glb
```

스크립트를 고치면 다시 실행하고, 스크립트와 `.glb`를 함께 커밋한다.

## 배포

`npm run build`의 `dist/`를 아무 정적 호스트에 올리면 된다. 경로가 상대 경로라 하위 폴더에서도 동작한다.
