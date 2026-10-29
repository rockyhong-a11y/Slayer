# Slayer

Godot 4.x 로그라이크 던전 크롤러. **탐험 → 전투 → 보상 → 다음 방.**
자율 이터레이션 루프(Claude Code 헤드리스 세션)로 개발한다.

## 구조

```
docs/DESIGN.md          무엇을 만드는가 + 완료 기준(DoD)
docs/STATUS.md          지금 위치 · 다음 할 일 큐 · 완료 기록   ← 매 이터레이션 갱신
docs/feedback/INBOX.md  사용자 지시 (최우선)
loop/loop.sh            무한 반복 루프
loop/PROMPT.md          매 이터레이션에 주입되는 프롬프트
tools/capture.sh        시각 QA — 창 띄우고 캡처하고 닫기
tools/qa_capture.gd     캡처 오토로드 (환경변수 구동)
scripts/ scenes/        게임
qa_shots/               캡처 결과 PNG (git 제외)
```

## 사전 준비

**Godot 4.x 바이너리가 필요하다.** 저장소에 포함되지 않는다(110MB).
PATH에 `godot`이 있거나 `GODOT_BIN`을 지정한다.

리눅스에서 받는 법 (이터레이션 0에서 검증한 버전):

```bash
cd /tmp && mkdir -p godot && cd godot
curl -sSL -o godot.zip \
  https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip
unzip -o -q godot.zip
export GODOT_BIN="$PWD/Godot_v4.3-stable_linux.x86_64"
"$GODOT_BIN" --version   # -> 4.3.stable.official...
```

창 없는 환경(헤드리스 서버, 컨테이너)이라면 `xvfb`도 필요하다.
디스플레이가 없으면 `capture.sh`가 알아서 `xvfb-run`으로 감싼다.

```bash
apt-get install -y xvfb
```

## 시각 QA

환경변수 `GAME_START`로 아무 화면에나 바로 진입해서 찍는다.

```bash
tools/capture.sh title                      # -> qa_shots/title.png
tools/capture.sh dungeon                    # -> qa_shots/dungeon.png
tools/capture.sh combat qa_shots/c.png      # 출력 경로 지정
```

동작: 헤드리스 import 1회 → 실제 창을 띄워 실행 → 지정 프레임에서 뷰포트를 PNG로 저장 → 종료.

| 환경변수 | 의미 |
|---|---|
| `GAME_START` | 시작 화면 (`title`/`dungeon`/`combat`/`reward`) |
| `QA_SHOT` | 저장할 PNG 경로. 비어 있으면 평범하게 플레이만 한다 |
| `QA_FRAME` | 캡처 전 대기 프레임 수 (기본 90). 화면이 덜 그려져 찍히면 올린다 |
| `QA_QUIT` | `0`이면 캡처 후 창을 닫지 않는다 |

## 루프

```bash
loop/loop.sh                      # 시작
touch loop/STOP                   # 현재 이터레이션이 끝나면 정지
echo "이유" > loop/STOP           # 이유를 남기며 정지
```

매 이터레이션은 **`--continue` 없는 새 세션**이다. 기억이 없는 것이 핵심이다 —
그래야 세션이 다음 세션을 위해 `docs/STATUS.md`에 기록을 남길 수밖에 없다.

| 환경변수 | 기본값 | 의미 |
|---|---|---|
| `CLAUDE_BIN` | `claude` | Claude Code 실행 파일 |
| `CLAUDE_ARGS` | `--permission-mode acceptEdits` | claude에 넘길 플래그 |
| `LOOP_SLEEP` | `5` | 이터레이션 사이 대기(초) |
| `LOOP_MAX` | `0` | N회 후 정지 (0 = 무제한) |

> `acceptEdits`는 파일 편집만 자동 승인한다. 루프가 셸 명령(캡처 실행 등)에서 막히면
> 완전 무인 실행을 위해 `CLAUDE_ARGS=--dangerously-skip-permissions`가 필요하다.
> 신뢰하는 저장소에서만 쓸 것 — 기본값으로 두지 않은 이유다.

## 사용자가 끼어드는 법

`docs/feedback/INBOX.md`의 "대기 중"에 한 줄 적으면 된다.
다음 이터레이션이 그것부터 처리한다. INBOX가 DESIGN보다 우선한다.
