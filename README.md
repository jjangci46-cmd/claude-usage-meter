# usage-meter

Claude Code 입력창 바로 위에 Claude 사용량을 한 줄로 보여 주는 모드입니다.

```
세션 ▬▬▬▬▭▭▭▭▭▭▭▭▭▭▭▭  18%   2h 13m 후 초기화  │  주간  18%  일 오후 3:00 초기화
```

- 현재 세션(5시간) 사용량 %, 둥근 가로 막대그래프, 초기화까지 남은 시간
- 주간 사용량 %와 초기화 시각(한국 시간, 오전/오후 표기)
- 80% 이상은 주황, 95% 이상은 빨강으로 강조
- 3분마다, 그리고 대화 턴이 끝날 때마다 자동 갱신
- 사용량 수치는 Claude Code가 API 응답으로 받은 rate-limit 정보를 그대로 사용합니다 (구독 계정에서만 표시)

## 설치

Claude Code 세션의 프롬프트에서:

```
/plugin install usage-meter --marketplace jjangci46-cmd/claude-usage-meter
```

`Add marketplace?`에 `y`, 설치 범위는 user(기본값)를 고르면 이후 모든 세션에서 동작합니다.

셸에서:

```bash
claude plugin install usage-meter --marketplace jjangci46-cmd/claude-usage-meter
```

데스크톱 앱(`/plugin`이 안 되는 곳): 프롬프트 옆 + → Plugins → Add marketplace에 `jjangci46-cmd/claude-usage-meter` → Add plugin.
